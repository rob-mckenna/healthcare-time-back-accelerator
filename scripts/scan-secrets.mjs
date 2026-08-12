#!/usr/bin/env node
/**
 * Secret and direct-identifier scan for the Second Shift accelerator.
 *
 * This is a backstop, not the primary control. The primary control is the
 * organization configuration schema, which requires environment variable *names*
 * rather than values, so a committed endpoint or key fails contract validation
 * before it reaches this scan. See ADR-20260812-006.
 *
 * Two families are scanned:
 *   - credential shaped values: keys, tokens, secrets, private keys, connection
 *     strings, bearer tokens, cloud access key identifiers
 *   - direct identifiers that must never appear in synthetic data or docs:
 *     national identification numbers, medical record numbers, email addresses,
 *     telephone numbers
 *
 * Zero dependencies. Exits non-zero on any finding.
 *
 * The rule table and `scanLine` are exported so tests can exercise adversarial
 * cases without writing a real-looking secret to disk (tests assemble the string
 * at runtime). The command-line scan runs only when this file is executed directly.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Scanned surface is every file eligible for the initial commit: everything
// already tracked plus everything untracked that is NOT excluded by
// .gitignore (see `listEligibleFiles` below, backed by `git ls-files`). This
// intentionally includes `.squad/`, `.github/`, and `.copilot/` — governance,
// workflow, and MCP configuration all ship with this repository and must be
// scanned like any other committed file. Only `.git` itself (never a file
// eligible for commit) is excluded outright. If `.gitignore` needs to exclude
// a directory from publication, that is a `.gitignore` decision, not a carve-out
// here — this scanner covers whatever git considers eligible to commit.
const HARD_SKIP_DIRS = new Set(['.git']);
const SKIP_FILES = new Set(['package-lock.json']);
const TEXT_EXTENSIONS = new Set([
  '.md', '.json', '.jsonl', '.mjs', '.js', '.cjs', '.ts', '.yaml', '.yml', '.txt',
  '.example', '.sample', '.template', '.env', '.ps1', '.sh', '.xml', '.csv', '.html', '.css',
]);

// This file necessarily contains the patterns it searches for.
const SELF = relative(ROOT, fileURLToPath(import.meta.url)).split(sep).join('/');

const rules = [
  {
    id: 'private-key-block',
    description: 'PEM private key block',
    re: /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/,
  },
  {
    id: 'assigned-credential',
    description: 'credential-shaped assignment with a literal value',
    re: /\b[A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)\b\s*[:=]\s*["']?(?!\s*$)(?!\$\{)(?!<)(?!\{\{)[^\s"',}]{12,}/i,
  },
  {
    id: 'cloud-access-key-id',
    description: 'cloud provider access key identifier',
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'bearer-token',
    description: 'literal bearer token',
    re: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/,
  },
  {
    id: 'json-web-token',
    description: 'JSON web token',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: 'connection-string',
    description: 'connection string with an embedded credential',
    re: /\b(?:AccountKey|SharedAccessSignature|Password|Pwd|User\s?Id)\s*=\s*[^;\s"']{6,}/i,
  },
  {
    id: 'sql-connection-uri',
    description: 'database connection URI with inline credentials',
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@"']+:[^\s/@"']+@[^\s"']+/i,
  },
  {
    id: 'national-identification-number',
    description: 'national identification number pattern',
    re: /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    id: 'medical-record-number',
    description: 'medical record number assignment',
    re: /\bMRN\s*[:=]\s*\S+/i,
  },
  {
    id: 'email-address',
    description: 'email address',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  },
  {
    id: 'telephone-number',
    description: 'telephone number',
    re: /(?:^|[\s(:="'])(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  },
];

// Narrowly scoped, documented exceptions. Each entry pins an exact file, line,
// and rule so the allowance cannot silently cover an unrelated finding added
// later in the same file — a fresh real secret on a different line still
// fails the scan. An allowance is a hole in the control, so each one records
// why the match is safe and is never added just to unblock a commit.
const allowances = [
  {
    file: '.github/skills/secret-handling/SKILL.md',
    line: 44,
    ruleId: 'assigned-credential',
    reason: 'Illustrative "pattern to avoid" example in a security-guidance skill file; "sk-proj-..." is a truncated, non-functional placeholder, not a live OpenAI key.',
  },
  {
    file: '.github/skills/secret-handling/SKILL.md',
    line: 45,
    ruleId: 'assigned-credential',
    reason: 'Illustrative "pattern to avoid" example; "super_secret_123" is a synthetic sample password documented as an anti-pattern, not a real credential.',
  },
  {
    file: '.github/skills/secret-handling/SKILL.md',
    line: 46,
    ruleId: 'sql-connection-uri',
    reason: 'Illustrative "pattern to avoid" example connection string in the same anti-pattern table; host and value are generic placeholders ("host", "db").',
  },
  {
    file: '.github/skills/secret-handling/SKILL.md',
    line: 48,
    ruleId: 'private-key-block',
    reason: 'The bare PEM header text is quoted only to document the private-key detection pattern; no key material follows it.',
  },
  {
    file: '.github/skills/secret-handling/SKILL.md',
    line: 72,
    ruleId: 'sql-connection-uri',
    reason: 'Illustrative example inside a Scribe pre-commit-block sample message; "localhost:5432/prod" is a generic placeholder, not a real connection string.',
  },
  {
    file: '.github/skills/secret-handling/SKILL.md',
    line: 121,
    ruleId: 'sql-connection-uri',
    reason: 'Illustrative example inside a "read .env.example" sample; "localhost:5432/db" is a generic placeholder, not a real connection string.',
  },
  {
    file: '.squad/templates/skills/secret-handling/SKILL.md',
    line: 44,
    ruleId: 'assigned-credential',
    reason: 'Template source for the skill above (installed copy is .github/skills/secret-handling/SKILL.md); same illustrative, non-functional placeholder.',
  },
  {
    file: '.squad/templates/skills/secret-handling/SKILL.md',
    line: 45,
    ruleId: 'assigned-credential',
    reason: 'Template source for the skill above; same synthetic sample password documented as an anti-pattern, not a real credential.',
  },
  {
    file: '.squad/templates/skills/secret-handling/SKILL.md',
    line: 46,
    ruleId: 'sql-connection-uri',
    reason: 'Template source for the skill above; same generic-placeholder connection string.',
  },
  {
    file: '.squad/templates/skills/secret-handling/SKILL.md',
    line: 48,
    ruleId: 'private-key-block',
    reason: 'Template source for the skill above; bare PEM header text with no key material, quoted only to document the detection pattern.',
  },
  {
    file: '.squad/templates/skills/secret-handling/SKILL.md',
    line: 72,
    ruleId: 'sql-connection-uri',
    reason: 'Template source for the skill above; same generic-placeholder connection string sample.',
  },
  {
    file: '.squad/templates/skills/secret-handling/SKILL.md',
    line: 121,
    ruleId: 'sql-connection-uri',
    reason: 'Template source for the skill above; same generic-placeholder connection string sample.',
  },
  {
    file: '.squad/templates/skills/gh-auth-isolation/SKILL.md',
    line: 57,
    ruleId: 'sql-connection-uri',
    reason: 'Illustrative shell example: the credential position is the shell variable "$token" (extracted at runtime via `gh auth token`), never a literal secret; "personaluser/repo.git" is a placeholder path.',
  },
  {
    file: '.squad/templates/skills/gh-auth-isolation/SKILL.md',
    line: 132,
    ruleId: 'sql-connection-uri',
    reason: 'Illustrative shell example: the credential position is the shell variable "$token", never a literal secret; "personaluser/personaluser.github.io.git" is a placeholder path.',
  },
  {
    file: '.squad/templates/skills/gh-auth-isolation/SKILL.md',
    line: 172,
    ruleId: 'sql-connection-uri',
    reason: 'Illustrative shell example: the credential position is the shell variable "$token", never a literal secret; "personaluser/repo.git" is a placeholder path.',
  },
];

function isAllowed(fileRel, ruleId, line) {
  return allowances.some((a) => a.file === fileRel && a.ruleId === ruleId && a.line === line);
}

// A placeholder is a value that is obviously not a secret: empty, angle
// bracketed, dollar-brace templated, handlebars templated, or a repeated marker.
const PLACEHOLDER_RE = /^\s*$|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}|\bREPLACE_ME\b|\bCHANGE_ME\b|\bPLACEHOLDER\b|\bEXAMPLE\b|x{8,}|\*{4,}/i;

// A credential-shaped assignment whose value contains a template interpolation is
// source code that computes a value at run time, so the characters on disk are not
// a committed secret. This narrows only the assigned-credential rule, and only when
// an interpolation is present; detection of literal values is unchanged, and no
// other rule consults it.
const RUNTIME_INTERPOLATION_RE = /\$\{/;

// GitHub issues `{id}+{username}@users.noreply.github.com` as a privacy-preserving
// placeholder address, not a direct identifier — this repository's own commit
// convention embeds the Copilot bot's noreply address in every commit trailer, and
// upstream Squad documentation embeds contributors' noreply addresses the same way.
// Narrows only the email-address rule, and only for this exact GitHub-issued shape.
const GITHUB_NOREPLY_EMAIL_RE = /@[A-Za-z0-9._%-]+\.noreply\.github\.com$/i;

/**
 * Scan a single line against every rule.
 *
 * @param {string} line
 * @param {object} [options]
 * @param {boolean} [options.isEnvExample] — apply the environment-example carve-out
 * @returns {Array<{ rule: string, description: string, excerpt: string }>}
 */
