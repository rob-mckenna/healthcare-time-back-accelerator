/**
 * Integration tests — approval bypass prevention (approval.mjs).
 *
 * Asserts that no artifact may transition to an approved or rejected state
 * without the required pre-approval confirmation, a valid decision value, and
 * (for rejection/revision) a scanned reason. These tests exercise the
 * fail-closed conditions that prevent approval-gate circumvention.
 *
 * Run: node --test tests/integration/approval-bypass.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalEvent } from '../../src/governance/approval.mjs';

const CORR = 'CORR-20260812-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6';

const VALID_ARTIFACT = {
  artifactId: 'ART-20260812A001',
  artifactVersion: '1.0.0',
  artifactSha256: '9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
  generationId: 'GEN-20260812A001',
  agentInstructionVersion: '1.0.0',
};

const VALID_CONTEXT = {
  syntheticPatientId: 'SYN-PAT-PED0001A',
  syntheticEncounterId: 'SYN-ENC-PEDENC001',
  preApprovalConfirmedAt: '2026-08-12T06:52:44Z',
  sourceBundleId: 'SYN-BDL-PEDBDL01',
  sourceBundleSha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
};

const BASE = {
  approvalEventId: 'APR-20260812A001',
  correlationId: CORR,
  recordedAt: '2026-08-12T06:52:47Z',
  organizationId: 'harborlight',
  decision: 'approved',
  actorRef: 'USR-RN0000000001',
  roleCode: 'registered-nurse',
  artifact: VALID_ARTIFACT,
  reconfirmedContext: VALID_CONTEXT,
  requestContext: {
    syntheticPatientId: 'SYN-PAT-PED0001A',
    syntheticEncounterId: 'SYN-ENC-PEDENC001',
  },
  revisionNumber: 0,
};

// ============================================================================
// Positive case — valid approval succeeds
// ============================================================================

test('valid approval succeeds and returns APPROVED-SIMULATED lifecycle', () => {
  const r = createApprovalEvent(BASE);
  assert.ok(r.event, `expected event: ${r.error}`);
  assert.equal(r.event.lifecycleStatus, 'APPROVED-SIMULATED');
  assert.equal(r.event.statusLabel, 'APPROVED \u2014 SIMULATED FINALIZATION ONLY');
  assert.equal(r.event.approver.authenticated, true);
});

// ============================================================================
// Invalid decision value
// ============================================================================

test('refuses unknown decision value', () => {
  const r = createApprovalEvent({ ...BASE, decision: 'auto-approved' });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-INPUT-SCHEMA-INVALID');
});

test('refuses empty decision', () => {
  const r = createApprovalEvent({ ...BASE, decision: '' });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-INPUT-SCHEMA-INVALID');
});

test('refuses undefined decision', () => {
  const r = createApprovalEvent({ ...BASE, decision: undefined });
  assert.ok(r.error);
  assert.equal(r.failClosedCode, 'E-INPUT-SCHEMA-INVALID');
});

// ============================================================================
// Rejection without a reason must be refused
// ============================================================================

test('rejection without reason is refused', () => {
  const r = createApprovalEvent({ ...BASE, decision: 'rejected' });
  assert.ok(r.error, 'expected error for rejection without reason');
});

test('rejection with empty reason is refused', () => {
  const r = createApprovalEvent({ ...BASE, decision: 'rejected', decisionReason: '' });
  assert.ok(r.error, 'expected error for empty reason');
});

test('revision-requested without reason is refused', () => {
  const r = createApprovalEvent({ ...BASE, decision: 'revision-requested' });
  assert.ok(r.error, 'expected error for revision without reason');
});

// ============================================================================
// Rejection with a valid reason succeeds
// ============================================================================

test('rejection with clean reason succeeds', () => {
  const r = createApprovalEvent({
    ...BASE,
    decision: 'rejected',
    decisionReason: 'The shift summary contains inaccurate documented entries.',
  });
  assert.ok(r.event, `expected event: ${r.error}`);
  assert.equal(r.event.lifecycleStatus, 'REJECTED');
  assert.equal(r.event.decisionReasonScanned, true);
});

test('revision-requested with clean reason succeeds', () => {
  const r = createApprovalEvent({
    ...BASE,
    decision: 'revision-requested',
    decisionReason: 'Please expand section two with more documented observations.',
  });
  assert.ok(r.event, `expected event: ${r.error}`);
  assert.equal(r.event.lifecycleStatus, 'REVISION-REQUESTED');
  assert.equal(r.event.decisionReasonScanned, true);
});

// ============================================================================
// Approval event must not carry personal identity data
// ============================================================================

test('approver block contains only actorRef, roleCode, authenticated', () => {
  const r = createApprovalEvent(BASE);
  assert.ok(r.event);
  const approverKeys = Object.keys(r.event.approver);
  assert.deepEqual(approverKeys.sort(), ['actorRef', 'authenticated', 'roleCode'].sort());
});

test('actorRef follows the opaque human USR- pattern', () => {
  const r = createApprovalEvent(BASE);
  assert.ok(r.event);
  assert.match(r.event.approver.actorRef, /^USR-[A-Z0-9]{8,24}$/);
});

test('agent and system identities cannot create approval events', () => {
  for (const actorRef of ['AGT-FOUNDRYAGENT0001', 'SYS-WORKFLOW0000001']) {
    const r = createApprovalEvent({ ...BASE, actorRef });
    assert.equal(r.event, undefined);
    assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
  }
});

// ============================================================================
// Lifecycle label alignment
// ============================================================================

test('approved decision produces correct status label', () => {
  const r = createApprovalEvent(BASE);
  assert.ok(r.event);
  assert.equal(r.event.statusLabel, 'APPROVED \u2014 SIMULATED FINALIZATION ONLY');
});

test('rejected decision produces correct status label', () => {
  const r = createApprovalEvent({
    ...BASE, decision: 'rejected', decisionReason: 'Inaccurate content.',
  });
  assert.ok(r.event);
  assert.equal(r.event.statusLabel, 'REJECTED \u2014 NOT FOR USE');
});

test('revision-requested decision produces correct status label', () => {
  const r = createApprovalEvent({
    ...BASE, decision: 'revision-requested', decisionReason: 'Needs revision.',
  });
  assert.ok(r.event);
  assert.equal(r.event.statusLabel, 'REVISION REQUESTED \u2014 DRAFT WITHDRAWN');
});
