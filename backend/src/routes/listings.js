import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getListingsCollection } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const RELEVANCE_SCRIPT = resolve(ROOT_DIR, 'Relevance', 'relavence_TFIDF_LSA.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || process.env.PYTHON || 'python';

const router = Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      query.department = { $regex: department, $options: 'i' };
    }
    if (lab) {
      const trimmed = lab.trim();
      query.lab = { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' };
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

router.post('/rank/resume', async (req, res) => {
  const { resumePath, top_k = 10 } = req.body;
  if (!resumePath || typeof resumePath !== 'string') {
    return res.status(400).json({ error: 'resumePath is required in request body' });
  }

  const topK = Math.min(50, Math.max(1, Number(top_k) || 10));

  try {
    const args = [
      RELEVANCE_SCRIPT,
      '--resume-path',
      resumePath,
      '--top-k',
      String(topK),
      '--json',
    ];

    const ranker = spawn(PYTHON_EXECUTABLE, args, {
      cwd: ROOT_DIR,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    ranker.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    ranker.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ranker.on('error', (error) => {
      res.status(500).json({ error: 'Failed to start resume ranker', details: error.message });
    });

    ranker.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({
          error: 'Resume ranker failed',
          details: stderr || `exit code ${code}`,
        });
      }

      try {
        const results = JSON.parse(stdout);
        res.json({ results });
      } catch (parseError) {
        res.status(500).json({
          error: 'Invalid JSON returned from resume ranker',
          details: parseError.message,
          stdout,
          stderr,
        });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rank listings', details: error.message });
  }
});

router.get('/departments', async (_req, res) => {
  try {
    const listingsCollection = await getListingsCollection();
    const departments = await listingsCollection.distinct('department', {
      is_active: true,
      department: { $nin: [null, ''] },
    });

    departments.sort((a, b) => a.localeCompare(b));
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
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labs', details: error.message });
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
