import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import listingsRouter from './routes/listings.js';
import labsRouter from './routes/labs.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import { connectToDatabase, getDb } from './db.js';
import {
  loadPersistedToken,
  getTokenStatus,
  scrapeAndUpsert,
} from './services/elx-scraper.js';

const app = express();
const PORT = process.env.PORT || 3001;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

app.use(cors({
  origin: APP_URL,
  credentials: true,
}));
app.use(express.json());

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: 'urop_search_engine',
    collectionName: 'sessions',
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/auth/google/callback`,
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const db = await getDb();
    const users = db.collection('users');
    const email = profile.emails?.[0]?.value || '';

    await users.updateOne(
      { googleId: profile.id },
      {
        $set: {
          googleId: profile.id,
          email,
          name: profile.displayName,
          picture: profile.photos?.[0]?.value,
          lastLogin: new Date(),
        },
      },
      { upsert: true }
    );

    const user = await users.findOne({ googleId: profile.id });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.googleId);
});

passport.deserializeUser(async (googleId, done) => {
  try {
    const db = await getDb();
    const user = await db.collection('users').findOne({ googleId });
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

// Routes
app.use('/api/listings', listingsRouter);
app.use('/api/labs', labsRouter);
app.use('/api/admin', adminRouter);
app.use('/auth', authRouter);
app.use('/api/profile', profileRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// In production, serve the built React frontend
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

async function startServer() {
  await connectToDatabase();
  await loadPersistedToken();

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
