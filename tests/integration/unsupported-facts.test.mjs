/**
 * Integration tests — unsupported facts / grounding failure (validate-payload.mjs).
 *
 * Asserts that the validation layer refuses output that contains statements not
 * traceable to an approved source bundle entry. The agent may summarise and
 * organise documented content; it may not introduce new facts, and any section
 * that does not resolve to the bundle must be refused with E-GROUNDING-FAILURE.
 *
 * Run: node --test tests/integration/unsupported-facts.test.mjs
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

const bundleIds = new Set(bundle.entries.map(e => e.resourceId));

// ============================================================================
// Helpers
// ============================================================================

function withExtraRef(out, resourceId) {
  const bad = JSON.parse(JSON.stringify(out));
  bad.sourceReferences.push({
    resourceType: 'Observation',
    resourceId,
    fieldPath: '/note/0/text',
    fieldLabel: 'Fabricated observation',
  });
  return bad;
}

// ============================================================================
// Baseline — all bundle resources resolve
// ============================================================================

test('all source references in example output resolve to the bundle', () => {
  const allRefs = [];
  const collect = (node) => {
    if (Array.isArray(node)) { node.forEach(collect); return; }
    if (node && typeof node === 'object') {
      if (Array.isArray(node.sourceReferences)) allRefs.push(...node.sourceReferences);
      Object.values(node).forEach(collect);
    }
  };
  collect(output);
  for (const ref of allRefs) {
    assert.ok(bundleIds.has(ref.resourceId),
      `Reference ${ref.resourceId} not found in bundle`);
  }
});

test('valid output passes grounding check', () => {
  const r = validatePayload(output, CORR, bundle);
  assert.equal(r.valid, true, JSON.stringify(r));
});

// ============================================================================
// Grounding failures
// ============================================================================

test('refuses output with a master reference to an unknown resource', () => {
  const bad = withExtraRef(output, 'SYN-OBS-FABRICAT1');
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-GROUNDING-FAILURE');
  assert.ok(r.detail?.includes('SYN-OBS-FABRICAT1'), `detail: ${r.detail}`);
});

test('refuses output with shift summary referencing non-bundle resource', () => {
  const bad = JSON.parse(JSON.stringify(output));
  if (!bad.shiftSummary) bad.shiftSummary = output.shiftSummary;
  bad.shiftSummary.sourceReferences = [
    ...bad.shiftSummary.sourceReferences,
    {
      resourceType: 'Observation',
      resourceId: 'SYN-OBS-NOTREAL99',
      fieldPath: '/code/text',
      fieldLabel: 'Unsupported fabricated observation',
    },
  ];
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-GROUNDING-FAILURE');
});

test('refuses output when open item cites an unsupported resource', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.openItems = [
    {
      itemId: 'ITM-FAKE01',
      description: 'Clinician prescribed medication X (undocumented).',
      sourceResourceType: 'ServiceRequest',
      sourceReferences: [
        {
          resourceType: 'ServiceRequest',
          resourceId: 'SYN-SRQ-NOTREAL1',
          fieldPath: '/code/text',
          fieldLabel: 'Fabricated service request',
        },
      ],
    },
  ];
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-GROUNDING-FAILURE');
});

test('refuses output when follow-up item references non-bundle resource', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.followUpItems = [
    {
      itemId: 'ITM-FUP9901',
      description: 'Schedule unsupported follow-up.',
      sourceReferences: [
        {
          resourceType: 'CarePlan',
          resourceId: 'SYN-CPL-NOTREAL9',
          fieldPath: '/activity/0/detail/description',
          fieldLabel: 'Fabricated care-plan activity',
        },
      ],
    },
  ];
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-GROUNDING-FAILURE');});

// ============================================================================
// Contract structural guards against unsupported sections
// ============================================================================

test('output contract schema refuses a recommendation section (additionalProperties)', () => {
  // The output contract has additionalProperties: false, so any attempt to
  // add a recommendation section fails at schema validation before grounding.
  const bad = JSON.parse(JSON.stringify(output));
  bad.recommendation = 'Patient should receive medication X based on observed vitals.';
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});

test('output contract schema refuses a triage section', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.triageAssessment = { urgency: 'immediate', rationale: 'fabricated' };
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});

test('output contract schema refuses a diagnosis section', () => {
  const bad = JSON.parse(JSON.stringify(output));
  bad.diagnosis = 'Fabricated clinical diagnosis.';
  const r = validatePayload(bad, CORR, bundle);
  assert.equal(r.valid, false);
  assert.equal(r.failClosedCode, 'E-OUTPUT-SCHEMA-INVALID');
});
