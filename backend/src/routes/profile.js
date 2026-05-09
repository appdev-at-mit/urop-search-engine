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

const PROFILE_FIELDS = ['major', 'year', 'interests', 'skills', 'bio', 'gpa', 'experience'];

const KNOWN_SKILLS_PLAIN = [
  'python', 'java', 'javascript', 'typescript', 'ruby', 'go',
  'rust', 'swift', 'kotlin', 'php', 'scala', 'sql', 'html', 'css',
  'matlab', 'julia', 'perl', 'bash', 'shell',
  'react', 'angular', 'vue', 'express', 'django', 'flask',
  'spring', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'git', 'linux',
  'machine learning', 'deep learning', 'nlp', 'natural language processing',
  'computer vision', 'data analysis', 'data science', 'statistics',
  'solidworks', 'autocad', 'cad', 'pcb', 'fpga', 'verilog', 'vhdl',
  'labview', 'simulink', 'excel', 'tableau', 'power bi',
];

const KNOWN_SKILLS_SPECIAL = [
  { pattern: /\bc\+\+/gi, name: 'c++' },
  { pattern: /\bc#/gi, name: 'c#' },
  { pattern: /\bnode\.js/gi, name: 'node.js' },
  { pattern: /\bR(?=[\s,;|)\]}]|$)/g, name: 'r' },
];

