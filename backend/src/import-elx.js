/**
 * Import scraped ELx UROP listings into MongoDB.
 *
 * Reads elx_scraper/data/urops_raw.json (the raw API response) and
 * upserts each listing into the `listings` collection, mapping ELx
 * fields to the schema the frontend expects.
 *
 * Usage:
 *   MONGODB_URI=mongodb://... node src/import-elx.js
 *
 * Flags:
 *   --dry-run   Print what would be imported without writing to DB
 *   --clear     Remove all ELx-sourced listings before importing
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getListingsCollection, closeDatabaseConnection } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_JSON_PATH = resolve(__dirname, '../../elx_scraper/data/urops_raw.json');
const LOOKUPS_PATH = resolve(__dirname, '../../elx_scraper/data/api_raw_full.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAR = args.includes('--clear');

function loadDeptLookup() {
  try {
    const json = readFileSync(LOOKUPS_PATH, 'utf-8');
    const full = JSON.parse(json);
    const depts = full?.lookups?.departments || [];
    const map = {};
    for (const d of depts) map[d.id] = d.text;
    console.log(`Loaded ${Object.keys(map).length} department mappings`);
    return map;
  } catch {
    console.warn('Could not load department lookups — will use raw IDs');
    return {};
  }
}

const DEPT_MAP = loadDeptLookup();

function mapListing(raw) {
  const texts = raw.texts || {};
  const dept = raw.department || {};
  const location = raw.location || {};
  const theme = raw.primary_theme || {};
  const terms = (raw.terms || []).map((t) => t.text).join(', ');

  const deptId = dept.id || '';
  const deptName = DEPT_MAP[deptId] || deptId.replace(/^D_/, '');

  return {
    elx_id: raw.id,
    title: texts.title || '',
    professor: null,
    department: deptName,
    lab: null,
    description: texts.overview || texts.tagline || '',
    requirements: null,
    pay_or_credit: null,
    posted_date: raw.start_date || new Date().toISOString().slice(0, 10),
    source_url: raw.id
      ? `https://elx.mit.edu/opportunity/${raw.id}`
      : null,
    contact_email: null,
    is_active: raw.status?.id === 'L',
    theme: theme.text || '',
    terms,
    location: location.text || '',
    city: location.city || '',
    deadline_date: raw.deadline_date || null,
    start_date: raw.start_date || null,
    end_date: raw.end_date || null,
    source: 'elx.mit.edu',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

async function main() {
  let rawData;
  try {
    const json = readFileSync(RAW_JSON_PATH, 'utf-8');
    rawData = JSON.parse(json);
  } catch (err) {
    console.error(`Failed to read ${RAW_JSON_PATH}`);
    console.error('Run the scraper first: cd elx_scraper && python scripts/scrape_api.py');
    process.exit(1);
  }

  if (!Array.isArray(rawData)) {
    console.error('Expected an array in urops_raw.json');
    process.exit(1);
  }

  console.log(`Read ${rawData.length} listings from scraped data`);

  const listings = rawData.map(mapListing);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN ---');
    console.log(`Would import ${listings.length} listings`);
    console.log('\nSample (first 3):');
    for (const l of listings.slice(0, 3)) {
      console.log(`  • ${l.title}`);
      console.log(`    dept: ${l.department}, terms: ${l.terms}`);
      console.log(`    url: ${l.source_url}`);
    }
    const depts = [...new Set(listings.map((l) => l.department))].sort();
    console.log(`\nDepartments (${depts.length}): ${depts.join(', ')}`);
    process.exit(0);
  }

  const collection = await getListingsCollection();

  if (CLEAR) {
    const result = await collection.deleteMany({ source: 'elx.mit.edu' });
    console.log(`Cleared ${result.deletedCount} existing ELx listings`);
  }

  let inserted = 0;
  let updated = 0;

  for (const listing of listings) {
    const { created_at, ...updateFields } = listing;
    const result = await collection.updateOne(
      { elx_id: listing.elx_id },
      { $set: updateFields, $setOnInsert: { created_at: new Date() } },
      { upsert: true },
    );

    if (result.upsertedCount > 0) inserted++;
    else if (result.modifiedCount > 0) updated++;
  }

  console.log(`\nImport complete: ${inserted} new, ${updated} updated, ${listings.length} total`);

  await closeDatabaseConnection();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
