/**
 * Assert authorized requester — provenance-safe identity handoff for the
 * Copilot Studio → Microsoft Foundry connected-agent path.
 *
 * Requirement IDs: REQ-WF-001, REQ-APPR-001, REQ-APPR-002, REQ-APPR-003,
 * REQ-SAFE-004, REQ-AUD-002
 * Raised against: BLOCKER-001, BLOCKER-002 (docs/risks.md)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS MODULE EXISTS
 *
 * BLOCKER-001 was resolved to use Copilot Studio's built-in, preview
 * Microsoft Foundry connected-agent path rather than a Power Automate proxy
 * that this team controls. Current Microsoft Learn documentation for that
 * path describes project-endpoint and Agent-ID configuration; it does not
 * document whether the signed-in user's Microsoft Entra identity or role
 * claims are propagated to the connected agent, in what shape, or under what
 * conditions they might be absent, stale, or spoofed by an intermediate
 * component. Per SQUAD_BOOTSTRAP.md §5 ("Transparent limitations") and the
 * synthetic-only, fail-closed decision in `.squad/decisions.md`, this
 * repository must not assume undocumented product behaviour.
 *
 * This module is the solution-owned, fail-closed control that stands in for
 * that undocumented propagation. It defines the exact "identity handoff
 * envelope" (docs/governance/identity-handoff-contract.md) that a caller must
 * present, and it validates every field explicitly and structurally rather
 * than trusting anything asserted by the upstream Copilot Studio layer.
 *
 * This module does not, and cannot, verify that Copilot Studio's connected
 * Foundry agent actually receives or enforces these values at runtime — that
 * requires connected-tenant testing (tracked as a dependency on #4 and #6).
 * What it verifies is that the production orchestration cannot proceed to
 * generation or approval without a requester object that satisfies every
 * gate below, and that no email, display name, token, or other direct
 * identifier is accepted into governed state.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Design notes:
 *   - Functions in this module return result objects (never throw), matching
 *     the convention already used by src/governance/approval.mjs and
 *     src/governance/audit.mjs. Callers map a non-ok result to the existing
 *     fail-closed codes defined in
 *     contracts/schemas/common/definitions.schema.json#/$defs/failClosedCode.
 *     No new fail-closed code is introduced — contracts/** is out of scope
 *     for this change; see the Trinity redline request in the WP-05 report.
 *   - src/orchestration/identity-guard.mjs delegates to this module so the
 *     standalone governance checks and the running workflow cannot drift.
 */

import { findSensitiveKeyPaths } from './sensitive-keys.mjs';

const ACTOR_REF_PATTERN = /^(USR|AGT|SYS)-[A-Z0-9]{8,24}$/;
const HUMAN_ACTOR_REF_PATTERN = /^USR-[A-Z0-9]{8,24}$/;
const SYN_PAT_PATTERN = /^SYN-PAT-[A-Z0-9]{8,16}$/;
const SYN_ENC_PATTERN = /^SYN-ENC-[A-Z0-9]{8,16}$/;
const UTC_TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

/** Role codes recognised by the shared contract vocabulary. */
const ROLE_CODES = new Set([
  'registered-nurse', 'charge-nurse', 'clinical-supervisor',
  'administrator', 'demo-observer',
]);

/**
 * Default maximum age of a patient/encounter confirmation before it is
 * treated as stale. Fifteen minutes is generous for a single-sitting
 * shift-closeout review and short enough that a captured or replayed
 * confirmation cannot be reused across a materially different session.
 * Overridable via orgConfig.operations.maxContextAgeMs so a deployment can
 * tighten it without a code change; a missing or non-positive override falls
 * back to this default rather than disabling the check.
 */
const DEFAULT_MAX_CONTEXT_AGE_MS = 15 * 60 * 1000;

/**
 * Deny-list of field names that must never appear anywhere in a connected-
 * agent handoff payload, at any nesting depth. Presence of any of these keys
 * means an identity-bearing value (name, email, token, tenant/object
 * identifier, phone, date of birth) is attempting to cross the handoff
 * boundary — exactly the propagation this module exists to prevent, whether
 * the source is a misconfigured topic variable, a directory claim passed
 * through unfiltered, or an adversarial test.
 */
const findForbiddenIdentityFields = findSensitiveKeyPaths;

/**
 * Resolve the effective maximum context age in milliseconds.
 * @param {object} [orgConfig]
 * @returns {number}
 */
