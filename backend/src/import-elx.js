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
import { buildCompensationCategoryMap, mapElxListing } from './lib/map-elx-listing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_JSON_PATH = resolve(__dirname, '../../elx_scraper/data/urops_raw.json');
const LOOKUPS_PATH = resolve(__dirname, '../../elx_scraper/data/api_raw_full.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAR = args.includes('--clear');

function loadLookups() {
  try {
    const json = readFileSync(LOOKUPS_PATH, 'utf-8');
    const full = JSON.parse(json);
    const lookups = full?.lookups || {};
    const depts = lookups.departments || [];
    const deptMap = {};
    for (const d of depts) deptMap[d.id] = d.text;
    const compLookup = buildCompensationCategoryMap(lookups);
    console.log(`Loaded ${Object.keys(deptMap).length} department mappings`);
    return { deptMap, compLookup };
  } catch {
    console.warn('Could not load lookups — will use raw department IDs');
    return { deptMap: {}, compLookup: new Map() };
  }
}

const { deptMap: DEPT_MAP, compLookup: COMP_LOOKUP } = loadLookups();

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

  const listings = rawData.map((raw) => {
    const row = mapElxListing(raw, DEPT_MAP, COMP_LOOKUP);
    return { ...row, created_at: new Date(), updated_at: new Date() };
  });

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
