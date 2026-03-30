import { Router } from 'express';
import {
  setToken,
  getTokenStatus,
  getLastScrapeResult,
  scrapeAndUpsert,
  persistToken,
} from '../services/elx-scraper.js';
import { getListingsCollection } from '../db.js';

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

export default router;