function resolveMaxContextAgeMs(orgConfig) {
  const configured = orgConfig?.operations?.maxContextAgeMs;
  return typeof configured === 'number' && configured > 0 ? configured : DEFAULT_MAX_CONTEXT_AGE_MS;
}

/**
 * Compute the age, in milliseconds, of a UTC timestamp relative to now.
 * Returns Infinity for a malformed or unparsable timestamp so callers that
 * compare against a maximum age fail closed rather than treating garbage as
 * "fresh".
 *
 * @param {string} utcTimestamp
 * @param {string} nowIso
 * @returns {number}
 */
function ageMs(utcTimestamp, nowIso) {
  if (typeof utcTimestamp !== 'string' || !UTC_TS_PATTERN.test(utcTimestamp)) return Infinity;
  const then = Date.parse(utcTimestamp);
  const now = Date.parse(nowIso);
  if (Number.isNaN(then) || Number.isNaN(now)) return Infinity;
  return now - then;
}

function refuse(failClosedCode, error) {
  return { ok: false, authorized: false, error, failClosedCode };
}

/**
 * Assert that a requester is authenticated, carries a well-formed opaque
 * human USR- actorRef, and holds a roleCode that is both a recognised contract role and
 * explicitly authorized for the given organization. This is the same shape
 * of check performed by src/orchestration/identity-guard.mjs, reimplemented
 * here as an independent, non-throwing gate for the connected-agent handoff
 * so the identity check cannot be bypassed by a defect or omission in the
 * orchestration layer's single implementation.
 *
 * @param {{ actorRef?: string, roleCode?: string, authenticated?: boolean }} requester
 * @param {object} orgConfig — loaded organization configuration
 * @returns {{ ok: true, authorized: true } | { ok: false, authorized: false, error: string, failClosedCode: 'E-IDENTITY-MISSING' }}
 */
export function assertAuthorizedRequester(requester, orgConfig) {
  if (!requester || typeof requester !== 'object') {
    return refuse('E-IDENTITY-MISSING', 'requester is absent');
  }
  if (requester.authenticated !== true) {
    return refuse('E-IDENTITY-MISSING', 'requester.authenticated is not true');
  }
  if (!requester.actorRef || typeof requester.actorRef !== 'string' || !HUMAN_ACTOR_REF_PATTERN.test(requester.actorRef)) {
    return refuse('E-IDENTITY-MISSING', 'requester.actorRef is missing, malformed, or not a human USR- reference');
  }
  if (!requester.roleCode || !ROLE_CODES.has(requester.roleCode)) {
    return refuse('E-IDENTITY-MISSING', `requester.roleCode "${requester.roleCode}" is not a recognised role code`);
  }
  const authorizedRoleCodes = orgConfig?.personas?.authorizedRoleCodes ?? [];
  if (!authorizedRoleCodes.includes(requester.roleCode)) {
    return refuse(
      'E-IDENTITY-MISSING',
      `requester.roleCode "${requester.roleCode}" is not authorized for organization "${orgConfig?.organizationId ?? 'unknown'}"`
    );
  }
  return { ok: true, authorized: true };
}

/**
 * Assert that a handoff payload carries no propagated identity-bearing
 * fields (name, email, token, tenant/object identifier, phone, date of
 * birth, etc.) anywhere in its structure. Field *names* only are inspected;
 * values are never inspected, so this check works even against a payload the
 * caller does not otherwise trust.
 *
 * @param {object} handoff — any object destined to cross the connected-agent boundary
 * @returns {{ ok: true } | { ok: false, error: string, failClosedCode: 'E-IDENTITY-MISSING' }}
 */
export function assertNoIdentityPropagation(handoff) {
  const findings = findForbiddenIdentityFields(handoff);
  if (findings.length > 0) {
    return refuse(
      'E-IDENTITY-MISSING',
      `handoff payload carries disallowed identity-bearing field name(s): ${findings.join(', ')}`
    );
  }
  return { ok: true };
}

