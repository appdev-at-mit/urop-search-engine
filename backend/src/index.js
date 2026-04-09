import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import listingsRouter from './routes/listings.js';
import labsRouter from './routes/labs.js';
import adminRouter from './routes/admin.js';
import { connectToDatabase } from './db.js';
import {
  loadPersistedToken,
  getTokenStatus,
  scrapeAndUpsert,
} from './services/elx-scraper.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/listings', listingsRouter);
app.use('/api/labs', labsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  await connectToDatabase();
  await loadPersistedToken();

  // Daily scrape at 6 AM using cached token
  cron.schedule('0 6 * * *', async () => {
    const status = getTokenStatus();
    if (!status.valid) {
      console.warn(`[cron] Skipping ELx scrape: token ${status.reason}`);
      return;
    }
    try {
      const result = await scrapeAndUpsert();
      console.log(`[cron] ELx scrape complete: ${result.inserted} new, ${result.updated} updated`);
    } catch (err) {
      console.error('[cron] ELx scrape failed:', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`UROP API running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
