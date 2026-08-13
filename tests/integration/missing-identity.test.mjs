/**
 * Integration tests — missing / malformed identity on the connected-agent
 * handoff (src/governance/assert-authorized-requester.mjs).
 *
 * BLOCKER-002 (docs/risks.md): Copilot Studio's connected Foundry agent path
 * does not document propagation of the signed-in user's Entra identity or
 * role claims. These tests assert that assertAuthorizedRequester and
 * assertPreGenerationHandoff refuse — fail closed with E-IDENTITY-MISSING or
 * E-CONTEXT-UNCONFIRMED — whenever the requester is absent, unauthenticated,
 * or carries a malformed opaque actorRef, and that no forbidden
 * identity-bearing field (name, email, token, tenant/object identifier) can
 * cross the handoff boundary regardless of nesting depth.
 *
 * Run: node --test tests/integration/missing-identity.test.mjs
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
} from '../../src/governance/assert-authorized-requester.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const orgConfig = await readJson('config/organizations/harborlight/organization.json');
const valid = await readJson('data/synthetic/governance/connected-agent-handoff.valid.json');
const missingIdentityCases = await readJson('data/synthetic/governance/missing-identity.cases.json');
const forbiddenFieldCases = await readJson('data/synthetic/governance/forbidden-identity-fields.cases.json');

// ============================================================================
// Positive case — a fully valid handoff is authorized
// ============================================================================

test('valid requester is authorized', () => {
  const r = assertAuthorizedRequester(valid.requester, orgConfig);
  assert.equal(r.ok, true, `expected authorization, got: ${r.error}`);
  assert.equal(r.authorized, true);
});

test('valid pre-generation handoff passes every gate', () => {
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: valid.context,
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, true, `expected ok, got: ${r.error}`);
});

// ============================================================================
// Negative — missing / malformed identity (data-driven from fixture)
// ============================================================================

for (const c of missingIdentityCases.cases) {
  test(`refuses requester: ${c.name}`, () => {
    const r = assertAuthorizedRequester(c.requester, orgConfig);
    assert.equal(r.ok, false, `expected refusal for case "${c.name}"`);
    assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
    assert.ok(r.error && r.error.length > 0, 'expected a non-empty error detail');
  });
}

// ============================================================================
// Negative — missing identity surfaces through the full pre-generation gate
// ============================================================================

test('pre-generation handoff refuses when requester is absent entirely', () => {
  const r = assertPreGenerationHandoff({
    requester: null,
    context: valid.context,
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});

test('pre-generation handoff refuses when actorRef is malformed', () => {
  const r = assertPreGenerationHandoff({
    requester: { actorRef: 'not-an-actor-ref', roleCode: 'registered-nurse', authenticated: true },
    context: valid.context,
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
});

test('pre-generation handoff refuses when context is entirely absent', () => {
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: null,
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
});

// ============================================================================
// Negative — no identity-bearing field may cross the handoff boundary
// ============================================================================

for (const c of forbiddenFieldCases.cases) {
  test(`refuses handoff carrying propagated identity data: ${c.name}`, () => {
    const r = assertNoIdentityPropagation(c.handoff);
    assert.equal(r.ok, false, `expected refusal for case "${c.name}"`);
    assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
  });
}

test('a handoff with only opaque, approved fields passes the propagation check', () => {
  const r = assertNoIdentityPropagation({ requester: valid.requester, context: valid.context });
  assert.equal(r.ok, true, `expected pass, got: ${r.error}`);
});

test('pre-generation handoff refuses end-to-end when requester carries a display name', () => {
  const r = assertPreGenerationHandoff({
    requester: { ...valid.requester, displayName: 'Sample Nurse Testcase' },
    context: valid.context,
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-IDENTITY-MISSING');
  assert.ok(!r.error.includes('Sample Nurse Testcase'), 'error detail must name the field, not repeat the value');
});
