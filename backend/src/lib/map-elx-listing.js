/**
 * Map raw ELx elo-v2 opportunity objects to our listing schema.
 * List responses usually omit structured pay/contact; we infer from text and
 * optionally use compensation IDs when present.
 */

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

/**
 * ELx's /lookups department text is not stable: the same real department id
 * can come back as a bare acronym on one scrape and a full (sometimes
 * differently-worded) long form on another, and some ids aren't in
 * /lookups at all and leak through as a raw code (e.g. "AEROASTRO"). Rather
 * than key off which id produced which text, this normalizes by whatever
 * variant text shows up — every key is a known spelling (lowercased),
 * mapped to one canonical "Long form (ACRONYM)" string.
 */
const DEPT_CANONICAL_BY_VARIANT = {
  aeroastro: 'Aeronautics and Astronautics (AeroAstro)',
  'aeronautics and astronautics': 'Aeronautics and Astronautics (AeroAstro)',
  arch: 'Architecture',
  architecture: 'Architecture',
  'b&cs': 'Brain and Cognitive Sciences (BCS)',
  bcs: 'Brain and Cognitive Sciences (BCS)',
  'brain & cognitive sciences': 'Brain and Cognitive Sciences (BCS)',
  'brain and cognitive sciences': 'Brain and Cognitive Sciences (BCS)',
  bioeng: 'Biological Engineering (BioE)',
  bioe: 'Biological Engineering (BioE)',
  'biological engineering': 'Biological Engineering (BioE)',
  biology: 'Biology',
  cee: 'Civil and Environmental Engineering (CEE)',
  'civil & environmental engineering': 'Civil and Environmental Engineering (CEE)',
  'civil and environmental engineering': 'Civil and Environmental Engineering (CEE)',
  cheme: 'Chemical Engineering (ChemE)',
  'chemical engineering': 'Chemical Engineering (ChemE)',
  chemistry: 'Chemistry',
  cis: 'Center for International Studies (CIS)',
  'center for international studies': 'Center for International Studies (CIS)',
  'center for international studies (cis)': 'Center for International Studies (CIS)',
  cms: 'Comparative Media Studies/Writing (CMS)',
  'comparative media studies/writing': 'Comparative Media Studies/Writing (CMS)',
  csail: 'Computer Science and Artificial Intelligence Laboratory (CSAIL)',
  'computer sci. & artificial int lab (csail)': 'Computer Science and Artificial Intelligence Laboratory (CSAIL)',
  ctl: 'Center for Transportation and Logistics (CTL)',
  'center for transportation & logistics': 'Center for Transportation and Logistics (CTL)',
  'center for transportation and logistics (ctl)': 'Center for Transportation and Logistics (CTL)',
  'd-lab': 'MIT D-Lab',
  dusp: 'Urban Studies and Planning (DUSP)',
  'urban studies & planning (dusp)': 'Urban Studies and Planning (DUSP)',
  eco: 'Economics',
  economics: 'Economics',
  edgerton: 'Edgerton Center',
  'edgerton center': 'Edgerton Center',
  eaps: 'Earth, Atmospheric and Planetary Sciences (EAPS)',
  'earth, atmospheric & planetary sci (eaps)': 'Earth, Atmospheric and Planetary Sciences (EAPS)',
  eecs: 'Electrical Engineering and Computer Science (EECS)',
  'electrical eng & computer sci (eecs)': 'Electrical Engineering and Computer Science (EECS)',
  history: 'History',
  imes: 'Institute for Medical Engineering and Science (IMES)',
  'institute for medical engineering and science (imes)': 'Institute for Medical Engineering and Science (IMES)',
  'kavli inst for astrophysics & space research': 'Kavli Institute for Astrophysics and Space Research',
  ki: 'Koch Institute for Integrative Cancer Research (KI)',
  'koch inst for integrative cancer res': 'Koch Institute for Integrative Cancer Research (KI)',
  'l&p': 'Linguistics and Philosophy (L&P)',
  'linguistics & philosophy': 'Linguistics and Philosophy (L&P)',
  lids: 'Laboratory for Information and Decision Systems (LIDS)',
  'laboratory for information & decision systems (lids)': 'Laboratory for Information and Decision Systems (LIDS)',
  lns: 'Laboratory for Nuclear Science (LNS)',
  'laboratory for nuclear sci (lns)': 'Laboratory for Nuclear Science (LNS)',
  maths: 'Mathematics',
  mathematics: 'Mathematics',
  meche: 'Mechanical Engineering (MechE)',
  'mechanical engineering': 'Mechanical Engineering (MechE)',
  media: 'Media Lab (MAS)',
  'media lab (mas)': 'Media Lab (MAS)',
  'media lab': 'Media Lab (MAS)',
  misti: 'MIT International Science and Technology Initiatives (MISTI)',
  mitei: 'MIT Energy Initiative (MITEI)',
  'mit energy initiative (mitei)': 'MIT Energy Initiative (MITEI)',
  dmse: 'Materials Science and Engineering (DMSE)',
  mse: 'Materials Science and Engineering (MSE)',
  'dept material science and engineering (dmse)': 'Materials Science and Engineering (DMSE)',
  nse: 'Nuclear Science and Engineering (NSE)',
  ole: 'Open Learning Enterprise',
  'open learning enterprise': 'Open Learning Enterprise',
  pilm: 'Picower Institute for Learning and Memory (PILM)',
  'picower inst for learning & memory': 'Picower Institute for Learning and Memory (PILM)',
  physics: 'Physics',
  polsci: 'Political Science',
  'political science': 'Political Science',
  psfc: 'Plasma Science and Fusion Center (PSFC)',
  'plasma science & fusion center (psfc)': 'Plasma Science and Fusion Center (PSFC)',
  rle: 'Research Laboratory of Electronics (RLE)',
  'research lab for electronics (rle)': 'Research Laboratory of Electronics (RLE)',
  school_eng: 'School of Engineering',
  'school of engineering': 'School of Engineering',
  scm: 'Supply Chain Management (SCM)',
  'supply chain management program (scm)': 'Supply Chain Management (SCM)',
  sloan: 'Sloan School of Management (Sloan)',
  'sloan school of management': 'Sloan School of Management (Sloan)',
  sts: 'Science, Technology, and Society (STS)',
  'program in science, technology, and society': 'Science, Technology, and Society (STS)',
  vpec: 'Vice President for Energy and Climate (VPEC)',
  'vice president for energy and climate': 'Vice President for Energy and Climate (VPEC)',
  idss: 'Institute for Data, Systems, and Society (IDSS)',
};