export function scanLine(line, options = {}) {
  const { isEnvExample = false } = options;
  const results = [];

  for (const rule of rules) {
    const match = line.match(rule.re);
    if (!match) continue;
    // An environment example may name variables; it may not carry values.
    if (isEnvExample && rule.id === 'assigned-credential') {
      const value = line.split('=').slice(1).join('=');
      if (PLACEHOLDER_RE.test(value)) continue;
    }
    if (rule.id === 'assigned-credential' && RUNTIME_INTERPOLATION_RE.test(match[0])) continue;
    if (rule.id === 'email-address') {
      if (GITHUB_NOREPLY_EMAIL_RE.test(match[0])) continue;
      // A match immediately followed by ':' or '/' is a git SSH-remote or
      // HTTPS-URL userinfo segment (e.g. `git@github.com:org/repo.git` or
      // `token@github.com/org/repo.git`), not a standalone email address.
      const nextChar = line[match.index + match[0].length];
      if (nextChar === ':' || nextChar === '/') continue;
    }
    if (PLACEHOLDER_RE.test(match[0])) continue;
    results.push({
      rule: rule.id,
      description: rule.description,
      excerpt: match[0].length > 60 ? `${match[0].slice(0, 57)}...` : match[0],
    });
  }
  return results;
}

export { rules };

