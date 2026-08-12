/**
 * Context guard — patient and encounter confirmation gates.
 *
 * REQ-WF-002  REQ-SAFE-004  REQ-APPR-003  ADR-20260812-009
 * See docs/conventions/draft-and-safety-status.md §Confirmation gates
 *
 * Patient and encounter are confirmed twice, and the two confirmations must match.
 *
 * Gate 1 — before generation:  context.preGenerationConfirmedAt  → E-CONTEXT-UNCONFIRMED
 * Gate 2 — before approval:    reconfirmedContext.preApprovalConfirmedAt → E-APPROVAL-WITHOUT-CONFIRMATION
 *                               plus: patient and encounter IDs must equal those in the request.
 */

import { failClosed } from './fail-closed.mjs';

const SYN_PAT_PATTERN = /^SYN-PAT-[A-Z0-9]{8,16}$/;
const SYN_ENC_PATTERN = /^SYN-ENC-[A-Z0-9]{8,16}$/;
const UTC_TS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const ACTOR_REF_PATTERN = /^(USR|AGT|SYS)-[A-Z0-9]{8,24}$/;

/**
 * Assert pre-generation confirmation is present and well-formed.
 *
 * @param {object} context — request.context
 * @throws FailClosedError E-CONTEXT-UNCONFIRMED
 */
export function assertPreGenerationConfirmed(context) {
  if (!context || typeof context !== 'object') {
    throw failClosed('E-CONTEXT-UNCONFIRMED', 'context is absent');
  }
  if (!context.syntheticPatientId || !SYN_PAT_PATTERN.test(context.syntheticPatientId)) {
    throw failClosed('E-CONTEXT-UNCONFIRMED', 'context.syntheticPatientId is missing or malformed');
  }
  if (!context.syntheticEncounterId || !SYN_ENC_PATTERN.test(context.syntheticEncounterId)) {
    throw failClosed('E-CONTEXT-UNCONFIRMED', 'context.syntheticEncounterId is missing or malformed');
  }
  if (!context.preGenerationConfirmedAt || !UTC_TS_PATTERN.test(context.preGenerationConfirmedAt)) {
    throw failClosed('E-CONTEXT-UNCONFIRMED', 'context.preGenerationConfirmedAt is missing or not a valid UTC timestamp');
  }
  if (!context.confirmedByRef || !ACTOR_REF_PATTERN.test(context.confirmedByRef)) {
    throw failClosed('E-CONTEXT-UNCONFIRMED', 'context.confirmedByRef is missing or malformed');
  }
}

/**
 * Assert pre-approval context reconfirmation is present and consistent with the original request.
 *
 * The cross-field rule context-reconfirmation-match requires that patient and encounter
 * identifiers in the approval event equal those in the agent input. A user cannot approve
 * a draft for a different subject than the one they requested.
 *
 * @param {object} reconfirmedContext — approval event reconfirmedContext
 * @param {object} originalContext — request context (generation gate values)
 * @throws FailClosedError E-APPROVAL-WITHOUT-CONFIRMATION
 */
export function assertPreApprovalConfirmed(reconfirmedContext, originalContext) {
  if (!reconfirmedContext || typeof reconfirmedContext !== 'object') {
    throw failClosed('E-APPROVAL-WITHOUT-CONFIRMATION', 'reconfirmedContext is absent');
  }
  if (!reconfirmedContext.preApprovalConfirmedAt || !UTC_TS_PATTERN.test(reconfirmedContext.preApprovalConfirmedAt)) {
    throw failClosed('E-APPROVAL-WITHOUT-CONFIRMATION', 'reconfirmedContext.preApprovalConfirmedAt is missing or invalid');
  }

  if (reconfirmedContext.syntheticPatientId !== originalContext.syntheticPatientId) {
    throw failClosed(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `context-reconfirmation-match: patient mismatch (approval="${reconfirmedContext.syntheticPatientId}" ` +
      `request="${originalContext.syntheticPatientId}")`
    );
  }
  if (reconfirmedContext.syntheticEncounterId !== originalContext.syntheticEncounterId) {
    throw failClosed(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `context-reconfirmation-match: encounter mismatch (approval="${reconfirmedContext.syntheticEncounterId}" ` +
      `request="${originalContext.syntheticEncounterId}")`
    );
  }
}
