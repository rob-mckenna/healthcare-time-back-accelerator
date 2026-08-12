/**
 * Minimal audit event builder and emitter for the Shift Closeout workflow.
 *
 * Design constraints from REQ-AUD-003 and ADR-20260812-008:
 * - An audit write failure must emit E-AUDIT-WRITE-FAILURE and stop the run.
 * - The failure must never be logged and swallowed.
 * - No narrative, generated content, or sensitive payload may appear in an event.
 * - Every FAILED or BLOCKED outcome must carry a failClosedCode.
 */

/**
 * Emit an audit event to the configured sink.
 *
 * @param {object} event - Audit event conforming to audit-event.schema.json
 * @param {Function} sink - async (event: object) => void
 * @returns {Promise<{ success: boolean, failClosedCode?: string, detail?: string }>}
 */
export async function emitAuditEvent(event, sink) {
  if (typeof sink !== 'function') {
    return {
      success: false,
      failClosedCode: 'E-AUDIT-WRITE-FAILURE',
      detail: 'no audit sink configured',
    };
  }
  try {
    await sink(event);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      failClosedCode: 'E-AUDIT-WRITE-FAILURE',
      detail: err?.message ?? 'audit sink threw an error',
    };
  }
}

/**
 * Build a minimal audit event conforming to audit-event.schema.json.
 * Only the fields required or meaningful for the given event type are set.
 *
 * @param {object} params
 * @param {string} params.auditEventId
 * @param {string} params.eventType
 * @param {string} params.correlationId
 * @param {string} params.occurredAt
 * @param {string} params.organizationId
 * @param {string} params.actorRef
 * @param {'human' | 'agent' | 'system'} params.actorType
 * @param {string} [params.actorRoleCode]
 * @param {'success' | 'failure' | 'blocked'} params.outcome
 * @param {string} [params.failClosedCode]
 * @param {string} [params.outcomeDetail]
 * @param {string} [params.syntheticPatientId]
 * @param {string} [params.syntheticEncounterId]
 * @param {string} [params.artifactId]
 * @param {string} [params.artifactVersion]
 * @param {string} [params.generationId]
 * @param {string} [params.approvalEventId]
 * @param {boolean} [params.schemaValidationPassed]
 * @param {boolean} [params.groundingVerified]
 * @param {boolean} [params.decisionReasonPresent]
 * @param {number} [params.revisionNumber]
 * @returns {object}
 */
export function buildAuditEvent(params) {
  const {
    auditEventId, eventType, correlationId, occurredAt, organizationId,
    actorRef, actorType, actorRoleCode, outcome, failClosedCode, outcomeDetail,
    syntheticPatientId, syntheticEncounterId,
    artifactId, artifactVersion, generationId, approvalEventId,
    schemaValidationPassed, groundingVerified, decisionReasonPresent, revisionNumber,
  } = params;

  const event = {
    contractVersion: '1.0.0',
    auditEventId,
    eventType,
    correlationId,
    occurredAt,
    organizationId,
    actorRef,
    actorType,
    outcome,
  };

  if (actorRoleCode != null)            event.actorRoleCode = actorRoleCode;
  if (failClosedCode != null)           event.failClosedCode = failClosedCode;
  if (outcomeDetail != null)            event.outcomeDetail = outcomeDetail;
  if (syntheticPatientId != null)       event.syntheticPatientId = syntheticPatientId;
  if (syntheticEncounterId != null)     event.syntheticEncounterId = syntheticEncounterId;
  if (artifactId != null)               event.artifactId = artifactId;
  if (artifactVersion != null)          event.artifactVersion = artifactVersion;
  if (generationId != null)             event.generationId = generationId;
  if (approvalEventId != null)          event.approvalEventId = approvalEventId;
  if (schemaValidationPassed != null)   event.schemaValidationPassed = schemaValidationPassed;
  if (groundingVerified != null)        event.groundingVerified = groundingVerified;
  if (decisionReasonPresent != null)    event.decisionReasonPresent = decisionReasonPresent;
  if (revisionNumber != null)           event.revisionNumber = revisionNumber;

  return event;
}
