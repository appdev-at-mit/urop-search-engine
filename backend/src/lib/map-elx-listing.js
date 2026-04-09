/**
 * Map raw ELx elo-v2 opportunity objects to our listing schema.
 * List responses usually omit structured pay/contact; we infer from text and
 * optionally use compensation IDs when present.
 */

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

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
export function extractContactEmail(overview, tagline) {
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
export function inferPayOrCredit(overview, tagline) {
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
  const deptName = deptMap[deptId] || deptId.replace(/^D_/, '');

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
