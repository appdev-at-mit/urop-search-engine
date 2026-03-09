import express from 'express';
import cors from 'cors';
import listingsRouter from './routes/listings.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/listings', listingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`UROP API running on http://localhost:${PORT}`);
});
