/**
 * Integration tests — audit write failure (audit.mjs).
 *
 * Asserts that audit events are emitted correctly and that write failures
 * produce E-AUDIT-WRITE-FAILURE rather than being swallowed. An audit write
 * failure must stop the run — it may never be logged and silently ignored.
 *
 * These tests also verify that the audit event schema is satisfied by the
 * buildAuditEvent helper for every standard event type.
 *
 * Run: node --test tests/integration/schema-failures.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAuditEvent, emitAuditEvent } from '../../src/governance/audit.mjs';
import { validateAgainstSchema } from '../../src/governance/validate-payload.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORR  = 'CORR-20260812-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6';
const AUDIT_SCHEMA = 'https://contracts.second-shift-accelerator.example/v1/audit-event.schema.json';

const BASE_AUDIT = {
  auditEventId: 'AUD-TESTBASE01',
  eventType: 'request',
  correlationId: CORR,
  occurredAt: '2026-08-12T06:45:00Z',
  organizationId: 'harborlight',
  actorRef: 'USR-RN0000000001',
  actorType: 'human',
  actorRoleCode: 'registered-nurse',
  outcome: 'success',
};

// ============================================================================
// buildAuditEvent structure
// ============================================================================

test('buildAuditEvent produces contractVersion 1.0.0', () => {
  const e = buildAuditEvent(BASE_AUDIT);
  assert.equal(e.contractVersion, '1.0.0');
});

test('buildAuditEvent does not copy undefined fields', () => {
  const e = buildAuditEvent({ ...BASE_AUDIT, failClosedCode: undefined });
  assert.ok(!('failClosedCode' in e), 'undefined failClosedCode must not appear');
});

// ============================================================================
// Schema validation for all audit event types
// ============================================================================

for (const eventType of ['request', 'context-confirmation', 'generation', 'presentation', 'decision', 'revision', 'audit-query', 'validation-failure']) {
  test(`audit event type '${eventType}' satisfies schema when required fields are present`, () => {
    const idSuffix = eventType.toUpperCase().replace(/-/g, '').slice(0, 12).padEnd(8, '0');
    const base = { ...BASE_AUDIT, auditEventId: `AUD-${idSuffix}`, eventType };
    const extra = {};
    if (['context-confirmation', 'generation', 'presentation', 'decision', 'revision'].includes(eventType)) {
      extra.syntheticPatientId = 'SYN-PAT-PED0001A';
      extra.syntheticEncounterId = 'SYN-ENC-PEDENC001';
    }
    if (eventType === 'generation') {
      extra.generationId = 'GEN-20260812A001';
      extra.schemaValidationPassed = true;
      extra.groundingVerified = true;
    }
    if (eventType === 'decision') {
      extra.approvalEventId = 'APR-20260812A001';
      extra.artifactId = 'ART-20260812A001';
    }
    const e = buildAuditEvent({ ...base, ...extra });
    const r = validateAgainstSchema(e, AUDIT_SCHEMA);
    assert.equal(r.valid, true,
      `event type '${eventType}' failed schema: ${r.errors?.map(err => `${err.instancePath} ${err.message}`).join('; ')}`);
  });
}

// ============================================================================
// Blocked outcome must carry failClosedCode
// ============================================================================

test('blocked outcome without failClosedCode fails schema', () => {
  const e = buildAuditEvent({ ...BASE_AUDIT, outcome: 'blocked' });
  const r = validateAgainstSchema(e, AUDIT_SCHEMA);
  assert.equal(r.valid, false, 'blocked without failClosedCode must fail schema');
  assert.ok(r.errors?.some(err => err.params?.missingProperty === 'failClosedCode'), JSON.stringify(r.errors));
});

test('blocked outcome with failClosedCode satisfies schema', () => {
  const e = buildAuditEvent({ ...BASE_AUDIT, outcome: 'blocked', failClosedCode: 'E-CONTEXT-UNCONFIRMED' });
  const r = validateAgainstSchema(e, AUDIT_SCHEMA);
  assert.equal(r.valid, true,
    `should pass: ${r.errors?.map(err => `${err.instancePath} ${err.message}`).join('; ')}`);
});

test('failure outcome with failClosedCode satisfies schema', () => {
  const e = buildAuditEvent({ ...BASE_AUDIT, outcome: 'failure', failClosedCode: 'E-OUTPUT-SCHEMA-INVALID' });
  const r = validateAgainstSchema(e, AUDIT_SCHEMA);
  assert.equal(r.valid, true,
    `should pass: ${r.errors?.map(err => `${err.instancePath} ${err.message}`).join('; ')}`);
});

// ============================================================================
// emitAuditEvent — sink behaviour
// ============================================================================

test('emitAuditEvent succeeds with a functioning sink', async () => {
  const e = buildAuditEvent(BASE_AUDIT);
  let received = null;
  const r = await emitAuditEvent(e, async (ev) => { received = ev; });
  assert.equal(r.success, true);
  assert.deepEqual(received, e);
});

test('emitAuditEvent returns E-AUDIT-WRITE-FAILURE when sink throws', async () => {
  const e = buildAuditEvent(BASE_AUDIT);
  const r = await emitAuditEvent(e, async () => { throw new Error('sink unavailable'); });
  assert.equal(r.success, false);
  assert.equal(r.failClosedCode, 'E-AUDIT-WRITE-FAILURE');
  assert.ok(r.detail, 'detail must be present');
});

test('emitAuditEvent returns E-AUDIT-WRITE-FAILURE with null sink', async () => {
  const e = buildAuditEvent(BASE_AUDIT);
  const r = await emitAuditEvent(e, null);
  assert.equal(r.success, false);
  assert.equal(r.failClosedCode, 'E-AUDIT-WRITE-FAILURE');
});

test('emitAuditEvent returns E-AUDIT-WRITE-FAILURE with undefined sink', async () => {
  const e = buildAuditEvent(BASE_AUDIT);
  const r = await emitAuditEvent(e, undefined);
  assert.equal(r.success, false);
  assert.equal(r.failClosedCode, 'E-AUDIT-WRITE-FAILURE');
});

test('emitAuditEvent never swallows the failure — failure result is always returned', async () => {
  const e = buildAuditEvent(BASE_AUDIT);
  const r = await emitAuditEvent(e, async () => { throw new Error('permanent failure'); });
  // The caller must check result.success before proceeding.
  // This test confirms the result is always surfaced, never silently dropped.
  assert.equal(typeof r.success, 'boolean');
  assert.equal(r.success, false);
  assert.ok(r.failClosedCode, 'failClosedCode must be present so caller can emit E-AUDIT-WRITE-FAILURE');
});

// ============================================================================
// Audit events must not carry generated narrative
// ============================================================================

test('audit event schema rejects a narrative field (additionalProperties: false)', () => {
  const e = {
    ...buildAuditEvent(BASE_AUDIT),
    narrative: 'Documented respiratory rate was 22 breaths/min at 23:15.',
  };
  const r = validateAgainstSchema(e, AUDIT_SCHEMA);
  assert.equal(r.valid, false, 'audit event with narrative must fail schema');
  assert.ok(r.errors?.some(err => err.params?.additionalProperty === 'narrative'),
    `expected additionalProperty=narrative error, got: ${JSON.stringify(r.errors)}`);
});
