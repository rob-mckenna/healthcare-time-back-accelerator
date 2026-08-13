/**
 * Integration tests — unauthorized role on the connected-agent handoff
 * (src/governance/assert-authorized-requester.mjs).
 *
 * BLOCKER-002 (docs/risks.md): whether directory role claims are available
 * to a Copilot Studio topic in the target tenant is unverified. Even if a
 * roleCode value is present and well-formed, it must still be checked
 * against the organization's `personas.authorizedRoleCodes` allow-list.
 * A recognised role code that is not authorized for the organization (e.g.
 * "administrator" or "demo-observer" for harborlight, whose allow-list is
 * limited to registered-nurse and charge-nurse) must refuse the handoff.
 *
 * Run: node --test tests/integration/unauthorized-role.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertAuthorizedRequester,
  assertPreGenerationHandoff,
  assertPreApprovalHandoff,
} from '../../src/governance/assert-authorized-requester.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const orgConfig = await readJson('config/organizations/harborlight/organization.json');
const valid = await readJson('data/synthetic/governance/connected-agent-handoff.valid.json');
const validApproval = await readJson('data/synthetic/governance/connected-agent-approval-handoff.valid.json');
const unauthorizedRoleCases = await readJson('data/synthetic/governance/unauthorized-role.cases.json');

// ============================================================================
// Sanity — the org pack's authorized role list is what the tests assume
// ============================================================================

test('harborlight authorizedRoleCodes is limited to registered-nurse and charge-nurse', () => {
  assert.deepEqual(
    [...orgConfig.personas.authorizedRoleCodes].sort(),
    ['charge-nurse', 'registered-nurse']
  );
});

// ============================================================================
// Positive — an authorized role passes
// ============================================================================

test('registered-nurse (authorized) passes', () => {
  const r = assertAuthorizedRequester(valid.requester, orgConfig);
  assert.equal(r.ok, true, `expected authorization, got: ${r.error}`);
});

test('charge-nurse (authorized) passes', () => {
  const r = assertAuthorizedRequester(
    { actorRef: 'USR-CN0000000001', roleCode: 'charge-nurse', authenticated: true },
    orgConfig
  );
  assert.equal(r.ok, true, `expected authorization, got: ${r.error}`);
});

// ============================================================================
// Negative — unauthorized or unrecognised roles (data-driven from fixture)
// ============================================================================

for (const c of unauthorizedRoleCases.cases) {
  test(`refuses requester: ${c.name}`, () => {
    const r = assertAuthorizedRequester(c.requester, orgConfig);
    assert.equal(r.ok, false, `expected refusal for case "${c.name}"`);
    assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
  });
}

// ============================================================================
// Negative — unauthorized role surfaces through both full gates
// ============================================================================

test('pre-generation handoff refuses an unauthorized administrator role', () => {
  const r = assertPreGenerationHandoff({
    requester: { actorRef: 'USR-ADM000000001X', roleCode: 'administrator', authenticated: true },
    context: { ...valid.context, confirmedByRef: 'USR-ADM000000001X' },
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});

test('pre-approval handoff refuses an unauthorized demo-observer role', () => {
  const r = assertPreApprovalHandoff({
    approver: { actorRef: 'USR-OBS000000001X', roleCode: 'demo-observer', authenticated: true },
    reconfirmedContext: validApproval.reconfirmedContext,
    reconfirmedByRef: 'USR-OBS000000001X',
    originalContext: validApproval.originalContext,
    orgConfig,
    nowIso: validApproval.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});

// ============================================================================
// Negative — a different organization's allow-list must not leak authorization
// ============================================================================

test('a role authorized for one organization is still checked against the supplied orgConfig', () => {
  const narrowOrgConfig = {
    ...orgConfig,
    organizationId: 'narrow-example',
    personas: { ...orgConfig.personas, authorizedRoleCodes: ['charge-nurse'] },
  };
  const r = assertAuthorizedRequester(
    { actorRef: 'USR-RN0000000001', roleCode: 'registered-nurse', authenticated: true },
    narrowOrgConfig
  );
  assert.equal(r.ok, false, 'registered-nurse must be refused against an org pack that only authorizes charge-nurse');
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});

test('missing orgConfig.personas.authorizedRoleCodes fails closed rather than authorizing everything', () => {
  const brokenOrgConfig = { organizationId: 'harborlight', personas: {} };
  const r = assertAuthorizedRequester(valid.requester, brokenOrgConfig);
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});