/** Normalizes one "X / Y" joint-affiliation department string part by part. */
function canonicalizeDeptName(rawText) {
  return rawText
    .split(' / ')
    .map((part) => DEPT_CANONICAL_BY_VARIANT[part.trim().toLowerCase()] || part.trim())
    .join(' / ');
}

/** MIT ELx /lookups compensations → pay category */
export function buildCompensationCategoryMap(lookupsBody) {
  const map = new Map();
  for (const c of lookupsBody?.compensations || []) {
    const t = (c.text || '').toLowerCase();
    if (t.includes('volunteer') || /^none\//i.test(c.text || '')) {
      map.set(c.id, null);
    } else if (t.includes('credit')) {
      map.set(c.id, 'credit');
    } else if (t.includes('pay') || t.includes('hourly') || t.includes('stipend')) {
      map.set(c.id, 'pay');
    }
  }
  return map;
}

function payCreditFromStructured(compensation, compLookup) {
  if (compensation == null || !compLookup?.size) return null;
  const ids = Array.isArray(compensation) ? compensation : [compensation];
  let hasPay = false;
  let hasCredit = false;
  for (const item of ids) {
    const id = typeof item === 'object' && item != null ? item.id : item;
    if (id === undefined || id === null) continue;
    const cat = compLookup.get(id);
    if (cat === 'pay') hasPay = true;
    if (cat === 'credit') hasCredit = true;
  }
  if (hasPay && hasCredit) return 'Both';
  if (hasPay) return 'Pay';
  if (hasCredit) return 'Credit';
  return null;
}

