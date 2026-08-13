import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  requestDraft,
  recordDecision,
} from '../../src/orchestration/shift-closeout-runner.mjs';

const ORGANIZATION_ID = 'harborlight';
const HUMAN = {
  actorRef: 'USR-RN0000000001',
  roleCode: 'registered-nurse',
  authenticated: true,
};
const CORRELATION_ID = 'CORR-20260813-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6';
const ORIGINAL_CONTEXT = {
  syntheticPatientId: 'SYN-PAT-PED0001A',
  syntheticEncounterId: 'SYN-ENC-PEDENC001',
  preGenerationConfirmedAt: new Date().toISOString(),
  confirmedByRef: HUMAN.actorRef,
};

function requestWith(requester, context) {
  return requestDraft({ organizationId: ORGANIZATION_ID, requester, context });
}

function decisionWith(overrides = {}) {
  return recordDecision({
    organizationId: ORGANIZATION_ID,
    approver: HUMAN,
    correlationId: CORRELATION_ID,
    draft: {},
    originalContext: ORIGINAL_CONTEXT,
    reconfirmedContext: {
      syntheticPatientId: ORIGINAL_CONTEXT.syntheticPatientId,
      syntheticEncounterId: ORIGINAL_CONTEXT.syntheticEncounterId,
      preApprovalConfirmedAt: new Date().toISOString(),
    },
    reconfirmedByRef: HUMAN.actorRef,
    decision: 'approved',
    ...overrides,
  });
}

test('production request flow refuses stale context before invocation', async () => {
  const result = await requestWith(HUMAN, {
    ...ORIGINAL_CONTEXT,
    preGenerationConfirmedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
});

test('production request flow refuses a wrong confirmer', async () => {
  const result = await requestWith(HUMAN, {
    ...ORIGINAL_CONTEXT,
    confirmedByRef: 'USR-RN0000000002',
  });
  assert.equal(result.ok, false);
  assert.equal(result.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
});

test('production request flow refuses case and separator variants of sensitive keys', async () => {
  for (const requester of [
    { ...HUMAN, Email: 'n.testcase@hospital.example' },
    { ...HUMAN, access_token: 'PLACEHOLDER-NOT-A-REAL-TOKEN' },
    { ...HUMAN, Authorization: 'Bearer PLACEHOLDER-NOT-A-REAL-TOKEN' },
    { ...HUMAN, client_secret: 'PLACEHOLDER-NOT-A-REAL-SECRET' },
    { ...HUMAN, 'API-Key': 'PLACEHOLDER-NOT-A-REAL-KEY' },
    { ...HUMAN, nested: { CLIENT_SECRET: 'PLACEHOLDER-NOT-A-REAL-SECRET' } },
    { ...HUMAN, claims: [{ api_key: 'PLACEHOLDER-NOT-A-REAL-KEY' }] },
  ]) {
    const result = await requestWith(requester, ORIGINAL_CONTEXT);
    assert.equal(result.ok, false);
    assert.equal(result.failClosedCode, 'E-IDENTITY-MISSING');
  }
});

test('production request flow refuses non-human identities', async () => {
  const result = await requestWith(
    { ...HUMAN, actorRef: 'AGT-FOUNDRYAGENT0001' },
    { ...ORIGINAL_CONTEXT, confirmedByRef: 'AGT-FOUNDRYAGENT0001' }
  );
  assert.equal(result.ok, false);
  assert.equal(result.failClosedCode, 'E-IDENTITY-MISSING');
});

test('production approval flow refuses stale reconfirmation', async () => {
  const result = await decisionWith({
    reconfirmedContext: {
      syntheticPatientId: ORIGINAL_CONTEXT.syntheticPatientId,
      syntheticEncounterId: ORIGINAL_CONTEXT.syntheticEncounterId,
      preApprovalConfirmedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
});

test('production approval flow refuses missing or wrong reconfirmer identity', async () => {
  for (const reconfirmedByRef of [undefined, 'USR-RN0000000002']) {
    const result = await decisionWith({ reconfirmedByRef });
    assert.equal(result.ok, false);
    assert.equal(result.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
  }
});

test('production approval flow refuses agent and system approvers', async () => {
  for (const actorRef of ['AGT-FOUNDRYAGENT0001', 'SYS-WORKFLOW0000001']) {
    const result = await decisionWith({
      approver: { ...HUMAN, actorRef },
      reconfirmedByRef: actorRef,
    });
    assert.equal(result.ok, false);
    assert.equal(result.failClosedCode, 'E-IDENTITY-MISSING');
  }
});
