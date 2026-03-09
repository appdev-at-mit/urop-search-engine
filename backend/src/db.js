import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'urop.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    professor TEXT,
    department TEXT,
    lab TEXT,
    description TEXT,
    requirements TEXT,
    pay_or_credit TEXT,
    posted_date TEXT,
    source_url TEXT,
    contact_email TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
    title, professor, department, lab, description, requirements,
    content='listings',
    content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS listings_ai AFTER INSERT ON listings BEGIN
    INSERT INTO listings_fts(rowid, title, professor, department, lab, description, requirements)
    VALUES (new.id, new.title, new.professor, new.department, new.lab, new.description, new.requirements);
  END;

  CREATE TRIGGER IF NOT EXISTS listings_ad AFTER DELETE ON listings BEGIN
    INSERT INTO listings_fts(listings_fts, rowid, title, professor, department, lab, description, requirements)
    VALUES ('delete', old.id, old.title, old.professor, old.department, old.lab, old.description, old.requirements);
  END;

  CREATE TRIGGER IF NOT EXISTS listings_au AFTER UPDATE ON listings BEGIN
    INSERT INTO listings_fts(listings_fts, rowid, title, professor, department, lab, description, requirements)
    VALUES ('delete', old.id, old.title, old.professor, old.department, old.lab, old.description, old.requirements);
    INSERT INTO listings_fts(rowid, title, professor, department, lab, description, requirements)
    VALUES (new.id, new.title, new.professor, new.department, new.lab, new.description, new.requirements);
  END;
`);

export default db;
