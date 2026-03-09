import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const {
    q = '',
    department = '',
    pay_or_credit = '',
    page = '1',
    limit = '20',
    sort = 'recent',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let query;
  let countQuery;
  let params;

  if (q) {
    const ftsQuery = q
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(' OR ');

    let where = 'WHERE l.id IN (SELECT rowid FROM listings_fts WHERE listings_fts MATCH ?) AND l.is_active = 1';
    params = [ftsQuery];

    if (department) {
      where += ' AND l.department LIKE ?';
      params.push(`%${department}%`);
    }
    if (pay_or_credit) {
      where += ' AND l.pay_or_credit = ?';
      params.push(pay_or_credit);
    }

    countQuery = `SELECT COUNT(*) as total FROM listings l ${where}`;

    const orderBy = sort === 'title' ? 'l.title ASC' : 'l.posted_date DESC';
    query = `SELECT l.* FROM listings l ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
  } else {
    let where = 'WHERE l.is_active = 1';
    params = [];

    if (department) {
      where += ' AND l.department LIKE ?';
      params.push(`%${department}%`);
    }
    if (pay_or_credit) {
      where += ' AND l.pay_or_credit = ?';
      params.push(pay_or_credit);
    }

    countQuery = `SELECT COUNT(*) as total FROM listings l ${where}`;

    const orderBy = sort === 'title' ? 'l.title ASC' : 'l.posted_date DESC';
    query = `SELECT l.* FROM listings l ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
  }

  const countParams = params.slice(0, -2);
  const { total } = db.prepare(countQuery).get(...countParams);
  const listings = db.prepare(query).all(...params);

  res.json({
    listings,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

router.get('/departments', (_req, res) => {
  const departments = db
    .prepare(
      `SELECT DISTINCT department FROM listings WHERE is_active = 1 AND department IS NOT NULL ORDER BY department`
    )
    .all()
    .map((row) => row.department);
  res.json(departments);
});

router.get('/:id', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  res.json(listing);
});

export default router;