/**
 * Assert the pre-generation identity and context handoff for the connected-
 * agent path. This is the single gate that must pass before any Foundry
 * invocation is attempted:
 *
 *   1. requester is authenticated, opaque, and authorized (assertAuthorizedRequester)
 *   2. the full handoff payload carries no identity-bearing fields
 *   3. context.syntheticPatientId / syntheticEncounterId are well-formed synthetic identifiers
 *   4. context.preGenerationConfirmedAt is a valid, non-stale UTC timestamp
 *   5. context.confirmedByRef is present and equals requester.actorRef — the
 *      person the request is attributed to must be the same person who
 *      confirmed the patient and encounter (rejects a "wrong confirmer")
 *
 * @param {object} params
 * @param {{ actorRef: string, roleCode: string, authenticated: boolean }} params.requester
 * @param {{ syntheticPatientId: string, syntheticEncounterId: string, preGenerationConfirmedAt: string, confirmedByRef: string }} params.context
 * @param {object} params.orgConfig — loaded organization configuration
 * @param {string} [params.nowIso] — override "now" for deterministic tests; defaults to the current time
 * @param {number} [params.maxContextAgeMs] — override the staleness threshold; defaults to orgConfig.operations.maxContextAgeMs or 15 minutes
 * @returns {{ ok: true } | { ok: false, error: string, failClosedCode: 'E-IDENTITY-MISSING' | 'E-CONTEXT-UNCONFIRMED' }}
 */
export function assertPreGenerationHandoff(params) {
  const { requester, context, orgConfig, nowIso = new Date().toISOString(), maxContextAgeMs } = params ?? {};

  const identity = assertAuthorizedRequester(requester, orgConfig);
  if (!identity.ok) return refuse(identity.failClosedCode, identity.error);

  const provenance = assertNoIdentityPropagation({ requester, context });
  if (!provenance.ok) return refuse(provenance.failClosedCode, provenance.error);

  if (!context || typeof context !== 'object') {
    return refuse('E-CONTEXT-UNCONFIRMED', 'context is absent');
  }
  if (!context.syntheticPatientId || !SYN_PAT_PATTERN.test(context.syntheticPatientId)) {
    return refuse('E-CONTEXT-UNCONFIRMED', 'context.syntheticPatientId is missing or malformed');
  }
  if (!context.syntheticEncounterId || !SYN_ENC_PATTERN.test(context.syntheticEncounterId)) {
    return refuse('E-CONTEXT-UNCONFIRMED', 'context.syntheticEncounterId is missing or malformed');
  }
  if (!context.preGenerationConfirmedAt || !UTC_TS_PATTERN.test(context.preGenerationConfirmedAt)) {
    return refuse('E-CONTEXT-UNCONFIRMED', 'context.preGenerationConfirmedAt is missing or not a valid UTC timestamp');
  }
  if (!context.confirmedByRef || !ACTOR_REF_PATTERN.test(context.confirmedByRef)) {
    return refuse('E-CONTEXT-UNCONFIRMED', 'context.confirmedByRef is missing or malformed');
  }
  if (context.confirmedByRef !== requester.actorRef) {
    return refuse(
      'E-CONTEXT-UNCONFIRMED',
      `context.confirmedByRef ("${context.confirmedByRef}") does not match requester.actorRef ("${requester.actorRef}") — wrong confirmer`
    );
  }

  const effectiveMax = typeof maxContextAgeMs === 'number' && maxContextAgeMs > 0
    ? maxContextAgeMs
    : resolveMaxContextAgeMs(orgConfig);
  const age = ageMs(context.preGenerationConfirmedAt, nowIso);
  if (age > effectiveMax) {
    return refuse(
      'E-CONTEXT-UNCONFIRMED',
      `context.preGenerationConfirmedAt is stale (age ${age}ms exceeds maximum ${effectiveMax}ms)`
    );
  }
  if (age < 0) {
    return refuse('E-CONTEXT-UNCONFIRMED', 'context.preGenerationConfirmedAt is in the future');
  }

  return { ok: true };
}

