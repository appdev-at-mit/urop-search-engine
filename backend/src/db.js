import { MongoClient } from 'mongodb';

const DEFAULT_DB_NAME = 'urop_search_engine';
const DEFAULT_COLLECTION_NAME = 'listings';
const LABS_COLLECTION_NAME = 'labs';

let client;
let database;

export async function connectToDatabase() {
  if (database) {
    return database;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI environment variable.');
  }

  if (!client) {
    client = new MongoClient(mongoUri);
  }

  await client.connect();
  const dbName = process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME;
  database = client.db(dbName);

  await database.collection(DEFAULT_COLLECTION_NAME).createIndexes([
    { key: { is_active: 1, posted_date: -1 } },
    { key: { title: 'text', professor: 'text', department: 'text', lab: 'text', description: 'text', requirements: 'text' } },
  ]);

  await database.collection(LABS_COLLECTION_NAME).createIndexes([
    { key: { name: 'text', pi: 'text', description: 'text' } },
    { key: { parent_org: 1 } },
    { key: { department: 1 } },
    { key: { research_areas: 1 } },
  ]);

  return database;
}

export async function getListingsCollection() {
  const db = await connectToDatabase();
  return db.collection(DEFAULT_COLLECTION_NAME);
}

export async function getLabsCollection() {
  const db = await connectToDatabase();
  return db.collection(LABS_COLLECTION_NAME);
}

export async function getDb() {
  return connectToDatabase();
}


export async function closeDatabaseConnection() {
  if (!client) {
    return;
  }
  await client.close();
  client = undefined;
  database = undefined;
}