// Fallback used only when `git` is unavailable or ROOT is not a git working
// tree. It has no knowledge of .gitignore, so it excludes the directories
// .gitignore already keeps out of every commit (dependencies, build/coverage
// output, and Squad's own local runtime state) to approximate the same
// "eligible for commit" surface. It is a safety net, not the primary path.
const FALLBACK_SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.nyc_output',
]);
const FALLBACK_SKIP_SQUAD_SUBDIRS = new Set([
  'orchestration-log', 'log', 'sessions', 'memory', 'identity', '.scratch', '.cache',
]);

function walkFallback(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split(sep).join('/');
    if (FALLBACK_SKIP_DIRS.has(entry)) continue;
    if (rel === '.squad/decisions/inbox' || FALLBACK_SKIP_SQUAD_SUBDIRS.has(entry) && rel.startsWith('.squad/')) continue;
    if (rel === '.squad-workstream' || entry === '.first-run') continue;
    if (statSync(full).isDirectory()) walkFallback(full, found);
    else if (!SKIP_FILES.has(entry)) found.push(full);
  }
  return found;
}

/**
 * List every file eligible for the initial commit: tracked files plus
 * untracked files that `.gitignore` (or other git excludes) does not exclude.
 * Backed by `git ls-files --cached --others --exclude-standard`, so it always
 * reflects the live `.gitignore`, not a hardcoded list. Falls back to a plain
 * filesystem walk (approximating the same excludes) if `git` is unavailable.
 *
 * @returns {string[]} absolute file paths
 */
function listEligibleFiles() {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }
    );
    const rel = output.split('\u0000').filter(Boolean);
    if (rel.length > 0) {
      return rel
        .map((r) => r.split('/').join(sep))
        .filter((r) => !r.split(sep).some((seg) => HARD_SKIP_DIRS.has(seg)))
        .map((r) => join(ROOT, r));
    }
  } catch {
    // git missing, ROOT is not a working tree, or the command failed — fall
    // back to a filesystem walk below rather than scanning nothing.
  }
  return walkFallback(ROOT);
}

/**
 * Scan the repository. Returns the findings and the surface actually covered.
 *
 * @returns {{ findings: object[], fileCount: number, scannedLines: number }}
 */
export function scanRepository() {
  const files = listEligibleFiles().filter((f) => {
    const ext = extname(f);
    const base = f.split(sep).pop();
    return TEXT_EXTENSIONS.has(ext) || base.startsWith('.env') || base === '.gitignore' || base === '.gitattributes';
  });

  const findings = [];
  let scannedLines = 0;

  for (const file of files) {
    const fileRel = relative(ROOT, file).split(sep).join('/');
    if (fileRel === SELF) continue;

    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) continue;

    const isEnvExample = /\.env\.(example|sample|template)$/.test(fileRel);
    const lines = text.split(/\r?\n/);
    scannedLines += lines.length;

    lines.forEach((line, index) => {
      for (const hit of scanLine(line, { isEnvExample })) {
        if (isAllowed(fileRel, hit.rule, index + 1)) continue;
        findings.push({ file: fileRel, line: index + 1, ...hit });
      }
    });
  }

  return { findings, fileCount: files.length, scannedLines };
}

function main() {
  const { findings, fileCount, scannedLines } = scanRepository();

  console.log('Secret and direct-identifier scan\n');
  console.log(`  Scanned ${fileCount} file(s), ${scannedLines} line(s).`);
  console.log(`  Applied ${rules.length} rule(s), ${allowances.length} documented allowance(s).\n`);

  if (findings.length === 0) {
    console.log('  PASS  no credential, connection string, or direct identifier found.');
    process.exit(0);
  }

  for (const finding of findings) {
    console.log(`  FAIL  ${finding.file}:${finding.line}  [${finding.rule}] ${finding.description}`);
    console.log(`        ${finding.excerpt}`);
  }
  console.error(`\n${findings.length} finding(s). Remove the value, or move it to an environment variable named in the organization pack.`);
  process.exit(1);
}

const invokedDirectly = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) main();