/**
 * Prefer @mit.edu, then other .edu, then first address.
 */
function extractContactEmail(overview, tagline) {
  const text = `${tagline || ''}\n${overview || ''}`;
  const matches = text.match(EMAIL_RE);
  if (!matches?.length) return null;

  const mit = matches.find((m) => m.toLowerCase().endsWith('@mit.edu'));
  if (mit) return mit.toLowerCase();

  const edu = matches.find((m) => /\.(edu|ac\.[a-z.]+)$/i.test(m));
  if (edu) return edu.toLowerCase();

  return matches[0].toLowerCase();
}

/**
 * Values must match filter UI: Pay | Credit | Both
 */
function inferPayOrCredit(overview, tagline) {
  const text = `${tagline || ''}\n${overview || ''}`;
  if (!text.trim()) return null;

  const pay =
    /\b(hourly|stipend|wage|salary|\/\s*hr\b|\$\s*\d)/i.test(text) ||
    /\bpaid\b/i.test(text) ||
    /\bcompensat/i.test(text) ||
    /\bUROP\s+direct\s+funding/i.test(text) ||
    /\bfunded\s+urop/i.test(text);

  const credit =
    /\bcredit[- ]bearing\b/i.test(text) ||
    /\bfor[- ]credit\b/i.test(text) ||
    /\bcourse\s+credit\b/i.test(text) ||
    /\bresearch\s+credit\b/i.test(text) ||
    /\bacademic\s+credit\b/i.test(text) ||
    /\bor\s+credit\b/i.test(text) ||
    /\bcredit\s+or\b/i.test(text) ||
    (/\bregister\s+for\b/i.test(text) && /\bcredit\b/i.test(text));

  const volunteerOnly =
    /\b(volunteer|unpaid|no\s+pay|without\s+pay|non[- ]paid)\b/i.test(text) &&
    !pay &&
    !credit;

  if (volunteerOnly) return null;
  if (pay && credit) return 'Both';
  if (pay) return 'Pay';
  if (credit) return 'Credit';
  return null;
}

/**
 * @param {object} raw - elo-v2 opportunity object
 * @param {Record<string, string>} deptMap - department id → display name
 * @param {Map<number, 'pay'|'credit'|null>} [compLookup] - from buildCompensationCategoryMap
 */
export function mapElxListing(raw, deptMap, compLookup) {
  const texts = raw.texts || {};
  const dept = raw.department || {};
  const location = raw.location || {};
  const theme = raw.primary_theme || {};
  const terms = (raw.terms || []).map((t) => t.text).join(', ');
  const overview = texts.overview || '';
  const tagline = texts.tagline || '';

  const deptId = dept.id || '';
  const rawDeptId = deptId.replace(/^D_/, '');
  const deptName = canonicalizeDeptName(deptMap[deptId] || rawDeptId);

  const structuredPay = payCreditFromStructured(raw.compensation, compLookup);
  const pay_or_credit = structuredPay ?? inferPayOrCredit(overview, tagline);
  const contact_email = extractContactEmail(overview, tagline);

  return {
    elx_id: raw.id,
    title: texts.title || '',
    professor: null,
    department: deptName,
    lab: null,
    description: overview || tagline || '',
    requirements: null,
    pay_or_credit,
    posted_date: raw.start_date || new Date().toISOString().slice(0, 10),
    source_url: raw.id ? `https://elx.mit.edu/opportunity/${raw.id}` : null,
    contact_email,
    is_active: raw.status?.id === 'L',
    theme: theme.text || '',
    terms,
    location: location.text || '',
    city: location.city || '',
    deadline_date: raw.deadline_date || null,
    start_date: raw.start_date || null,
    end_date: raw.end_date || null,
    source: 'elx.mit.edu',
    updated_at: new Date(),
  };
}
