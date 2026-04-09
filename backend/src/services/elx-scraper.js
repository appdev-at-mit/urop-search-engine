/**
 * ELx scraper service — calls the MIT elo-v2 API directly with a
 * Cognito access token (no Playwright needed).
 *
 * Token lifecycle:
 *   - Admin provides a Cognito JWT via the admin API
 *   - Token is stored in memory and persisted to the `admin_state` collection
 *   - Tokens expire after ~24 h (no refresh token available)
 */

import { getListingsCollection, connectToDatabase } from '../db.js';
import {
  buildCompensationCategoryMap,
  mapElxListing,
} from '../lib/map-elx-listing.js';

const ELX_API_BASE = 'https://api.mit.edu/elo-v2';

let cachedToken = null;
let tokenExpiresAt = null;
let lastScrapeResult = null;

// ── Token management ────────────────────────────────────────────

function decodeJwtPayload(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

export function setToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload.exp) throw new Error('Token has no expiry claim');

  const expiresAt = new Date(payload.exp * 1000);
  if (expiresAt <= new Date()) throw new Error('Token is already expired');

  cachedToken = token;
  tokenExpiresAt = expiresAt;

  return {
    username: payload.username || payload.sub,
    expiresAt: expiresAt.toISOString(),
    expiresInMs: expiresAt - Date.now(),
  };
}

export function getTokenStatus() {
  if (!cachedToken) return { valid: false, reason: 'no_token' };
  if (tokenExpiresAt <= new Date()) {
    return { valid: false, reason: 'expired', expiresAt: tokenExpiresAt.toISOString() };
  }
  return {
    valid: true,
    expiresAt: tokenExpiresAt.toISOString(),
    expiresInMs: tokenExpiresAt - Date.now(),
  };
}

export function getLastScrapeResult() {
  return lastScrapeResult;
}

// ── Persist token to DB so it survives restarts ─────────────────

export async function persistToken() {
  if (!cachedToken) return;
  const db = await connectToDatabase();
  await db.collection('admin_state').updateOne(
    { _id: 'elx_token' },
    { $set: { token: cachedToken, expiresAt: tokenExpiresAt, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function loadPersistedToken() {
  try {
    const db = await connectToDatabase();
    const doc = await db.collection('admin_state').findOne({ _id: 'elx_token' });
    if (doc?.token) {
      setToken(doc.token);
    }
  } catch {
    // Token missing or expired — that's fine, admin will set a new one
  }
}

// ── API calls ───────────────────────────────────────────────────

async function elxFetch(path) {
  const status = getTokenStatus();
  if (!status.valid) {
    throw new Error(`Cannot call ELx API: token ${status.reason}`);
  }

  const res = await fetch(`${ELX_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${cachedToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`ELx API auth failed (${res.status}) — token may be expired`);
  }
  if (!res.ok) {
    throw new Error(`ELx API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function fetchElxLookups() {
  try {
    const data = await elxFetch('/lookups');
    const depts = data?.departments || [];
    const deptMap = {};
    for (const d of depts) deptMap[d.id] = d.text;
    const compLookup = buildCompensationCategoryMap(data);
    return { deptMap, compLookup };
  } catch {
    return { deptMap: {}, compLookup: new Map() };
  }
}

async function fetchOpportunities() {
  const data = await elxFetch('/opportunity');

  if (Array.isArray(data)) return data;

  if (typeof data === 'object') {
    for (const key of ['data', 'results', 'items', 'opportunities', 'records']) {
      if (Array.isArray(data[key])) return data[key];
    }
  }

  throw new Error('Unexpected response shape from /opportunity');
}

// ── Main scrape + upsert ────────────────────────────────────────

export async function scrapeAndUpsert() {
  const { deptMap, compLookup } = await fetchElxLookups();
  const rawItems = await fetchOpportunities();

  const listings = rawItems.map((item) => mapElxListing(item, deptMap, compLookup));
  const collection = await getListingsCollection();

  let inserted = 0;
  let updated = 0;

  for (const listing of listings) {
    const result = await collection.updateOne(
      { elx_id: listing.elx_id },
      { $set: listing, $setOnInsert: { created_at: new Date() } },
      { upsert: true },
    );
    if (result.upsertedCount > 0) inserted++;
    else if (result.modifiedCount > 0) updated++;
  }

  lastScrapeResult = {
    scrapedAt: new Date().toISOString(),
    total: listings.length,
    inserted,
    updated,
    departments: [...new Set(listings.map((l) => l.department))].sort(),
  };

  return lastScrapeResult;
}
