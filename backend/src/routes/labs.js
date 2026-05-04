import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getLabsCollection } from '../db.js';
import { getDb } from '../db.js';

const router = Router();

/**
 * Tags that should filter the same labs (exact string in `research_areas` arrays).
 * Case-insensitive on the request value so ?research_area=ai still works.
 */
const RESEARCH_AREA_SYNONYM_GROUPS = [
  ['AI', 'artificial intelligence'],
  ['ML', 'machine learning'],
];

function researchAreasMatchCondition(value) {
  const v = value.trim();
  const lower = v.toLowerCase();
  for (const group of RESEARCH_AREA_SYNONYM_GROUPS) {
    if (group.some((g) => g.toLowerCase() === lower)) {
      return { research_areas: { $in: group } };
    }
  }
  return { research_areas: v };
}

router.get('/filters', async (_req, res) => {
  try {
    const collection = await getLabsCollection();

    const [parentOrgs, researchAreas, rawDepts] = await Promise.all([
      collection.distinct('parent_org', { is_active: true, parent_org: { $nin: [null, ''] } }),
      collection.distinct('research_areas', { is_active: true }),
      collection.distinct('department', { is_active: true, department: { $nin: [null, ''] } }),
    ]);

    parentOrgs.sort((a, b) => a.localeCompare(b));
    researchAreas.sort((a, b) => a.localeCompare(b));

    const deptSet = new Set();
    for (const d of rawDepts) {
      deptSet.add(d.includes('/') ? d.split('/')[0].trim() : d.trim());
    }
    const departments = [...deptSet].sort((a, b) => a.localeCompare(b));

    res.json({ parentOrgs, researchAreas, departments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lab filters', details: error.message });
  }
});

router.get('/', async (req, res) => {
  const {
    q = '',
    department = '',
    parent_org = '',
    research_area = '',
    page = '1',
    limit = '24',
  } = req.query;

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 24));
  const offset = (pageNum - 1) * limitNum;

  try {
    const collection = await getLabsCollection();

    const query = { is_active: true };

    if (q) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { name: regex },
        { acronym: regex },
        { pi: regex },
        { description: regex },
        { research_areas: regex },
      ];
    }

    if (department) {
      query.department = { $regex: department, $options: 'i' };
    }

    if (parent_org) {
      query.parent_org = parent_org;
    }

    if (research_area) {
      Object.assign(query, researchAreasMatchCondition(research_area));
    }

    const [total, labs] = await Promise.all([
      collection.countDocuments(query),
      collection.find(query).sort({ name: 1 }).skip(offset).limit(limitNum).toArray(),
    ]);

    res.json({
      labs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labs', details: error.message });
  }
});

router.get('/recommended', async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));

  try {
    const collection = await getLabsCollection();

    if (!req.user) {
      const labs = await collection
        .find({ is_active: true })
        .sort({ name: 1 })
        .limit(limit)
        .toArray();
      return res.json({ labs, personalized: false });
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
      const labs = await collection
        .find({ is_active: true })
        .sort({ name: 1 })
        .limit(limit)
        .toArray();
      return res.json({ labs, personalized: false });
    }

    const regexPatterns = terms.map(t => ({
      regex: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    }));

    const orConditions = regexPatterns.flatMap(({ regex }) => [
      { name: regex },
      { description: regex },
      { research_areas: regex },
      { department: regex },
      { pi: regex },
    ]);

    const candidates = await collection
      .find({ is_active: true, $or: orConditions })
      .limit(200)
      .toArray();

    const scored = candidates.map(lab => {
      let score = 0;
      const text = [lab.name, lab.description, lab.department, lab.pi, ...(lab.research_areas || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      for (const { regex } of regexPatterns) {
        if (regex.test(text)) score++;
      }
      return { lab, score };
    });

    scored.sort((a, b) => b.score - a.score || a.lab.name.localeCompare(b.lab.name));

    const labs = scored.slice(0, limit).map(s => s.lab);
    res.json({ labs, personalized: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommended labs', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid lab id' });
    }

    const collection = await getLabsCollection();
    const lab = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!lab) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    res.json(lab);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lab', details: error.message });
  }
});

export default router;
