/**
 * WP-03 validation — instruction digest check.
 *
 * Verifies that:
 *   1. The instruction manifest exists and is parseable.
 *   2. The SHA-256 recorded in the manifest matches the current content of
 *      system.md.
 *   3. The version in the manifest is a valid semantic version.
 *
 * Exit code 0 on success. Exit code 1 on any failure.
 *
 * Usage:
 *   node agent/evaluation/check-instruction-digest.mjs
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const INSTRUCTION_DIR = join(ROOT, 'agent', 'instructions', 'shift-closeout', 'v1.0.0');
const MANIFEST_PATH = join(INSTRUCTION_DIR, 'manifest.json');
const SYSTEM_PATH = join(INSTRUCTION_DIR, 'system.md');

const failures = [];
const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok });
  if (!ok) failures.push(`${name}: ${detail}`);
}

// --- 1. manifest exists and parses ------------------------------------------
let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  record('manifest parseable', true);
} catch (err) {
  record('manifest parseable', false, err.message);
  // Cannot proceed without the manifest.
  console.error('FAIL  manifest parseable');
  console.error(`\n1/1 checks failed: ${failures[0]}`);
  process.exit(1);
}

// --- 2. manifest has required fields ----------------------------------------
record(
  'manifest has version',
  typeof manifest.version === 'string' && /^\d+\.\d+\.\d+$/.test(manifest.version),
  `version is ${JSON.stringify(manifest.version)}`
);

record(
  'manifest has instructionFile',
  manifest.instructionFile === 'system.md',
  `instructionFile is ${JSON.stringify(manifest.instructionFile)}`
);

record(
  'manifest has instructionSha256',
  typeof manifest.instructionSha256 === 'string' && /^[a-f0-9]{64}$/.test(manifest.instructionSha256),
  `instructionSha256 is ${JSON.stringify(manifest.instructionSha256)}`
);

record(
  'manifest has outputContractVersion',
  typeof manifest.outputContractVersion === 'string' && /^\d+\.\d+\.\d+$/.test(manifest.outputContractVersion),
  `outputContractVersion is ${JSON.stringify(manifest.outputContractVersion)}`
);

// --- 3. system.md exists and digest matches ---------------------------------
let systemContent;
try {
  systemContent = readFileSync(SYSTEM_PATH);
  record('system.md readable', true);
} catch (err) {
  record('system.md readable', false, err.message);
}

if (systemContent) {
  const actualDigest = createHash('sha256').update(systemContent).digest('hex');
  record(
    'digest matches manifest',
    actualDigest === manifest.instructionSha256,
    `manifest records ${manifest.instructionSha256}, actual content hashes to ${actualDigest}`
  );
}

// --- 4. report ---------------------------------------------------------------
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}`);
}
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} instruction digest checks passed`);

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
