import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getLabsCollection } from '../db.js';

const router = Router();

router.get('/filters', async (_req, res) => {
  try {
    const collection = await getLabsCollection();

    const [parentOrgs, researchAreas] = await Promise.all([
      collection.distinct('parent_org', { is_active: true, parent_org: { $nin: [null, ''] } }),
      collection.distinct('research_areas', { is_active: true }),
    ]);

    parentOrgs.sort((a, b) => a.localeCompare(b));
    researchAreas.sort((a, b) => a.localeCompare(b));

    res.json({ parentOrgs, researchAreas });
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
      query.research_areas = research_area;
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