/**
 * Assert the pre-approval identity and context handoff for the connected-
 * agent path. This is the second, independent gate that must pass before any
 * approve/reject/revise decision is recorded:
 *
 *   1. approver is authenticated, opaque, and authorized (assertAuthorizedRequester)
 *   2. the full handoff payload carries no identity-bearing fields
 *   3. reconfirmedContext.syntheticPatientId / syntheticEncounterId equal originalContext
 *      (rejects approval of a draft generated for a different patient/encounter)
 *   4. reconfirmedContext.preApprovalConfirmedAt is a valid, non-stale UTC timestamp
 *   5. reconfirmedByRef equals approver.actorRef — the person confirming at
 *      approval time must be the same person recording the decision (rejects
 *      a "wrong confirmer" at the approval gate, independent of the
 *      pre-generation confirmer)
 *
 * @param {object} params
 * @param {{ actorRef: string, roleCode: string, authenticated: boolean }} params.approver
 * @param {{ syntheticPatientId: string, syntheticEncounterId: string, preApprovalConfirmedAt: string }} params.reconfirmedContext
 * @param {string} params.reconfirmedByRef — opaque actorRef of the person who performed the reconfirmation
 * @param {{ syntheticPatientId: string, syntheticEncounterId: string }} params.originalContext
 * @param {object} params.orgConfig — loaded organization configuration
 * @param {string} [params.nowIso]
 * @param {number} [params.maxContextAgeMs]
 * @returns {{ ok: true } | { ok: false, error: string, failClosedCode: 'E-IDENTITY-MISSING' | 'E-APPROVAL-WITHOUT-CONFIRMATION' }}
 */
export function assertPreApprovalHandoff(params) {
  const {
    approver, reconfirmedContext, reconfirmedByRef, originalContext,
    orgConfig, nowIso = new Date().toISOString(), maxContextAgeMs,
  } = params ?? {};

  const identity = assertAuthorizedRequester(approver, orgConfig);
  if (!identity.ok) return refuse(identity.failClosedCode, identity.error);

  const provenance = assertNoIdentityPropagation({ approver, reconfirmedContext, reconfirmedByRef });
  if (!provenance.ok) return refuse(provenance.failClosedCode, provenance.error);

  if (!reconfirmedContext || typeof reconfirmedContext !== 'object') {
    return refuse('E-APPROVAL-WITHOUT-CONFIRMATION', 'reconfirmedContext is absent');
  }
  if (!originalContext || typeof originalContext !== 'object') {
    return refuse('E-APPROVAL-WITHOUT-CONFIRMATION', 'originalContext is absent');
  }
  if (!reconfirmedContext.preApprovalConfirmedAt || !UTC_TS_PATTERN.test(reconfirmedContext.preApprovalConfirmedAt)) {
    return refuse('E-APPROVAL-WITHOUT-CONFIRMATION', 'reconfirmedContext.preApprovalConfirmedAt is missing or invalid');
  }
  if (reconfirmedContext.syntheticPatientId !== originalContext.syntheticPatientId) {
    return refuse(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `reconfirmed patient ("${reconfirmedContext.syntheticPatientId}") does not match original request context ("${originalContext.syntheticPatientId}")`
    );
  }
  if (reconfirmedContext.syntheticEncounterId !== originalContext.syntheticEncounterId) {
    return refuse(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `reconfirmed encounter ("${reconfirmedContext.syntheticEncounterId}") does not match original request context ("${originalContext.syntheticEncounterId}")`
    );
  }
  if (!reconfirmedByRef || !ACTOR_REF_PATTERN.test(reconfirmedByRef)) {
    return refuse('E-APPROVAL-WITHOUT-CONFIRMATION', 'reconfirmedByRef is missing or malformed');
  }
  if (reconfirmedByRef !== approver.actorRef) {
    return refuse(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `reconfirmedByRef ("${reconfirmedByRef}") does not match approver.actorRef ("${approver.actorRef}") — wrong confirmer`
    );
  }

  const effectiveMax = typeof maxContextAgeMs === 'number' && maxContextAgeMs > 0
    ? maxContextAgeMs
    : resolveMaxContextAgeMs(orgConfig);
  const age = ageMs(reconfirmedContext.preApprovalConfirmedAt, nowIso);
  if (age > effectiveMax) {
    return refuse(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `reconfirmedContext.preApprovalConfirmedAt is stale (age ${age}ms exceeds maximum ${effectiveMax}ms)`
    );
  }
  if (age < 0) {
    return refuse('E-APPROVAL-WITHOUT-CONFIRMATION', 'reconfirmedContext.preApprovalConfirmedAt is in the future');
  }

  return { ok: true };
}

export const _internal = {
  ACTOR_REF_PATTERN,
  ROLE_CODES,
  HUMAN_ACTOR_REF_PATTERN,
  DEFAULT_MAX_CONTEXT_AGE_MS,
  findForbiddenIdentityFields,
  resolveMaxContextAgeMs,
  ageMs,
};
