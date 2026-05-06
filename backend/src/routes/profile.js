import { Router } from 'express';
import multer from 'multer';
import pdf from 'pdf-parse/lib/pdf-parse.js';
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

const PROFILE_FIELDS = ['major', 'year', 'interests', 'skills', 'bio', 'gpa'];

const KNOWN_SKILLS = [
  'python', 'java', 'javascript', 'typescript', 'c\\+\\+', 'c#', 'ruby', 'go',
  'rust', 'swift', 'kotlin', 'php', 'scala', 'r\\b', 'sql', 'html', 'css',
  'matlab', 'julia', 'perl', 'bash', 'shell',
  'react', 'angular', 'vue', 'node\\.js', 'express', 'django', 'flask',
  'spring', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'git', 'linux',
  'machine learning', 'deep learning', 'nlp', 'natural language processing',
  'computer vision', 'data analysis', 'data science', 'statistics',
  'solidworks', 'autocad', 'cad', 'pcb', 'fpga', 'verilog', 'vhdl',
  'labview', 'simulink', 'excel', 'tableau', 'power bi',
];

function parseResumeText(text) {
  const parsed = {};

  // GPA
  const gpaMatch = text.match(/GPA[:\s]*(\d\.\d{1,2})/i)
    || text.match(/(\d\.\d{1,2})\s*\/\s*4\.0/i);
  if (gpaMatch) parsed.gpa = gpaMatch[1];

  // Graduation year
  const yearMatch = text.match(/(?:expected|class of|graduation)[:\s,]*(?:(?:spring|fall|summer|winter|may|june|december|january)\s*)?(\d{4})/i)
    || text.match(/(?:spring|fall|summer|winter|may|june|december|january)\s+(\d{4})/i);
  if (yearMatch) parsed.year = yearMatch[1];

  // Major — look for degree patterns
  const majorPatterns = [
    /(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|Ph\.?D\.?)\s+(?:in\s+)?(.+?)(?:\n|,|\||;|$)/im,
    /Major[:\s]+(.+?)(?:\n|,|\||;|$)/im,
    /(?:Bachelor|Master)(?:'?s?)?\s+(?:of\s+\w+\s+)?in\s+(.+?)(?:\n|,|\||;|$)/im,
  ];
  for (const pattern of majorPatterns) {
    const m = text.match(pattern);
    if (m) {
      parsed.major = m[1].trim().replace(/\s+/g, ' ').slice(0, 100);
      break;
    }
  }

  // Skills — match against known list + look for Skills section
  const skillsSet = new Set();
  const skillsPattern = new RegExp(`\\b(${KNOWN_SKILLS.join('|')})\\b`, 'gi');
  for (const m of text.matchAll(skillsPattern)) {
    skillsSet.add(m[1].toLowerCase().replace(/\\/, ''));
  }

  const skillsSectionMatch = text.match(/(?:skills|technical skills|technologies)[:\s]*\n?([\s\S]*?)(?:\n\s*\n|\n[A-Z])/i);
  if (skillsSectionMatch) {
    const items = skillsSectionMatch[1]
      .split(/[,;•\-|\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 40);
    items.forEach(s => skillsSet.add(s.toLowerCase()));
  }
  if (skillsSet.size > 0) parsed.skills = [...skillsSet].slice(0, 30);

  // Research interests — look for Research section
  const researchMatch = text.match(/(?:research\s+interests?|areas?\s+of\s+interest)[:\s]*\n?([\s\S]*?)(?:\n\s*\n|\n[A-Z])/i);
  if (researchMatch) {
    const items = researchMatch[1]
      .split(/[,;•\-|\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 60);
    if (items.length > 0) parsed.interests = items.slice(0, 15);
  }

  return parsed;
}

// Update profile fields
router.put('/', requireAuth, async (req, res) => {
  try {
    const updates = {};
    for (const field of PROFILE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const db = await getDb();
    await db.collection('users').updateOne(
      { googleId: req.user.googleId },
      { $set: updates },
      { upsert: true }
    );
    res.json({ ok: true, updated: Object.keys(updates) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

// Get profile fields
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { googleId: req.user.googleId },
      { projection: { major: 1, year: 1, interests: 1, skills: 1, bio: 1, gpa: 1 } }
    );
    if (!user) return res.json({ profile: null });
    const { _id, ...profile } = user;
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

// Upload resume, store in MongoDB, and auto-parse
router.post('/resume', requireAuth, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const db = await getDb();
    const users = db.collection('users');

    // Extract text from PDF
    let parsedFields = {};
    try {
      const pdfData = await pdf(req.file.buffer);
      parsedFields = parseResumeText(pdfData.text);
    } catch (_) {
      // PDF parsing failed — still save the file, just skip auto-fill
    }

    const updateDoc = {
      resume: {
        filename: req.file.originalname,
        data: req.file.buffer.toString('base64'),
        uploadedAt: new Date(),
      },
    };

    // Only auto-fill fields that are currently empty
    const existingUser = await users.findOne({ googleId: req.user.googleId });
    for (const [key, value] of Object.entries(parsedFields)) {
      const existing = existingUser?.[key];
      const isEmpty = existing === undefined || existing === null || existing === ''
        || (Array.isArray(existing) && existing.length === 0);
      if (isEmpty) updateDoc[key] = value;
    }

    await users.updateOne(
      { googleId: req.user.googleId },
      { $set: updateDoc },
      { upsert: true }
    );

    res.json({ ok: true, filename: req.file.originalname, parsed: parsedFields });
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
