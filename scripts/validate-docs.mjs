#!/usr/bin/env node
/**
 * Documentation validation for the Second Shift accelerator baseline.
 *
 * Checks, in order:
 *   1. every required baseline document exists and is non-trivial
 *   2. every relative Markdown link resolves to a file that exists
 *   3. no phrase from docs/conventions/prohibited-claims.json appears in prose
 *   4. any document presenting time-back figures also carries ILLUSTRATIVE
 *   5. every accepted ADR carries the field set required by SQUAD_BOOTSTRAP.md
 *
 * Zero dependencies. Exits non-zero on any failure.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.squad', '.copilot']);

const results = [];
let failed = 0;

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    failed += 1;
    results.push({ name, ok: false, detail: error.message });
  }
}

function walk(dir, predicate, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, predicate, found);
    else if (predicate(full)) found.push(full);
  }
  return found;
}

const markdownFiles = walk(ROOT, (f) => f.toLowerCase().endsWith('.md'))
  // SQUAD_BOOTSTRAP.md is human-owned and read-only; it is never modified or
  // failed by this tool.
  .filter((f) => relative(ROOT, f) !== 'SQUAD_BOOTSTRAP.md');

const rel = (f) => relative(ROOT, f).split(sep).join('/');

/* 1. required documents ---------------------------------------------------- */

const REQUIRED_DOCS = [
  'docs/README.md',
  'docs/traceability/requirements-matrix.md',
  'docs/risks.md',
  'docs/assumptions.md',
  'docs/plan/p0-execution-plan.md',
  'docs/architecture/decisions/README.md',
  'docs/architecture/diagrams/README.md',
  'docs/conventions/correlation-id.md',
  'docs/conventions/draft-and-safety-status.md',
  'docs/conventions/prohibited-claims.json',
  'contracts/README.md',
  'config/README.md',
];

for (const doc of REQUIRED_DOCS) {
  check(`required document: ${doc}`, () => {
    const full = join(ROOT, doc);
    if (!existsSync(full)) throw new Error('missing');
    const size = statSync(full).size;
    if (size < 400) throw new Error(`present but only ${size} bytes; looks like a placeholder`);
    return `${size} bytes`;
  });
}

/* 2. relative link resolution ---------------------------------------------- */

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

check('relative Markdown links resolve', () => {
  const broken = [];
  let linkCount = 0;
  for (const file of markdownFiles) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(LINK_RE)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      linkCount += 1;
      const [path] = target.split('#');
      if (!path) continue;
      const resolved = resolve(dirname(file), path);
      if (!existsSync(resolved)) broken.push(`${rel(file)} -> ${target}`);
    }
  }
  if (broken.length) throw new Error(`${broken.length} broken link(s):\n      ${broken.join('\n      ')}`);
  return `${linkCount} relative link(s) across ${markdownFiles.length} file(s)`;
});

/* 3. prohibited claims ------------------------------------------------------ */

const claimsPath = join(ROOT, 'docs/conventions/prohibited-claims.json');
const claims = JSON.parse(readFileSync(claimsPath, 'utf8'));

check('prohibited-claims.json is well formed', () => {
  if (!Array.isArray(claims.prohibited) || claims.prohibited.length === 0) {
    throw new Error('prohibited list is empty');
  }
  for (const entry of claims.prohibited) {
    if (!entry.phrase || !entry.reason || !entry.useInstead) {
      throw new Error(`entry missing phrase, reason, or useInstead: ${JSON.stringify(entry)}`);
    }
  }
  return `${claims.prohibited.length} prohibited phrase(s)`;
});

check('no prohibited claim appears in Markdown prose', () => {
  const hits = [];
  for (const file of markdownFiles) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      for (const entry of claims.prohibited) {
        if (lower.includes(entry.phrase.toLowerCase())) {
          hits.push(`${rel(file)}:${index + 1} "${entry.phrase}" — ${entry.useInstead}`);
        }
      }
    });
  }
  if (hits.length) throw new Error(`${hits.length} prohibited claim(s):\n      ${hits.join('\n      ')}`);
  return `${markdownFiles.length} file(s) clean`;
});

