/**
 * Approval event creation for the Shift Closeout workflow.
 *
 * Binds a human decision to a specific artifact SHA-256 and a second,
 * independently recorded patient and encounter confirmation. Refuses any
 * attempt to approve a draft for the wrong patient or encounter, and refuses
 * rejection and revision-requested decisions that carry no reason.
 *
 * No display names, email addresses, or free-text identity values are written
 * to the event — only opaque actorRef and roleCode, per REQ-AUD-002.
 */
import { scanText } from './phi-scan.mjs';

const ALLOWED_DECISIONS = new Set(['approved', 'rejected', 'revision-requested']);

const LIFECYCLE_MAP = {
  approved: 'APPROVED-SIMULATED',
  rejected: 'REJECTED',
  'revision-requested': 'REVISION-REQUESTED',
};

const STATUS_LABEL_MAP = {
  approved: 'APPROVED — SIMULATED FINALIZATION ONLY',
  rejected: 'REJECTED — NOT FOR USE',
  'revision-requested': 'REVISION REQUESTED — DRAFT WITHDRAWN',
};

/**
 * Create an approval event.
 *
 * @param {{
 *   approvalEventId: string,
 *   correlationId: string,
 *   recordedAt: string,
 *   organizationId: string,
 *   decision: 'approved' | 'rejected' | 'revision-requested',
 *   actorRef: string,
 *   roleCode: string,
 *   artifact: {
 *     artifactId: string,
 *     artifactVersion: string,
 *     artifactSha256: string,
 *     generationId: string,
 *     agentInstructionVersion: string
 *   },
 *   reconfirmedContext: {
 *     syntheticPatientId: string,
 *     syntheticEncounterId: string,
 *     preApprovalConfirmedAt: string,
 *     sourceBundleId: string,
 *     sourceBundleSha256: string
 *   },
 *   requestContext: {
 *     syntheticPatientId: string,
 *     syntheticEncounterId: string
 *   },
 *   decisionReason?: string,
 *   revisionNumber?: number,
 *   previousApprovalEventId?: string
 * }} params
 * @returns {{ event: object } | { error: string, failClosedCode: string }}
 */
export function createApprovalEvent(params) {
  const {
    approvalEventId, correlationId, recordedAt, organizationId, decision,
    actorRef, roleCode, artifact, reconfirmedContext, requestContext,
    decisionReason, revisionNumber, previousApprovalEventId,
  } = params;

  if (!ALLOWED_DECISIONS.has(decision)) {
    return {
      error: `unknown decision '${decision}'`,
      failClosedCode: 'E-INPUT-SCHEMA-INVALID',
    };
  }

  if (reconfirmedContext.syntheticPatientId !== requestContext.syntheticPatientId) {
    return {
      error: `reconfirmed patient (${reconfirmedContext.syntheticPatientId}) does not match request context (${requestContext.syntheticPatientId}) — approval refused`,
      failClosedCode: 'E-APPROVAL-WITHOUT-CONFIRMATION',
    };
  }

  if (reconfirmedContext.syntheticEncounterId !== requestContext.syntheticEncounterId) {
    return {
      error: `reconfirmed encounter (${reconfirmedContext.syntheticEncounterId}) does not match request context (${requestContext.syntheticEncounterId}) — approval refused`,
      failClosedCode: 'E-APPROVAL-WITHOUT-CONFIRMATION',
    };
  }

  if ((decision === 'rejected' || decision === 'revision-requested') && !decisionReason) {
    return {
      error: `decision '${decision}' requires a decisionReason`,
      failClosedCode: 'E-INPUT-SCHEMA-INVALID',
    };
  }

  if (decisionReason) {
    const scan = scanText(decisionReason);
    if (!scan.passed) {
      return {
        error: `decision reason contains disallowed content: ${scan.findings.map(f => f.description).join('; ')}`,
        failClosedCode: 'E-SAFETY-FLAG',
      };
    }
  }

  const event = {
    contractVersion: '1.0.0',
    approvalEventId,
    correlationId,
    recordedAt,
    organizationId,
    decision,
    approver: { actorRef, roleCode, authenticated: true },
    artifact,
    reconfirmedContext,
    lifecycleStatus: LIFECYCLE_MAP[decision],
    statusLabel: STATUS_LABEL_MAP[decision],
  };

  if (decisionReason !== undefined && decisionReason !== null) {
    event.decisionReason = decisionReason;
    event.decisionReasonScanned = true;
  }
  if (revisionNumber !== undefined) event.revisionNumber = revisionNumber;
  if (previousApprovalEventId) event.previousApprovalEventId = previousApprovalEventId;

  return { event };
}
