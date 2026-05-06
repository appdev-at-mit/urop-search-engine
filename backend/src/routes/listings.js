import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getListingsCollection } from '../db.js';
import { getDb } from '../db.js';

const router = Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove items that are just the abbreviation when a longer form already
 * contains it in parentheses, e.g. "CSAIL" is dropped when
 * "Computer Sci and AI Lab (CSAIL)" exists.
 */
function deduplicateAbbreviations(items) {
  const abbrevs = new Set();
  for (const item of items) {
    const m = item.match(/\(([^)]+)\)/);
    if (m) abbrevs.add(m[1].trim().toLowerCase());
  }
  return items.filter((item) => !abbrevs.has(item.trim().toLowerCase()));
}

router.get('/', async (req, res) => {
  const {
    q = '',
    department = '',
    pay_or_credit = '',
    opportunity = '',
    lab = '',
    page = '1',
    limit = '20',
    sort = 'recent',
  } = req.query;

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    const listingsCollection = await getListingsCollection();

    const query = { is_active: true };
    if (q) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { title: regex },
        { professor: regex },
        { department: regex },
        { lab: regex },
        { description: regex },
        { requirements: regex },
      ];
    }
    if (department) {
      const abbr = department.match(/\(([^)]+)\)$/);
      const pattern = abbr
        ? `(${escapeRegex(department)}|${escapeRegex(abbr[1].trim())})`
        : escapeRegex(department);
      query.department = { $regex: pattern, $options: 'i' };
    }
    if (lab) {
      const trimmed = lab.trim();
      const abbr = trimmed.match(/\(([^)]+)\)$/);
      const pattern = abbr
        ? `^(${escapeRegex(trimmed)}|${escapeRegex(abbr[1].trim())})$`
        : `^${escapeRegex(trimmed)}$`;
      query.lab = { $regex: pattern, $options: 'i' };
    }
    if (pay_or_credit) {
      query.pay_or_credit = pay_or_credit;
    }

    const opportunityTheme = {
      urop: /^Undergraduate Research \(UROP\)$/i,
      global: /^Global Opportunities$/i,
      not_urop: /^Research \(not UROP\)$/i,
    };
    if (opportunity && Object.prototype.hasOwnProperty.call(opportunityTheme, opportunity)) {
      query.theme = { $regex: opportunityTheme[opportunity].source, $options: 'i' };
    }

    const sortOrder = sort === 'title' ? { title: 1 } : { posted_date: -1 };

    const [total, listings] = await Promise.all([
      listingsCollection.countDocuments(query),
      listingsCollection.find(query).sort(sortOrder).skip(offset).limit(limitNum).toArray(),
    ]);

    res.json({
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listings', details: error.message });
  }
});

router.get('/departments', async (_req, res) => {
  try {
    const listingsCollection = await getListingsCollection();
    const raw = await listingsCollection.distinct('department', {
      is_active: true,
      department: { $nin: [null, ''] },
    });

    const primarySet = new Set();
    for (const d of raw) {
      primarySet.add(d.includes('/') ? d.split('/')[0].trim() : d.trim());
    }
    const departments = deduplicateAbbreviations([...primarySet].sort((a, b) => a.localeCompare(b)));
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

router.get('/labs', async (_req, res) => {
  try {
    const listingsCollection = await getListingsCollection();
    const labs = await listingsCollection.distinct('lab', {
      is_active: true,
      lab: { $nin: [null, ''] },
    });

    labs.sort((a, b) => a.localeCompare(b));
    res.json(deduplicateAbbreviations(labs));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labs', details: error.message });
  }
});

router.get('/recommended', async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));

  try {
    const listingsCollection = await getListingsCollection();

    if (!req.user) {
      const listings = await listingsCollection
        .find({ is_active: true })
        .sort({ posted_date: -1 })
        .limit(limit)
        .toArray();
      return res.json({ listings, personalized: false });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ googleId: req.user.googleId });

    const terms = [
      ...(user?.interests || []),
      ...(user?.skills || []),
    ];
    if (user?.major) terms.push(user.major);

    const hasProfile = terms.length > 0;
    if (!hasProfile) {
      const listings = await listingsCollection
        .find({ is_active: true })
        .sort({ posted_date: -1 })
        .limit(limit)
        .toArray();
      return res.json({ listings, personalized: false });
    }

    const regexPatterns = terms.map(t => ({
      escaped: t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      regex: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    }));

    const orConditions = regexPatterns.flatMap(({ regex }) => [
      { title: regex },
      { description: regex },
      { requirements: regex },
      { department: regex },
      { theme: regex },
    ]);

    const candidates = await listingsCollection
      .find({ is_active: true, $or: orConditions })
      .sort({ posted_date: -1 })
      .limit(200)
      .toArray();

    const scored = candidates.map(listing => {
      let score = 0;
      const text = [listing.title, listing.description, listing.requirements, listing.department, listing.theme]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      for (const { regex } of regexPatterns) {
        if (regex.test(text)) score++;
      }
      return { listing, score };
    });

    scored.sort((a, b) => b.score - a.score || new Date(b.listing.posted_date ?? 0) - new Date(a.listing.posted_date ?? 0));

    const listings = scored.slice(0, limit).map(s => s.listing);
    res.json({ listings, personalized: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommended listings', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid listing id' });
    }

    const listingsCollection = await getListingsCollection();
    const listing = await listingsCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(listing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listing', details: error.message });
  }
});

export default router;