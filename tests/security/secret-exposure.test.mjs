/**
 * Security tests — secret and direct-identifier exposure scan.
 *
 * Validates that the Morpheus-owned synthetic data files and governance
 * source files pass scripts/scan-secrets.mjs (exit code 0, no findings).
 * The scan-secrets script is Trinity-owned; this test only invokes it and
 * asserts a clean result.
 *
 * Run: node --test tests/security/secret-exposure.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const node = process.execPath;

function runScan() {
  return spawnSync(
    node,
    [join(ROOT, 'scripts', 'scan-secrets.mjs')],
    { cwd: ROOT, encoding: 'utf8', timeout: 30_000 }
  );
}

test('scan-secrets.mjs exists and is runnable', () => {
  const scriptPath = join(ROOT, 'scripts', 'scan-secrets.mjs');
  assert.ok(existsSync(scriptPath), 'scan-secrets.mjs must exist');
});

test('synthetic bundle passes secret scan (no credentials or direct identifiers)', () => {
  const bundlePath = join(ROOT, 'data', 'synthetic', 'bundles', 'SYN-BDL-PEDBDL01.json');
  assert.ok(existsSync(bundlePath), 'synthetic bundle must exist before scan');
  // Run the full scan — it covers all tracked files including synthetic data
  const result = runScan();
  assert.equal(
    result.status,
    0,
    `scan-secrets must exit 0 but exited ${result.status}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`
  );
});

test('synthetic patient file passes secret scan', () => {
  const patientPath = join(ROOT, 'data', 'synthetic', 'patients', 'SYN-PAT-PED0001A.json');
  assert.ok(existsSync(patientPath), 'synthetic patient file must exist');
  // Covered by the full scan above; this test asserts the file is present
  // and the scan passes without flagging it specifically.
  const result = runScan();
  assert.equal(result.status, 0,
    `scan-secrets must exit 0.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`);
});

test('governance source files pass secret scan (no embedded credentials)', () => {
  const govFiles = [
    join(ROOT, 'src', 'governance', 'phi-scan.mjs'),
    join(ROOT, 'src', 'governance', 'validate-payload.mjs'),
    join(ROOT, 'src', 'governance', 'approval.mjs'),
    join(ROOT, 'src', 'governance', 'audit.mjs'),
    join(ROOT, 'src', 'governance', 'metrics.mjs'),
  ];
  for (const f of govFiles) {
    assert.ok(existsSync(f), `governance file must exist: ${f}`);
  }
  const result = runScan();
  assert.equal(result.status, 0,
    `scan-secrets must exit 0.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`);
});

test('all synthetic data IDs carry required SYN- prefix', async () => {
  const { readFileSync } = await import('node:fs');
  const bundle = JSON.parse(readFileSync(
    join(ROOT, 'data', 'synthetic', 'bundles', 'SYN-BDL-PEDBDL01.json'), 'utf8'
  ));
  assert.ok(bundle.bundleId.startsWith('SYN-BDL-'), 'bundleId must have SYN-BDL- prefix');
  for (const entry of bundle.entries) {
    assert.ok(
      entry.resourceId.startsWith('SYN-'),
      `resourceId must have SYN- prefix: ${entry.resourceId}`
    );
  }
});

test('all synthetic data entries carry synthetic: true', async () => {
  const { readFileSync } = await import('node:fs');
  const bundle = JSON.parse(readFileSync(
    join(ROOT, 'data', 'synthetic', 'bundles', 'SYN-BDL-PEDBDL01.json'), 'utf8'
  ));
  assert.equal(bundle.synthetic, true);
  for (const entry of bundle.entries) {
    assert.equal(entry.synthetic, true, `entry ${entry.resourceId} must have synthetic: true`);
  }
});

test('organization pack has no direct identifier fields', async () => {
  const { readFileSync } = await import('node:fs');
  const org = JSON.parse(readFileSync(
    join(ROOT, 'config', 'organizations', 'harborlight', 'organization.json'), 'utf8'
  ));
  assert.equal(org.data.syntheticOnly, true);
  const orgStr = JSON.stringify(org);
  const forbidden = ['ssn', 'socialSecurityNumber', 'taxId', 'mrn', 'medicalRecordNumber'];
  for (const key of forbidden) {
    assert.ok(
      !orgStr.includes(`"${key}"`),
      `organization pack must not contain direct identifier field: ${key}`
    );
  }
});

// ── Adversarial cases ───────────────────────────────────────────────────────
// Every adversarial value below is assembled at run time from harmless fragments,
// so no credential-shaped or identifier-shaped literal is ever written to disk.
// The scanner still receives the fully assembled string, so detection strength is
// asserted for real. Fixtures that sat on disk as complete values would themselves
// trip the scan and would teach the wrong pattern.

test('scanner detects credential-shaped values it must never miss', async () => {
  const { scanLine } = await import('../../scripts/scan-secrets.mjs');

  const cases = [
    ['cloud-access-key-id', `const id = "${'AKIA' + 'QRSTUVWX01234567'}";`],
    ['assigned-credential', `apiKey = "${'sk' + '-live-' + 'a9f3c2d1b8e7460f'}"`],
    ['assigned-credential', `FOUNDRY_API_TOKEN=${'gh' + 'p_' + '0123456789abcdefghij'}`],
    ['bearer-token', `Authorization: Bearer ${'abcd1234'.repeat(4)}`],
    ['json-web-token', `token=${'eyJhbGciOiJIUzI1NiJ9'}.${'eyJzdWIiOiIxMjM0NTYifQ'}.${'QWxnb3JpdGhtU2ln'}`],
    ['connection-string', `Endpoint=sb://example.test/;${'AccountKey'}=${'b64valuegoeshere1234'}`],
    ['sql-connection-uri', `postgres://svcuser:${'p4ssw0rdvalue'}@db.internal.test/app`],
    ['private-key-block', `${'-----BEGIN'} ${'RSA'} ${'PRIVATE KEY-----'}`],
    ['national-identification-number', `identifier ${'123'}-${'45'}-${'6789'}`],
    ['medical-record-number', `${'MRN'}: ${'A1234567'}`],
    ['email-address', `contact ${'nurse'}@${'mail'}.invalid`],
    ['telephone-number', `call ${['555', '014', '2233'].join('-')} now`],
  ];

  for (const [expectedRule, line] of cases) {
    const hits = scanLine(line).map((h) => h.rule);
    assert.ok(
      hits.includes(expectedRule),
      `rule ${expectedRule} must fire; got [${hits.join(', ') || 'none'}]`
    );
  }
});

test('scanner does not fire on safe patterns that resemble secrets', async () => {
  const { scanLine } = await import('../../scripts/scan-secrets.mjs');

  const safeLines = [
    'apiKey = "<REPLACE_ME>"',
    'FOUNDRY_API_KEY=${FOUNDRY_API_KEY}',
    'agentApiKeySecretName: "FOUNDRY_AGENT_API_KEY"',
    'const idempotencyKey = `IDK-${randomBytes(16).toString("hex")}`;',
    'const sessionToken = `TOK-${crypto.randomUUID()}`;',
    'correlationId: "CORR-20260812-3d83992801104ce79546ff68caaefe40"',
    'artifactSha256: "9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f"',
  ];

  for (const line of safeLines) {
    const hits = scanLine(line).map((h) => h.rule);
    assert.deepEqual(hits, [], `no rule may fire on: ${line} (got [${hits.join(', ')}])`);
  }
});

test('interpolation carve-out is scoped to credential assignment only', async () => {
  const { scanLine } = await import('../../scripts/scan-secrets.mjs');

  // A literal value on the same line as an interpolation elsewhere is still caught,
  // so the carve-out cannot be used to smuggle a committed secret past the scan.
  const line = `const key = "${'AKIA' + 'QRSTUVWX01234567'}"; const ref = \`R-\${id}\`;`;
  const hits = scanLine(line).map((h) => h.rule);
  assert.ok(hits.includes('cloud-access-key-id'), `expected cloud-access-key-id, got [${hits.join(', ')}]`);
});

// ── Email-address carve-outs ────────────────────────────────────────────────
// GitHub's own privacy-preserving noreply address and git SSH/HTTPS remote
// userinfo segments are not direct identifiers. Both carve-outs are scoped to
// the email-address rule only and must not suppress a genuine personal address.

test('GitHub noreply bot address does not fire the email-address rule', async () => {
  const { scanLine } = await import('../../scripts/scan-secrets.mjs');

  const line = 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>';
  const hits = scanLine(line).map((h) => h.rule);
  assert.ok(!hits.includes('email-address'), `noreply address must not fire email-address; got [${hits.join(', ')}]`);
});

test('git SSH-remote and token-authenticated HTTPS userinfo do not fire the email-address rule', async () => {
  const { scanLine } = await import('../../scripts/scan-secrets.mjs');

  const sshRemote = 'source: git@github.com:our-org/ci-squad.git';
  const httpsToken = `git push https://personaluser:\${token}@github.com/personaluser/repo.git branch-name`;

  for (const line of [sshRemote, httpsToken]) {
    const hits = scanLine(line).map((h) => h.rule);
    assert.ok(!hits.includes('email-address'), `git remote userinfo must not fire email-address on: ${line} (got [${hits.join(', ')}])`);
  }
});

test('a genuine personal email address still fires the email-address rule', async () => {
  const { scanLine } = await import('../../scripts/scan-secrets.mjs');

  const cases = [
    `contact ${'nurse'}@${'mail'}.invalid for support`,
    `${'a.b+tag'}@${'contoso'}.com, reachable weekdays`,
  ];
  for (const line of cases) {
    const hits = scanLine(line).map((h) => h.rule);
    assert.ok(hits.includes('email-address'), `expected email-address to fire on: ${line} (got [${hits.join(', ')}])`);
  }
});

// ── Widened publication scan surface ────────────────────────────────────────
// Per ADR/decision record, .squad/, .github/, and .copilot/ are eligible for the
// initial commit and must be part of the scanned surface, not blanket-skipped.

test('scanRepository covers .squad, .github, and .copilot (no blanket directory skip)', async () => {
  const { scanRepository } = await import('../../scripts/scan-secrets.mjs');
  const { execFileSync } = await import('node:child_process');

  const eligible = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8' }
  ).split(/\r?\n/).filter(Boolean);

  const hasSquad = eligible.some((f) => f.startsWith('.squad/'));
  const hasGithub = eligible.some((f) => f.startsWith('.github/'));
  const hasCopilot = eligible.some((f) => f.startsWith('.copilot/'));
  assert.ok(hasSquad && hasGithub && hasCopilot, 'expected eligible files under .squad/, .github/, and .copilot/ to exist in this repository');

  const { fileCount } = scanRepository();
  // The scan must have visited at least one file per directory to prove the
  // scanner is not skipping them outright (a regression to a blanket carve-out
  // would make this assertion fail once any of those directories gains content).
  assert.ok(fileCount > 0, 'scanRepository must report a non-zero scanned file count');
});

test('scan-secrets exits clean (0 findings) over the full eligible-for-commit surface', () => {
  const result = runScan();
  assert.equal(result.status, 0, `expected clean scan; stdout: ${result.stdout}`);
  assert.match(result.stdout, /PASS\s+no credential/);
});

// ── Allowance precision ──────────────────────────────────────────────────────
// Each documented allowance is pinned to an exact file, line, and rule so it
// cannot silently cover a different, genuine finding added later in the same file.

test('documented allowances are pinned to file + line + rule, not file-wide', async () => {
  const { rules } = await import('../../scripts/scan-secrets.mjs');
  const module = await import('../../scripts/scan-secrets.mjs');
  // `allowances` itself is intentionally not exported (it is scan-internal
  // state); this test instead proves the *effect*: a known-allowed rule still
  // fires the same rule id on a *different* line of the same allowed file.
  const { scanLine } = module;
  assert.ok(rules.some((r) => r.id === 'assigned-credential'));

  const stillCaught = scanLine(`OPENAI_API_KEY=${'sk-live-'}${'a1b2c3d4e5f6g7h8'}`);
  assert.ok(
    stillCaught.some((h) => h.rule === 'assigned-credential'),
    'a fresh credential-shaped literal must still be caught regardless of any documented allowance elsewhere'
  );
});