/* 4. illustrative labelling ------------------------------------------------- */

// A document that quotes a duration saved, minutes returned, or a time-back
// figure must also carry the ILLUSTRATIVE label somewhere in the same document.
const TIME_BACK_RE =
  /\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b[^.\n]{0,60}\b(saved|returned|back|reduction|faster)\b/i;

check('time-back figures carry the ILLUSTRATIVE label', () => {
  const offenders = [];
  let labelled = 0;
  for (const file of markdownFiles) {
    const text = readFileSync(file, 'utf8');
    if (!TIME_BACK_RE.test(text)) continue;
    if (text.includes('ILLUSTRATIVE')) labelled += 1;
    else offenders.push(rel(file));
  }
  if (offenders.length) {
    throw new Error(`time-back figures without an ILLUSTRATIVE label: ${offenders.join(', ')}`);
  }
  return labelled ? `${labelled} document(s) with figures, all labelled` : 'no time-back figures present yet';
});

/* 5. ADR field completeness ------------------------------------------------- */

const ADR_DIR = join(ROOT, 'docs/architecture/decisions');
const ADR_FIELDS = [
  'Status:',
  'Owner:',
  'Requirement IDs:',
  'Context',
  'Decision',
  'Alternatives',
  'Consequences',
  'Healthcare, privacy, security, and data impact',
  'Validation evidence',
  'Supersedes',
];

check('ADRs carry the charter field set', () => {
  const adrs = readdirSync(ADR_DIR).filter((f) => /^ADR-\d{8}-\d{3}\.md$/.test(f));
  if (adrs.length === 0) throw new Error('no ADR files found');
  const problems = [];
  for (const adr of adrs) {
    const text = readFileSync(join(ADR_DIR, adr), 'utf8');
    const missing = ADR_FIELDS.filter((field) => !text.includes(field));
    if (missing.length) problems.push(`${adr}: missing ${missing.join(', ')}`);
  }
  if (problems.length) throw new Error(problems.join('\n      '));
  return `${adrs.length} ADR(s) complete`;
});

check('every ADR is listed in the decisions index', () => {
  const adrs = readdirSync(ADR_DIR).filter((f) => /^ADR-\d{8}-\d{3}\.md$/.test(f));
  const index = readFileSync(join(ADR_DIR, 'README.md'), 'utf8');
  const unlisted = adrs.filter((adr) => !index.includes(adr));
  if (unlisted.length) throw new Error(`not listed in README.md: ${unlisted.join(', ')}`);
  return `${adrs.length} ADR(s) indexed`;
});

/* 6. requirement identifier hygiene ----------------------------------------- */

check('requirement IDs referenced in docs are defined in the matrix', () => {
  const matrix = readFileSync(join(ROOT, 'docs/traceability/requirements-matrix.md'), 'utf8');
  const defined = new Set(matrix.match(/\bREQ-[A-Z]+-\d{3}\b/g) || []);
  if (defined.size === 0) throw new Error('no requirement IDs found in the matrix');
  const undefinedRefs = new Map();
  for (const file of markdownFiles) {
    if (rel(file) === 'docs/traceability/requirements-matrix.md') continue;
    const text = readFileSync(file, 'utf8');
    for (const id of text.match(/\bREQ-[A-Z]+-\d{3}\b/g) || []) {
      if (!defined.has(id)) {
        if (!undefinedRefs.has(id)) undefinedRefs.set(id, rel(file));
      }
    }
  }
  if (undefinedRefs.size) {
    const list = [...undefinedRefs].map(([id, where]) => `${id} (${where})`).join(', ');
    throw new Error(`referenced but not defined in the matrix: ${list}`);
  }
  return `${defined.size} requirement ID(s) defined`;
});

/* report -------------------------------------------------------------------- */

console.log('Documentation validation\n');
for (const result of results) {
  console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `\n        ${result.detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} documentation checks passed.`);

if (failed > 0) {
  console.error(`\n${failed} documentation check(s) failed.`);
  process.exit(1);
}
