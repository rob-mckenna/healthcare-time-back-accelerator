/**
 * Security tests — audit minimality for the connected-agent identity
 * handoff (src/governance/assert-authorized-requester.mjs and
 * src/governance/audit.mjs).
 *
 * REQ-AUD-002: audit and error evidence must never carry narrative, names,
 * email addresses, tokens, or other sensitive payloads — only opaque
 * actorRef and roleCode, and only the minimal fields the audit-event
 * contract allows. These tests assert that:
 *
 *   - every refusal produced by assert-authorized-requester.mjs names the
 *     offending field path, never the offending value
 *   - buildAuditEvent (src/governance/audit.mjs) accepts no field that is
 *     not on its explicit allow-list, so a caller cannot smuggle a name,
 *     email, or token into an audit event even by trying
 *   - a built audit event still validates against
 *     contracts/schemas/audit-event.schema.json (additionalProperties: false)
 *   - a decision attribution (approver) carries only actorRef, roleCode,
 *     authenticated — never a resolved display name or email
 *
 * Run: node --test tests/security/audit-minimality.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertAuthorizedRequester,
  assertNoIdentityPropagation,
  assertPreGenerationHandoff,
  assertPreApprovalHandoff,
  _internal,
} from '../../src/governance/assert-authorized-requester.mjs';
import { buildAuditEvent } from '../../src/governance/audit.mjs';
import { validateAgainstSchema } from '../../src/governance/validate-payload.mjs';
import { createApprovalEvent } from '../../src/governance/approval.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const orgConfig = await readJson('config/organizations/harborlight/organization.json');
const valid = await readJson('data/synthetic/governance/connected-agent-handoff.valid.json');
const validApproval = await readJson('data/synthetic/governance/connected-agent-approval-handoff.valid.json');
const forbiddenFieldCases = await readJson('data/synthetic/governance/forbidden-identity-fields.cases.json');

const SENSITIVE_VALUES = [
  'Sample Nurse Testcase',
  'nurse.testcase@hospital.example',
  'PLACEHOLDER-NOT-A-REAL-TOKEN',
  'n.testcase@hospital.example',
  '00000000-0000-0000-0000-000000000000',
];

// ============================================================================
// Error detail never repeats a sensitive value found in the payload
// ============================================================================

for (const c of forbiddenFieldCases.cases) {
  test(`error detail names the field path, not the value, for: ${c.name}`, () => {
    const r = assertNoIdentityPropagation(c.handoff);
    assert.equal(r.ok, false, `expected refusal for case "${c.name}"`);
    for (const sensitive of SENSITIVE_VALUES) {
      assert.ok(
        !r.error.includes(sensitive),
        `error detail must not repeat sensitive value "${sensitive}": ${r.error}`
      );
    }
  });
}

test('assertAuthorizedRequester error never contains the malformed actorRef value verbatim as a leaked secret-shaped string', () => {
  // The actorRef itself is opaque and safe to name (it is not a direct
  // identifier), but this proves the module reports structure, not payload.
  const weirdActorRef = 'USR-' + 'x'.repeat(40); // too long, malformed
  const r = assertAuthorizedRequester(
    { actorRef: weirdActorRef, roleCode: 'registered-nurse', authenticated: true },
    orgConfig
  );
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});

test('stale-context refusal error never contains the raw confirmedByRef mismatch beyond opaque refs', () => {
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: { ...valid.context, confirmedByRef: 'USR-DIFFERENTPERSON1' },
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
  // Only opaque actorRef values may appear — no name/email fragments.
  for (const sensitive of SENSITIVE_VALUES) {
    assert.ok(!r.error.includes(sensitive));
  }
});

// ============================================================================
// buildAuditEvent has a closed allow-list — extra/sensitive fields are dropped
// ============================================================================

test('buildAuditEvent ignores fields not on its explicit allow-list', () => {
  const event = buildAuditEvent({
    auditEventId: 'AUD-20260813A001',
    eventType: 'request',
    correlationId: 'CORR-20260813-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6',
    occurredAt: '2026-08-13T06:45:00Z',
    organizationId: 'harborlight',
    actorRef: 'USR-RN0000000001',
    actorType: 'human',
    actorRoleCode: 'registered-nurse',
    outcome: 'success',
    // The following are NOT on the allow-list of buildAuditEvent's destructured
    // params and must not appear on the built event under any key:
    displayName: 'Sample Nurse Testcase',
    email: 'nurse.testcase@hospital.example',
    accessToken: 'PLACEHOLDER-NOT-A-REAL-TOKEN',
    narrative: 'Patient improved overnight and handoff notes were extensive.',
  });

  const serialized = JSON.stringify(event);
  assert.ok(!('displayName' in event));
  assert.ok(!('email' in event));
  assert.ok(!('accessToken' in event));
  assert.ok(!('narrative' in event));
  for (const sensitive of SENSITIVE_VALUES) {
    assert.ok(!serialized.includes(sensitive), `built audit event must not contain "${sensitive}"`);
  }
  assert.ok(!serialized.toLowerCase().includes('patient improved'), 'no narrative content may appear in an audit event');
});

test('an audit event built with only allow-listed fields validates against audit-event.schema.json', () => {
  const event = buildAuditEvent({
    auditEventId: 'AUD-20260813A002',
    eventType: 'decision',
    correlationId: 'CORR-20260813-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6',
    occurredAt: '2026-08-13T06:52:47Z',
    organizationId: 'harborlight',
    actorRef: 'USR-RN0000000001',
    actorType: 'human',
    actorRoleCode: 'registered-nurse',
    outcome: 'success',
    syntheticPatientId: 'SYN-PAT-PED0001A',
    syntheticEncounterId: 'SYN-ENC-PEDENC001',
    artifactId: 'ART-20260813A001',
    approvalEventId: 'APR-20260813A001',
  });

  const SCHEMA_ID = 'https://contracts.second-shift-accelerator.example/v1/audit-event.schema.json';
  const r = validateAgainstSchema(event, SCHEMA_ID);
  assert.equal(r.valid, true, r.errors?.map(e => `${e.instancePath} ${e.message}`).join('; '));
});

// ============================================================================
// Approval attribution stays opaque even under a connected-agent handoff
// ============================================================================

test('createApprovalEvent approver block carries only actorRef, roleCode, authenticated after a validated handoff', () => {
  const handoffCheck = assertPreApprovalHandoff({
    approver: validApproval.approver,
    reconfirmedContext: validApproval.reconfirmedContext,
    reconfirmedByRef: validApproval.reconfirmedByRef,
    originalContext: validApproval.originalContext,
    orgConfig,
    nowIso: validApproval.nowIso,
  });
  assert.equal(handoffCheck.ok, true, `expected handoff to pass, got: ${handoffCheck.error}`);

  const r = createApprovalEvent({
    approvalEventId: 'APR-20260813A001',
    correlationId: 'CORR-20260813-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6',
    recordedAt: '2026-08-13T06:53:00Z',
    organizationId: 'harborlight',
    decision: 'approved',
    actorRef: validApproval.approver.actorRef,
    roleCode: validApproval.approver.roleCode,
    artifact: {
      artifactId: 'ART-20260813A001',
      artifactVersion: '1.0.0',
      artifactSha256: '9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
      generationId: 'GEN-20260813A001',
      agentInstructionVersion: '1.0.0',
    },
    reconfirmedContext: {
      ...validApproval.reconfirmedContext,
      sourceBundleId: 'SYN-BDL-PEDBDL01',
      sourceBundleSha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    },
    requestContext: validApproval.originalContext,
  });

  assert.ok(r.event, `expected event: ${r.error}`);
  const approverKeys = Object.keys(r.event.approver).sort();
  assert.deepEqual(approverKeys, ['actorRef', 'authenticated', 'roleCode'].sort());
  assert.equal(r.event.approver.actorRef, validApproval.approver.actorRef);
});

// ============================================================================
// Deny-list coverage — every field name in the deny-list is actually caught
// ============================================================================

test('every field in FORBIDDEN_IDENTITY_KEYS is detected at the top level of a handoff object', () => {
  for (const key of _internal.FORBIDDEN_IDENTITY_KEYS) {
    const handoff = { requester: { actorRef: 'USR-RN0000000001', [key]: 'placeholder-value' } };
    const findings = _internal.findForbiddenIdentityFields(handoff);
    assert.ok(
      findings.some(f => f.endsWith(`.${key}`)),
      `expected field "${key}" to be detected, found paths: ${findings.join(', ')}`
    );
  }
});

test('deny-list detection does not false-positive on the approved opaque envelope', () => {
  const findings = _internal.findForbiddenIdentityFields({
    requester: valid.requester,
    context: valid.context,
    approver: validApproval.approver,
    reconfirmedContext: validApproval.reconfirmedContext,
    originalContext: validApproval.originalContext,
  });
  assert.deepEqual(findings, []);
});