const SECTION_HEADERS = /^(?:education|experience|projects|publications|awards|honors|activities|certifications|work|employment|leadership|references|coursework|courses)\b/im;

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_TOKEN = `(?:${MONTH}\\.?\\s*\\d{4}|\\d{4}|present|current|ongoing)`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:[-–—]|to)\\s*(${DATE_TOKEN})`, 'i');

const LOCATION_SUFFIX_RE = /^(.+?)((?:[A-Z][a-z]+,\s*[A-Z]{2})|Remote)$/;

function extractSection(text, headerPattern) {
  const match = text.match(headerPattern);
  if (!match) return null;
  let body = text.slice(match.index + match[0].length);
  const nextHeader = body.search(SECTION_HEADERS);
  if (nextHeader > 0) body = body.slice(0, nextHeader);
  return body.trim();
}

function parseExperienceEntries(sectionText) {
  const entries = [];
  const lines = sectionText.split('\n').map(l => l.trim()).filter(Boolean);
  let current = null;

  for (const line of lines) {
    const dateMatch = line.match(DATE_RANGE_RE);
    const isBullet = /^[•·\u2022\-\*▪]/.test(line);

    if (dateMatch && !isBullet) {
      if (current) entries.push(current);
      const textBeforeDate = line.slice(0, dateMatch.index).trim().replace(/[,|]+$/, '').trim();
      current = {
        id: randomUUID(),
        title: '',
        organization: '',
        startDate: dateMatch[1],
        endDate: dateMatch[2],
        description: '',
      };
      if (textBeforeDate) current.organization = textBeforeDate;
    } else if (current) {
      if (isBullet) {
        const bullet = line.replace(/^[•·\u2022\-\*▪]\s*/, '');
        current.description += (current.description ? '\n' : '') + bullet;
      } else if (!current.title) {
        const locMatch = line.match(LOCATION_SUFFIX_RE);
        current.title = locMatch ? locMatch[1].trim() : line;
      }
    }
  }
  if (current) entries.push(current);

  return entries
    .filter(e => e.title || e.organization)
    .slice(0, 10);
}

function parseResumeText(text) {
  const parsed = {};

  // Bio — extract from Summary / Objective / Profile section
  const bioSection = extractSection(text, /^(?:summary|objective|about|profile|about\s+me)[:\s]*\n?/im);
  if (bioSection) {
    const bio = bioSection.split('\n').map(l => l.trim()).filter(Boolean).join(' ').slice(0, 500);
    if (bio.length > 10) parsed.bio = bio;
  }

  // GPA
  const gpaMatch = text.match(/(?:cumulative\s+)?GPA[:\s]*(\d\.\d{1,2})/i)
    || text.match(/(\d\.\d{1,2})\s*\/\s*4\.0{0,2}/i);
  if (gpaMatch) parsed.gpa = gpaMatch[1];

  // Graduation year (handles PDFs that concatenate words: "EngineeringGraduating May 2028")
  const yearMatch = text.match(/(?:expected|class of|graduation|graduating)\s*[:\s,]*(?:(?:spring|fall|summer|winter|may|june|december|january)\s*)?(\d{4})/i)
    || text.match(/(?:spring|fall|summer|winter|may|june|december|january)\s+(\d{4})/i);
  if (yearMatch) parsed.year = yearMatch[1];

  // Major (including MIT's S.B. format)
  const majorPatterns = [
    /(?:S\.?B\.?|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?Eng\.?|M\.?A\.?|Ph\.?D\.?)\s+(?:in\s+)?(.+?)(?:\n|,|\||;|$)/im,
    /Major[:\s]+(.+?)(?:\n|,|\||;|$)/im,
    /(?:Bachelor|Master)(?:'?s?)?\s+(?:of\s+\w+\s+)?in\s+(.+?)(?:\n|,|\||;|$)/im,
    /Course\s+(\d{1,2}(?:-\d{1,2})?)\b/i,
  ];
  for (const pattern of majorPatterns) {
    const m = text.match(pattern);
    if (m) {
      parsed.major = m[1].trim().replace(/\s+/g, ' ').slice(0, 100);
      break;
    }
  }

  // Experience — structured entries
  const expSection = extractSection(
    text,
    /^(?:(?:research|work|professional|relevant)\s+)?experience[:\s]*\n?/im,
  );
  if (expSection) {
    const entries = parseExperienceEntries(expSection);
    if (entries.length > 0) parsed.experience = entries;
  }

  // Skills
  const skillsSet = new Set();
  const plainPattern = new RegExp(`\\b(${KNOWN_SKILLS_PLAIN.join('|')})\\b`, 'gi');
  for (const m of text.matchAll(plainPattern)) {
    skillsSet.add(m[1].toLowerCase());
  }
  for (const { pattern, name } of KNOWN_SKILLS_SPECIAL) {
    if (pattern.test(text)) skillsSet.add(name);
    pattern.lastIndex = 0;
  }
  const skillsSectionMatch = text.match(
    /(?:skills|technical skills|technologies|proficiencies)[:\s]*\n?([\s\S]*?)(?:\n\s*\n|$)/i
  );
  if (skillsSectionMatch) {
    let sectionText = skillsSectionMatch[1];
    const headerIdx = sectionText.search(SECTION_HEADERS);
    if (headerIdx > 0) sectionText = sectionText.slice(0, headerIdx);
    const items = sectionText
      .split(/[,;•·\u2022\-|\n:\/]+/)
      .map(s => s.trim().replace(/^\(|\)$/g, ''))
      .filter(s => s.length > 1 && s.length < 40);
    items.forEach(s => skillsSet.add(s.toLowerCase()));
  }
  if (skillsSet.size > 0) parsed.skills = [...skillsSet].slice(0, 30);

  // Research interests
  const researchMatch = text.match(
    /(?:research\s+interests?|areas?\s+of\s+interest)[:\s]*\n?([\s\S]*?)(?:\n\s*\n|$)/i
  );
  if (researchMatch) {
    let sectionText = researchMatch[1];
    const headerIdx = sectionText.search(SECTION_HEADERS);
    if (headerIdx > 0) sectionText = sectionText.slice(0, headerIdx);
    const items = sectionText
      .split(/[,;•·\u2022\-|\n]+/)
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
      { projection: { major: 1, year: 1, interests: 1, skills: 1, bio: 1, gpa: 1, experience: 1 } }
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

    let parsedFields = {};
    let parseError = null;
    try {
      const pdfData = await pdf(req.file.buffer);
      if (!pdfData.text || pdfData.text.trim().length === 0) {
        parseError = 'Could not extract text from PDF — it may be image-based or scanned.';
      } else {
        parsedFields = parseResumeText(pdfData.text);
      }
    } catch (e) {
      parseError = `PDF text extraction failed: ${e.message}`;
    }

    const updateDoc = {
      resume: {
        filename: req.file.originalname,
        data: req.file.buffer.toString('base64'),
        uploadedAt: new Date(),
      },
    };

    // Auto-fill all parsed fields (overwrite previous values from resume parsing)
    for (const [key, value] of Object.entries(parsedFields)) {
      updateDoc[key] = value;
    }

    await users.updateOne(
      { googleId: req.user.googleId },
      { $set: updateDoc },
      { upsert: true }
    );

    res.json({
      ok: true,
      filename: req.file.originalname,
      parsed: parsedFields,
      parseError,
    });
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
