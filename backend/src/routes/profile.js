import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const RELEVANCE_SCRIPT = resolve(ROOT_DIR, 'Relevance', 'relavence_TFIDF_LSA.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || process.env.PYTHON || 'python';

const router = Router();

// Store file in memory (we'll save to temp disk + MongoDB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// Upload resume and store in MongoDB
router.post('/resume', requireAuth, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const db = await getDb();
    const users = db.collection('users');

    // Store PDF as base64 in MongoDB
    await users.updateOne(
      { googleId: req.user.googleId },
      {
        $set: {
          resume: {
            filename: req.file.originalname,
            data: req.file.buffer.toString('base64'),
            uploadedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    res.json({ ok: true, filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save resume', details: err.message });
  }
});

// Get resume info (not the file itself)
router.get('/resume', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { googleId: req.user.googleId },
      { projection: { 'resume.filename': 1, 'resume.uploadedAt': 1 } }
    );
    if (!user?.resume) return res.json({ resume: null });
    res.json({ resume: { filename: user.resume.filename, uploadedAt: user.resume.uploadedAt } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resume info', details: err.message });
  }
});

// Rank listings using stored resume
router.post('/resume/rank', requireAuth, async (req, res) => {
  const { top_k = 10 } = req.body;

  try {
    const db = await getDb();
    const user = await db.collection('users').findOne({ googleId: req.user.googleId });
    if (!user?.resume?.data) {
      return res.status(400).json({ error: 'No resume uploaded. Please upload your resume first.' });
    }

    // Write resume to a temp file for Python
    const tempPath = resolve(tmpdir(), `resume_${randomUUID()}.pdf`);
    await writeFile(tempPath, Buffer.from(user.resume.data, 'base64'));

    const topK = Math.min(50, Math.max(1, Number(top_k) || 10));
    const args = [RELEVANCE_SCRIPT, '--resume-path', tempPath, '--top-k', String(topK), '--json'];
    const ranker = spawn(PYTHON_EXECUTABLE, args, {
      cwd: ROOT_DIR,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    ranker.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    ranker.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    ranker.on('error', async (error) => {
      await unlink(tempPath).catch(() => {});
      res.status(500).json({ error: 'Failed to start resume ranker', details: error.message });
    });
    ranker.on('close', async (code) => {
      await unlink(tempPath).catch(() => {});
      if (code !== 0) {
        return res.status(500).json({ error: 'Resume ranker failed', details: stderr || `exit code ${code}` });
      }
      try {
        const jsonStart = stdout.indexOf('[');
        if (jsonStart === -1) {
          return res.status(500).json({ error: 'No JSON found in ranker output', stdout, stderr });
        }
        res.json({ results: JSON.parse(stdout.slice(jsonStart)) });
      } catch (e) {
        res.status(500).json({ error: 'Invalid JSON from ranker', details: e.message, stdout, stderr });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rank listings', details: err.message });
  }
});

export default router;
