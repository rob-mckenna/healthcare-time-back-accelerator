/**
 * Integration test — complete local synthetic nurse journey (M1 through M6).
 *
 * REQ-WF-001 through REQ-WF-007  REQ-AUD-001 through REQ-AUD-004  REQ-MET-001
 *
 * Executes scripts/run-local-journey.mjs as a child process, exactly as a
 * reviewer would run it, and asserts the machine-readable run record. The
 * journey script itself asserts every milestone check; this test asserts that
 * the script ran, that every check passed, and that the run record carries the
 * evidence the milestone requires.
 *
 * It also asserts, in process, that the presentation surfaces refuse to render
 * an artifact or a metric that has lost its required labelling.
 *
 * Run: node --test tests/integration/nurse-journey.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDraft, assertDraftLabel, openSourceReference, assertNoSensitivePayload } from '../../src/view/draft-view.mjs';
import { assertIllustrative, renderTimeBackView } from '../../src/view/time-back-view.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARTIFACT_DIR = join(ROOT, 'tests', '.artifacts');
const RUN_RECORD = join(ARTIFACT_DIR, 'nurse-journey-run.local.json');

mkdirSync(ARTIFACT_DIR, { recursive: true });

const result = spawnSync(
  process.execPath,
  [join(ROOT, 'scripts', 'run-local-journey.mjs'), '--quiet', '--json', 'tests/.artifacts/nurse-journey-run.local.json'],
  { cwd: ROOT, encoding: 'utf8', timeout: 120_000 }
);

test('the local journey runs to completion and exits 0', () => {
  assert.equal(
    result.status, 0,
    `journey must exit 0 but exited ${result.status}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`
  );
  assert.ok(existsSync(RUN_RECORD), 'journey must write the machine-readable run record');
});

const record = () => JSON.parse(readFileSync(RUN_RECORD, 'utf8'));

test('every milestone check passed', () => {
  const r = record();
  const failed = r.checks.filter((c) => !c.ok);
  assert.deepEqual(failed, [], `failed checks: ${JSON.stringify(failed, null, 2)}`);
  assert.equal(r.passed, r.total);
  assert.ok(r.total >= 30, `expected a substantive journey, got ${r.total} checks`);
});

test('all six milestones are covered by the run record', () => {
  const covered = new Set(record().checks.map((c) => c.milestone));
  for (const m of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']) {
    assert.ok(covered.has(m), `milestone ${m} has no executed check`);
  }
});

test('all three decision paths were exercised', () => {
  const r = record();
  assert.deepEqual(
    [...r.decisionsExercised].sort(),
    ['approved', 'rejected', 'revision-requested']
  );
  assert.ok(r.decisionEventCount >= 3, 'each decision must produce an audit event');
});

test('generation stayed on the documented simulation boundary', () => {
  const r = record();
  assert.match(r.generationBoundary, /SIMULATION/i);
  assert.match(r.liveFoundryEvaluation, /NOT RUN/);
  assert.match(r.liveFoundryEvaluation, /BLOCKER-003/);
});

test('the run record shows the draft label and separate correlated runs', () => {
  const r = record();
  assert.equal(r.draftStatus, 'DRAFT — HUMAN REVIEW REQUIRED');
  assert.match(r.correlationIds.primaryRun, /^CORR-\d{8}-[0-9a-f]{32}$/);
  assert.match(r.correlationIds.rejectionRun, /^CORR-\d{8}-[0-9a-f]{32}$/);
  assert.notEqual(r.correlationIds.primaryRun, r.correlationIds.rejectionRun);
  assert.ok(r.auditEventCount > 0, 'audit evidence must exist');
});

test('the time-back figures in the run record are labelled illustrative', () => {
  const m = record().illustrativeMetric;
  assert.equal(m.metricLabel, 'ILLUSTRATIVE');
  assert.equal(m.illustrative, true);
  assert.equal(m.notForClinicalUse, true);
  assert.equal(m.dataProvenance, 'synthetic-simulated');
  assert.equal(
    m.illustrativeTimeReturnedMinutes,
    m.baselineDurationMinutes - m.assistedDurationMinutes
  );
});

test('the draft surface refuses an artifact that lost its draft label', () => {
  const draft = { draftStatus: 'FINAL', lifecycleStatus: 'DRAFT' };
  assert.throws(() => assertDraftLabel(draft), (err) => err.failClosedCode === 'E-SAFETY-FLAG');
  assert.throws(
    () => renderDraft(draft, {}, {}, 'abcd1234'),
    (err) => err.failClosedCode === 'E-SAFETY-FLAG'
  );
});

test('the draft surface refuses an artifact whose lifecycle left DRAFT', () => {
  assert.throws(
    () => assertDraftLabel({ draftStatus: 'DRAFT — HUMAN REVIEW REQUIRED', lifecycleStatus: 'APPROVED-SIMULATED' }),
    (err) => err.failClosedCode === 'E-SAFETY-FLAG'
  );
});

test('opening an unresolvable source reference is refused', () => {
  const bundle = { bundleId: 'SYN-BDL-PEDBDL01', entries: [] };
  assert.throws(
    () => openSourceReference(bundle, { resourceId: 'SYN-OBS-NOTINBUNDLE' }),
    (err) => err.failClosedCode === 'E-GROUNDING-FAILURE'
  );
});

test('the evidence surface refuses an audit event carrying narrative content', () => {
  assert.throws(
    () => assertNoSensitivePayload([{ auditEventId: 'AUD-1', narrative: 'shift text' }]),
    (err) => err.failClosedCode === 'E-SAFETY-FLAG'
  );
});

test('the time-back view refuses a metric that is not labelled illustrative', () => {
  const unlabelled = {
    metricLabel: 'MEASURED', illustrative: true, notForClinicalUse: true,
    disclaimerText: 'ILLUSTRATIVE ONLY', baselineDurationMinutes: 24,
    assistedDurationMinutes: 9, illustrativeTimeReturnedMinutes: 15,
    approvalCoverage: { approvedCount: 1, totalCount: 1, coveragePercent: 100 },
  };
  assert.throws(() => assertIllustrative(unlabelled), (err) => err.failClosedCode === 'E-OUTPUT-SCHEMA-INVALID');
  assert.throws(() => renderTimeBackView(unlabelled, {}), (err) => err.failClosedCode === 'E-OUTPUT-SCHEMA-INVALID');
});
