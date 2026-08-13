/**
 * Integration tests — stale context and wrong-confirmer rejection on the
 * connected-agent handoff (src/governance/assert-authorized-requester.mjs).
 *
 * REQ-SAFE-004, REQ-APPR-003: patient and encounter context must be
 * confirmed before generation and reconfirmed before approval, and both
 * confirmations must be fresh and attributable to the same actor who is
 * requesting or deciding. These tests assert that:
 *
 *   - a pre-generation confirmation older than the staleness threshold is refused
 *   - a pre-approval reconfirmation older than the staleness threshold is refused
 *   - a confirmation timestamped in the future is refused
 *   - a confirmedByRef that does not match the requester is refused ("wrong confirmer")
 *   - a reconfirmedByRef that does not match the approver is refused ("wrong confirmer")
 *   - a reconfirmed patient/encounter that differs from the original request
 *     context is refused (an approval-bypass attempt against a different subject)
 *
 * Run: node --test tests/integration/stale-context.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertPreGenerationHandoff,
  assertPreApprovalHandoff,
  _internal,
} from '../../src/governance/assert-authorized-requester.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const orgConfig = await readJson('config/organizations/harborlight/organization.json');
const valid = await readJson('data/synthetic/governance/connected-agent-handoff.valid.json');
const validApproval = await readJson('data/synthetic/governance/connected-agent-approval-handoff.valid.json');
const staleCases = await readJson('data/synthetic/governance/stale-context.cases.json');

// ============================================================================
// Positive — fresh, matching confirmations pass both gates
// ============================================================================

test('fresh pre-generation confirmation passes', () => {
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: valid.context,
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, true, `expected ok, got: ${r.error}`);
});

test('fresh pre-approval reconfirmation passes', () => {
  const r = assertPreApprovalHandoff({
    approver: validApproval.approver,
    reconfirmedContext: validApproval.reconfirmedContext,
    reconfirmedByRef: validApproval.reconfirmedByRef,
    originalContext: validApproval.originalContext,
    orgConfig,
    nowIso: validApproval.nowIso,
  });
  assert.equal(r.ok, true, `expected ok, got: ${r.error}`);
});

// ============================================================================
// Negative — pre-generation cases (data-driven from fixture)
// ============================================================================

for (const c of staleCases.preGenerationCases) {
  test(`refuses pre-generation handoff: ${c.name}`, () => {
    const r = assertPreGenerationHandoff({
      requester: c.requester,
      context: c.context,
      orgConfig,
      nowIso: c.nowIso,
    });
    assert.equal(r.ok, false, `expected refusal for case "${c.name}"`);
    assert.equal(r.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
  });
}

// ============================================================================
// Negative — pre-approval cases (data-driven from fixture)
// ============================================================================

for (const c of staleCases.preApprovalCases) {
  test(`refuses pre-approval handoff: ${c.name}`, () => {
    const r = assertPreApprovalHandoff({
      approver: c.approver,
      reconfirmedContext: c.reconfirmedContext,
      reconfirmedByRef: c.reconfirmedByRef,
      originalContext: c.originalContext,
      orgConfig,
      nowIso: c.nowIso,
    });
    assert.equal(r.ok, false, `expected refusal for case "${c.name}"`);
    assert.equal(r.failClosedCode, 'E-APPROVAL-WITHOUT-CONFIRMATION');
  });
}

// ============================================================================
// Boundary — exactly at the staleness threshold is still fresh; one
// millisecond past it is stale. Proves the comparison is a hard boundary,
// not an approximate one.
// ============================================================================

test('confirmation exactly at the maximum age is accepted (inclusive boundary)', () => {
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: { ...valid.context, preGenerationConfirmedAt: '2026-08-13T06:00:00Z' },
    orgConfig,
    nowIso: '2026-08-13T06:15:00Z', // exactly 15 minutes later
    maxContextAgeMs: 15 * 60 * 1000,
  });
  assert.equal(r.ok, true, `expected ok at the exact boundary, got: ${r.error}`);
});

test('confirmation one millisecond past the maximum age is refused', () => {
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: { ...valid.context, preGenerationConfirmedAt: '2026-08-13T06:00:00Z' },
    orgConfig,
    nowIso: '2026-08-13T06:15:00.001Z',
    maxContextAgeMs: 15 * 60 * 1000,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
});

// ============================================================================
// Configuration override — an organization may tighten the staleness window
// ============================================================================

test('a tighter orgConfig.operations.maxContextAgeMs is honoured', () => {
  const tightOrgConfig = { ...orgConfig, operations: { ...orgConfig.operations, maxContextAgeMs: 60_000 } };
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: { ...valid.context, preGenerationConfirmedAt: '2026-08-13T06:44:00Z' },
    orgConfig: tightOrgConfig,
    nowIso: '2026-08-13T06:45:30Z', // 90s later — exceeds a 60s window
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
});

test('a missing or non-positive maxContextAgeMs override falls back to the default rather than disabling the check', () => {
  assert.equal(_internal.resolveMaxContextAgeMs({ operations: { maxContextAgeMs: -1 } }), _internal.DEFAULT_MAX_CONTEXT_AGE_MS);
  assert.equal(_internal.resolveMaxContextAgeMs({ operations: { maxContextAgeMs: 0 } }), _internal.DEFAULT_MAX_CONTEXT_AGE_MS);
  assert.equal(_internal.resolveMaxContextAgeMs({}), _internal.DEFAULT_MAX_CONTEXT_AGE_MS);
  assert.equal(_internal.resolveMaxContextAgeMs(undefined), _internal.DEFAULT_MAX_CONTEXT_AGE_MS);
});

// ============================================================================
// Malformed timestamp — an unparsable value must be treated as maximally
// stale (age = Infinity), never as "fresh by default"
// ============================================================================

test('an unparsable preGenerationConfirmedAt is treated as infinitely stale', () => {
  assert.equal(_internal.ageMs('not-a-timestamp', '2026-08-13T06:45:00Z'), Infinity);
  const r = assertPreGenerationHandoff({
    requester: valid.requester,
    context: { ...valid.context, preGenerationConfirmedAt: 'not-a-timestamp' },
    orgConfig,
    nowIso: valid.nowIso,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failClosedCode, 'E-CONTEXT-UNCONFIRMED');
});
