/**
 * Integration tests — wrong-patient detection (approval.mjs).
 *
 * Asserts that the approval module refuses to create an event when the
 * reconfirmed patient or encounter does not match the original request context.
 * This tests the human-authority gate that prevents a draft generated for one
 * patient from being approved against a different patient's context.
 *
 * Run: node --test tests/integration/wrong-patient.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalEvent } from '../../src/governance/approval.mjs';

const BASE = {
  approvalEventId: 'APR-20260812A001',
  correlationId: 'CORR-20260812-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6',
  recordedAt: '2026-08-12T06:52:47Z',
  organizationId: 'harborlight',
  decision: 'approved',
  actorRef: 'USR-RN0000000001',
  roleCode: 'registered-nurse',
  artifact: {
    artifactId: 'ART-20260812A001',
    artifactVersion: '1.0.0',
    artifactSha256: '9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
    generationId: 'GEN-20260812A001',
    agentInstructionVersion: '1.0.0',
  },
  reconfirmedContext: {
    syntheticPatientId: 'SYN-PAT-PED0001A',
    syntheticEncounterId: 'SYN-ENC-PEDENC001',
    preApprovalConfirmedAt: '2026-08-12T06:52:44Z',
    sourceBundleId: 'SYN-BDL-PEDBDL01',
    sourceBundleSha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  },
  requestContext: {
    syntheticPatientId: 'SYN-PAT-PED0001A',
    syntheticEncounterId: 'SYN-ENC-PEDENC001',
  },
  revisionNumber: 0,
};

// ============================================================================
// Positive: matching context produces a valid event
// ============================================================================

test('approval succeeds when reconfirmed context matches request context', () => {
  const r = createApprovalEvent(BASE);
  assert.ok(r.event, `expected event but got error: ${r.error}`);
  assert.equal(r.event.decision, 'approved');
  assert.equal(r.event.lifecycleStatus, 'APPROVED-SIMULATED');
});

// ============================================================================
// Negative: wrong patient must be refused
// ============================================================================

test('refuses when reconfirmed patient differs from request', () => {
  const r = createApprovalEvent({
    ...BASE,
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticPatientId: 'SYN-PAT-WRONGPAT1',
    },
  });
  assert.ok(r.error, 'expected error response');
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
  assert.ok(r.error.includes('patient'), `error should mention patient, got: ${r.error}`);
});

test('refuses when reconfirmed encounter differs from request', () => {
  const r = createApprovalEvent({
    ...BASE,
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticEncounterId: 'SYN-ENC-WRONGENC1',
    },
  });
  assert.ok(r.error, 'expected error response');
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
  assert.ok(r.error.includes('encounter'), `error should mention encounter, got: ${r.error}`);
});

test('refuses when both patient and encounter differ', () => {
  const r = createApprovalEvent({
    ...BASE,
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticPatientId: 'SYN-PAT-WRONGPAT1',
      syntheticEncounterId: 'SYN-ENC-WRONGENC1',
    },
  });
  assert.ok(r.error, 'expected error response');
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
});

test('refuses when patient ID is empty string', () => {
  const r = createApprovalEvent({
    ...BASE,
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticPatientId: '',
    },
  });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
});

test('refuses when encounter ID is undefined', () => {
  const r = createApprovalEvent({
    ...BASE,
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticEncounterId: undefined,
    },
  });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
});

// ============================================================================
// Adversarial: attempt to use wrong-context approval for revision
// ============================================================================

test('revision-requested also refuses wrong-patient', () => {
  const r = createApprovalEvent({
    ...BASE,
    decision: 'revision-requested',
    decisionReason: 'Handoff section needs more detail.',
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticPatientId: 'SYN-PAT-WRONGPAT1',
    },
  });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
});

test('rejected also refuses wrong-encounter', () => {
  const r = createApprovalEvent({
    ...BASE,
    decision: 'rejected',
    decisionReason: 'Output is inaccurate.',
    reconfirmedContext: {
      ...BASE.reconfirmedContext,
      syntheticEncounterId: 'SYN-ENC-WRONGENC1',
    },
  });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
});
