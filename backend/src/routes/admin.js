import { Router } from 'express';
import {
  setToken,
  getTokenStatus,
  getLastScrapeResult,
  scrapeAndUpsert,
  persistToken,
} from '../services/elx-scraper.js';
import { getListingsCollection, getLabsCollection } from '../db.js';
import { ObjectId } from 'mongodb';

const router = Router();

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
  }
  const provided = req.headers['x-admin-key'];
  if (provided !== secret) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}

router.use(requireAdmin);

// Save a Cognito access token from ELx
router.post('/elx-token', async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token in request body' });
  }

  try {
    const info = setToken(token.trim());
    await persistToken();
    res.json({ ok: true, ...info });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trigger a scrape with the cached token
router.post('/refresh-listings', async (_req, res) => {
  const status = getTokenStatus();
  if (!status.valid) {
    return res.status(400).json({ error: `Cannot scrape: token ${status.reason}` });
  }

  try {
    const result = await scrapeAndUpsert();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current scrape status, token validity, and listing count
router.get('/scrape-status', async (_req, res) => {
  try {
    const collection = await getListingsCollection();
    const totalListings = await collection.countDocuments({ source: 'elx.mit.edu' });

    res.json({
      token: getTokenStatus(),
      lastScrape: getLastScrapeResult(),
      totalListings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Lab CRUD ---

router.post('/labs', async (req, res) => {
  const { name, acronym, department, pi, research_areas, description, website, contact_email, parent_org } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Lab name is required' });
  }

  try {
    const collection = await getLabsCollection();
    const now = new Date();
    const doc = {
      name: name.trim(),
      acronym: acronym?.trim() || null,
      department: department?.trim() || null,
      pi: pi?.trim() || null,
      research_areas: Array.isArray(research_areas) ? research_areas.map((a) => a.trim()) : [],
      description: description?.trim() || null,
      website: website?.trim() || null,
      contact_email: contact_email?.trim() || null,
      parent_org: parent_org?.trim() || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const result = await collection.insertOne(doc);
    res.status(201).json({ ok: true, id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/labs/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid lab id' });
  }

  const updates = {};
  const allowed = ['name', 'acronym', 'department', 'pi', 'research_areas', 'description', 'website', 'contact_email', 'parent_org'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = key === 'research_areas' && Array.isArray(req.body[key])
        ? req.body[key].map((a) => a.trim())
        : typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.updated_at = new Date();

  try {
    const collection = await getLabsCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updates },
      { returnDocument: 'after' },
    );

    if (!result) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    res.json({ ok: true, lab: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/labs/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid lab id' });
  }

  try {
    const collection = await getLabsCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { is_active: false, updated_at: new Date() } },
      { returnDocument: 'after' },
    );

    if (!result) {
      return res.status(404).json({ error: 'Lab not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
