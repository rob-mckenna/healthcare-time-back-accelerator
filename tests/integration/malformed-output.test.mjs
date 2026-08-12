/**
 * Integration tests — malformed output detection (validate-payload.mjs).
 *
 * Asserts that the validation layer refuses agent output that does not satisfy
 * the output contract, safety assertions, or grounding requirements. No draft
 * may be presented to a human until all four validation steps pass.
 *
 * Run: node --test tests/integration/malformed-output.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload } from '../../src/governance/validate-payload.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const bundle = readJson('contracts/examples/synthetic-source-bundle.example.json');
const output = readJson('contracts/examples/shift-closeout-agent-output.example.json');
const CORR   = 'CORR-20260812-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6';

// ============================================================================
// Positive: valid example passes all four steps
// ============================================================================

test('valid example output passes validation', () => {
  const r = validatePayload(output, CORR, bundle);
  assert.equal(r.valid, true, `expected valid but got: ${JSON.stringify(r)}`);
  assert.equal(r.failClosedCode, null);
});

// ============================================================================
// Step 1 — schema failures
// ============================================================================

test('refuses output missing draftStatus', () => {
  const bad = { ...output };
  delete bad.draftStatus;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
  assert.equal(r.step, 'schema');
});

test('refuses output with wrong draftStatus constant', () => {
  const bad = { ...output, draftStatus: 'APPROVED' };
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});

test('refuses output with lifecycle status APPROVED (agent cannot emit approved)', () => {
  const bad = { ...output, lifecycleStatus: 'APPROVED-SIMULATED' };
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});

test('refuses output missing required generationId', () => {
  const bad = { ...output };
  delete bad.generationId;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});

test('refuses output with additional property (recommendation section)', () => {
  const bad = { ...output, recommendation: 'Patient should receive medication X.' };
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});

// ============================================================================
// Step 2 — safety assertion failures
// ============================================================================

test('refuses output with noDiagnosis: false', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.safetyStatus.noDiagnosis = false;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.ok(['E-SAFETY-FLAG', 'E-OUTPUT-SCHEMA-INVALID'].includes(r.failClosedCode));
});

test('refuses output with noClinicalRecommendation: false', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.safetyStatus.noClinicalRecommendation = false;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.ok(['E-SAFETY-FLAG', 'E-OUTPUT-SCHEMA-INVALID'].includes(r.failClosedCode));
});

test('refuses output with groundingCoverageRatio less than 1', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.safetyStatus.groundingCoverageRatio = 0.8;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.ok(['E-SAFETY-FLAG', 'E-OUTPUT-SCHEMA-INVALID'].includes(r.failClosedCode));
});

test('refuses output with groundingComplete: false', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.safetyStatus.groundingComplete = false;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.ok(['E-SAFETY-FLAG', 'E-OUTPUT-SCHEMA-INVALID'].includes(r.failClosedCode));
});

// ============================================================================
// Step 3 — grounding failures
// ============================================================================

test('refuses output with source reference to a resource not in the bundle', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.sourceReferences.push({
    resourceType: 'Observation',
    resourceId: 'SYN-OBS-NOTREAL1',
    fieldPath: '/valueQuantity/value',
    fieldLabel: 'Fabricated reference',
  });
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-GROUNDING-FAILURE');
  assert.equal(r.step, 'grounding');
});

test('refuses output when openItem references unresolved resource', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.openItems = bad.openItems ?? [];
  bad.openItems.push({
    itemId: 'ITM-FAKE01',
    description: 'Fabricated item.',
    sourceReferences: [
      {
        resourceType: 'Task',
        resourceId: 'SYN-TSK-NOTREAL1',
        fieldPath: '/description',
        fieldLabel: 'Fabricated task',
      },
    ],
  });
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-GROUNDING-FAILURE');
});

// ============================================================================
// Step 4 — correlation mismatch
// ============================================================================

test('refuses output with wrong correlation ID', () => {
  const r = validatePayload(output, 'CORR-20260812-0000000000000000000000000000000000', bundle);
  assert.equal(r.valid, false);
  assert.ok(r.step === 'correlation' || r.failClosedCode === 'E-OUTPUT-SCHEMA-INVALID');
});

test('refuses output with no correlation ID', () => {
  const bad = { ...output };
  delete bad.correlationId;
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
});
