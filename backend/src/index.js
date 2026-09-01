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

// The ALB terminates TLS and forwards plain HTTP to this container, so without
// trusting its X-Forwarded-Proto header req.secure is always false — and
// express-session then silently declines to send the `secure` session cookie
// below, which broke Google login entirely in production. 1 = trust exactly
// one hop (the ALB), rather than `true`, which would let clients spoof
// X-Forwarded-For.
app.set('trust proxy', 1);

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

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/auth/google/callback`,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || '';
      const user = await withRetry(async () => {
        const db = await getDb();
        const users = db.collection('users');

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

        return users.findOne({ googleId: profile.id });
      }, { attempts: 3, maxDelayMs: 2000 });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
} else {
  console.warn('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google login is disabled.');
}

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
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// A transient Atlas blip used to kill the container outright, and ECS then
// spent minutes draining and replacing it. Retry a few times first, but still
// give up eventually so genuinely bad credentials fail loudly.
async function withRetry(fn, { attempts, maxDelayMs = 8000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts) throw error;
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), maxDelayMs);
      console.warn(
        `Retry ${attempt}/${attempts} failed (${error.message}); retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function connectWithRetry() {
  return withRetry(() => connectToDatabase(), { attempts: 5 });
}

async function startServer() {
  await connectWithRetry();
  await loadPersistedToken();

  setInterval(async () => {
    try { await (await getDb()).command({ ping: 1 }); }
    catch { /* reconnect will happen on next real query */ }
  }, 4 * 60 * 1000);

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
