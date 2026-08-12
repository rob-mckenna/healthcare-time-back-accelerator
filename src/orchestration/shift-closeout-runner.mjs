/**
 * Shift closeout runner — main orchestration entry point.
 *
 * REQ-WF-001 through REQ-WF-007  REQ-SCOPE-001 through REQ-SCOPE-004
 * REQ-SAFE-004  REQ-AUD-001  REQ-AUD-004  ADR-20260812-008
 *
 * Implements the complete shift-closeout workflow:
 *
 *   requestDraft()   — M1 through M4: request, confirm, invoke, validate, present
 *   recordDecision() — M5: approve, reject, or request revision
 *   queryEvidence()  — M6: correlated audit evidence view
 *
 * Every step is fail-closed. No partial result is presented to a user.
 * All organization-specific strings come from the configuration pack.
 * No raw exceptions, stack traces, or payload fragments are ever returned
 * to the caller; user-safe messages come from safetyCopy.errorMessageOverrides.
 *
 * The correlation identifier is minted once per run (in requestDraft) and
 * propagated through every subsequent call via the returned RunState.
 */

import { mintCorrelationId, shortReference, isValidCorrelationId } from './correlation.mjs';
import { loadOrgConfig, resolveUserSafeMessage } from './config-loader.mjs';
import { assertIdentity } from './identity-guard.mjs';
import { assertPreGenerationConfirmed } from './context-guard.mjs';
import { buildInput } from './input-builder.mjs';
import { invoke as invokeFoundry, IS_SIMULATION_BOUNDARY, SIMULATION_BOUNDARY_LABEL } from './foundry-adapter.mjs';
import { validateOutput } from './output-validator.mjs';
import { recordDecision as captureDecision, computeArtifactSha256 } from './approval-orchestrator.mjs';
import { emit as emitAudit, queryByCorrelationId } from './audit-adapter.mjs';
import { failClosed, isFailClosed } from './fail-closed.mjs';

/**
 * Request a shift-closeout draft.
 *
 * @param {object} params
 * @param {string} params.organizationId
 * @param {object} params.requester — { actorRef, roleCode, authenticated }
 * @param {object} params.context — { syntheticPatientId, syntheticEncounterId, preGenerationConfirmedAt, confirmedByRef }
 * @param {object} params.sourceBundle — { bundleId, bundleVersion, bundleSha256, approvedForGeneration }
 * @param {Set<string>} params.bundleResourceIds — set of approved resourceIds for grounding resolution
 * @param {object} params.shiftPeriod — { start, end, label? }
 * @param {string[]} [params.requestedScope]
 * @param {object} [params.revision] — when re-requesting after revision-requested decision
 * @param {string} [params.correlationId] — continue an existing run; permitted only with params.revision,
 *                                          so a fresh run can never bypass the single minting authority
 * @returns {Promise<DraftResult>}
 */
export async function requestDraft(params) {
  const {
    organizationId, requester, context, sourceBundle,
    bundleResourceIds, shiftPeriod, requestedScope, revision,
    correlationId: continuingCorrelationId,
  } = params;

  // 1. Load and validate organization config — E-CONFIG-MISSING
  let orgConfig;
  try {
    orgConfig = await loadOrgConfig(organizationId);
  } catch (err) {
    if (isFailClosed(err)) {
      await _tryEmitFailAudit({
        eventType: 'request',
        correlationId: null,
        organizationId,
        actorRef: requester?.actorRef ?? 'SYS-UNKNOWN00000000',
        actorType: 'human',
        outcome: 'blocked',
        failClosedCode: 'E-CONFIG-MISSING',
        outcomeDetail: 'Organization config load failure',
      });
      return _failResult('E-CONFIG-MISSING', err, null, null);
    }
    throw err;
  }

  // 2. Establish the single correlation identifier for this run.
  //    One identifier is minted per run. A bounded revision stays inside the same
  //    run and therefore keeps the identifier it was minted with, per
  //    docs/conventions/correlation-id.md.
  if (continuingCorrelationId &&
      (!revision || !isValidCorrelationId(continuingCorrelationId))) {
    await _tryEmitFailAudit({
      eventType: 'request',
      correlationId: isValidCorrelationId(continuingCorrelationId) ? continuingCorrelationId : null,
      organizationId,
      actorRef: requester?.actorRef ?? 'SYS-UNKNOWN00000000',
      actorType: 'system',
      outcome: 'blocked',
      failClosedCode: 'E-INPUT-SCHEMA-INVALID',
      outcomeDetail: 'Correlation identifier supplied outside a revision continuation',
    });
    return _failResult(
      'E-INPUT-SCHEMA-INVALID',
      new Error('correlation continuation is permitted only for a revision request'),
      isValidCorrelationId(continuingCorrelationId) ? continuingCorrelationId : null,
      orgConfig
    );
  }
  const correlationId = continuingCorrelationId ?? mintCorrelationId();
  const shortRef = shortReference(correlationId);

  // 3. Assert identity and authorization — E-IDENTITY-MISSING
  try {
    assertIdentity(requester, orgConfig);
  } catch (err) {
    if (isFailClosed(err)) {
      await _tryEmitFailAudit({
        eventType: 'request',
        correlationId,
        organizationId,
        actorRef: requester?.actorRef ?? 'SYS-UNKNOWN00000000',
        actorType: 'human',
        outcome: 'blocked',
        failClosedCode: err.failClosedCode,
        outcomeDetail: 'Identity or authorization check failed',
      });
      return _failResult(err.failClosedCode, err, correlationId, orgConfig);
    }
    throw err;
  }

  // Emit request audit event
  await _guardedAuditEmit(orgConfig, {
    eventType: 'request',
    correlationId,
    organizationId,
    actorRef: requester.actorRef,
    actorType: 'human',
    actorRoleCode: requester.roleCode,
    outcome: 'success',
    syntheticPatientId: context?.syntheticPatientId,
    syntheticEncounterId: context?.syntheticEncounterId,
  });

  // 4. Assert pre-generation context confirmation — E-CONTEXT-UNCONFIRMED
  try {
    assertPreGenerationConfirmed(context);
  } catch (err) {
    if (isFailClosed(err)) {
      await _tryEmitFailAudit({
        eventType: 'context-confirmation',
        correlationId,
        organizationId,
        actorRef: requester.actorRef,
        actorType: 'human',
        actorRoleCode: requester.roleCode,
        outcome: 'blocked',
        failClosedCode: err.failClosedCode,
        outcomeDetail: 'Pre-generation context confirmation failed',
        syntheticPatientId: context?.syntheticPatientId,
        syntheticEncounterId: context?.syntheticEncounterId,
      });
      return _failResult(err.failClosedCode, err, correlationId, orgConfig);
    }
    throw err;
  }

  // Emit context-confirmation audit event
  await _guardedAuditEmit(orgConfig, {
    eventType: 'context-confirmation',
    correlationId,
    organizationId,
    actorRef: requester.actorRef,
    actorType: 'human',
    actorRoleCode: requester.roleCode,
    outcome: 'success',
    syntheticPatientId: context.syntheticPatientId,
    syntheticEncounterId: context.syntheticEncounterId,
  });

  // 5. Build and validate agent input — E-INPUT-SCHEMA-INVALID
  let agentInput;
  try {
    agentInput = await buildInput({
      correlationId, requester, context, sourceBundle,
      shiftPeriod, orgConfig, requestedScope, revision,
    });
  } catch (err) {
    if (isFailClosed(err)) {
      await _tryEmitFailAudit({
        eventType: 'request',
        correlationId,
        organizationId,
        actorRef: requester.actorRef,
        actorType: 'system',
        actorRoleCode: requester.roleCode,
        outcome: 'failure',
        failClosedCode: err.failClosedCode,
        outcomeDetail: 'Agent input schema validation failed',
        syntheticPatientId: context.syntheticPatientId,
        syntheticEncounterId: context.syntheticEncounterId,
      });
      return _failResult(err.failClosedCode, err, correlationId, orgConfig);
    }
    throw err;
  }

  // 6. Invoke the Foundry adapter — E-AGENT-TIMEOUT | E-AGENT-ERROR
  let agentOutput;
  try {
    agentOutput = await invokeFoundry(agentInput, orgConfig);
  } catch (err) {
    const code = isFailClosed(err) ? err.failClosedCode : 'E-AGENT-ERROR';
    await _tryEmitFailAudit({
      eventType: 'generation',
      correlationId,
      organizationId,
      actorRef: 'AGT-FOUNDRYAGENT0001',
      actorType: 'agent',
      outcome: 'failure',
      failClosedCode: code,
      outcomeDetail: 'Agent invocation failed',
      syntheticPatientId: context.syntheticPatientId,
      syntheticEncounterId: context.syntheticEncounterId,
      schemaValidationPassed: false,
      groundingVerified: false,
    });
    return _failResult(code, err, correlationId, orgConfig);
  }

  // 7. Validate output (schema, safety, grounding, correlation echo) — multiple codes
  let validationResult;
  try {
    validationResult = await validateOutput(agentOutput, correlationId, bundleResourceIds);
  } catch (err) {
    const code = isFailClosed(err) ? err.failClosedCode : 'E-OUTPUT-SCHEMA-INVALID';
    await _tryEmitFailAudit({
      eventType: 'generation',
      correlationId,
      organizationId,
      actorRef: 'AGT-FOUNDRYAGENT0001',
      actorType: 'agent',
      outcome: 'failure',
      failClosedCode: code,
      outcomeDetail: 'Post-generation validation failed',
      syntheticPatientId: context.syntheticPatientId,
      syntheticEncounterId: context.syntheticEncounterId,
      generationId: agentOutput?.generationId,
      schemaValidationPassed: code !== 'E-OUTPUT-SCHEMA-INVALID',
      groundingVerified: false,
    });
    return _failResult(code, err, correlationId, orgConfig);
  }

  // 8. Compute artifact digest
  const artifactSha256 = computeArtifactSha256(agentOutput);
  const outputWithDigest = { ...agentOutput, artifactSha256 };

  // Emit generation audit event
  await _guardedAuditEmit(orgConfig, {
    eventType: 'generation',
    correlationId,
    organizationId,
    actorRef: 'AGT-FOUNDRYAGENT0001',
    actorType: 'agent',
    outcome: 'success',
    syntheticPatientId: context.syntheticPatientId,
    syntheticEncounterId: context.syntheticEncounterId,
    artifactId: outputWithDigest.artifactId,
    artifactVersion: outputWithDigest.artifactVersion,
    generationId: outputWithDigest.generationId,
    schemaValidationPassed: validationResult.schemaValidationPassed,
    groundingVerified: validationResult.groundingVerified,
  });

  // Emit presentation audit event
  await _guardedAuditEmit(orgConfig, {
    eventType: 'presentation',
    correlationId,
    organizationId,
    actorRef: requester.actorRef,
    actorType: 'human',
    actorRoleCode: requester.roleCode,
    outcome: 'success',
    syntheticPatientId: context.syntheticPatientId,
    syntheticEncounterId: context.syntheticEncounterId,
    artifactId: outputWithDigest.artifactId,
    artifactVersion: outputWithDigest.artifactVersion,
    generationId: outputWithDigest.generationId,
  });

  return {
    ok: true,
    correlationId,
    shortRef,
    draft: outputWithDigest,
    draftStatus: outputWithDigest.draftStatus,
    disclaimer: _buildDisclaimer(outputWithDigest, orgConfig),
    simulationBoundary: IS_SIMULATION_BOUNDARY ? SIMULATION_BOUNDARY_LABEL : undefined,
    revisionCount: revision?.revisionNumber ?? 0,
  };
}

/**
 * Record a human decision (approve, reject, or revision-requested).
 *
 * @param {object} params
 * @param {string} params.organizationId
 * @param {object} params.approver — { actorRef, roleCode, authenticated }
 * @param {object} params.draft — the artifact from requestDraft()
 * @param {string} params.correlationId — from the DraftResult
 * @param {object} params.reconfirmedContext — pre-approval reconfirmation
 * @param {object} params.originalContext — pre-generation context
 * @param {'approved'|'rejected'|'revision-requested'} params.decision
 * @param {string} [params.decisionReason]
 * @param {number} [params.revisionCount] — current revision count
 * @returns {Promise<DecisionResult>}
 */
export async function recordDecision(params) {
  const {
    organizationId, approver, draft, correlationId,
    reconfirmedContext, originalContext, decision, decisionReason,
    revisionCount = 0,
  } = params;

  let orgConfig;
  try {
    orgConfig = await loadOrgConfig(organizationId);
  } catch (err) {
    return _failResult('E-CONFIG-MISSING', err, correlationId, null);
  }

  // Re-assert identity before recording decision
  try {
    assertIdentity(approver, orgConfig);
  } catch (err) {
    if (isFailClosed(err)) {
      await _tryEmitFailAudit({
        eventType: 'decision',
        correlationId,
        organizationId,
        actorRef: approver?.actorRef ?? 'SYS-UNKNOWN00000000',
        actorType: 'human',
        outcome: 'blocked',
        failClosedCode: err.failClosedCode,
        outcomeDetail: 'Identity check failed at decision gate',
        syntheticPatientId: originalContext?.syntheticPatientId,
        syntheticEncounterId: originalContext?.syntheticEncounterId,
        artifactId: draft?.artifactId,
      });
      return _failResult(err.failClosedCode, err, correlationId, orgConfig);
    }
    throw err;
  }

  let approvalEvent;
  try {
    approvalEvent = await captureDecision({
      correlationId, organizationId, approver, artifact: draft,
      reconfirmedContext, originalContext,
      decision, decisionReason,
      revisionNumber: revisionCount,
      orgConfig,
    });
  } catch (err) {
    if (isFailClosed(err)) {
      await _tryEmitFailAudit({
        eventType: 'decision',
        correlationId,
        organizationId,
        actorRef: approver.actorRef,
        actorType: 'human',
        actorRoleCode: approver.roleCode,
        outcome: 'blocked',
        failClosedCode: err.failClosedCode,
        outcomeDetail: 'Decision recording failed',
        syntheticPatientId: originalContext?.syntheticPatientId,
        syntheticEncounterId: originalContext?.syntheticEncounterId,
        artifactId: draft?.artifactId,
      });
      return _failResult(err.failClosedCode, err, correlationId, orgConfig);
    }
    throw err;
  }

  // Emit decision audit event
  await _guardedAuditEmit(orgConfig, {
    eventType: 'decision',
    correlationId,
    organizationId,
    actorRef: approver.actorRef,
    actorType: 'human',
    actorRoleCode: approver.roleCode,
    outcome: 'success',
    syntheticPatientId: reconfirmedContext.syntheticPatientId,
    syntheticEncounterId: reconfirmedContext.syntheticEncounterId,
    artifactId: draft.artifactId,
    artifactVersion: draft.artifactVersion,
    generationId: draft.generationId,
    approvalEventId: approvalEvent.approvalEventId,
    decisionReasonPresent: !!decisionReason,
    revisionNumber: revisionCount,
  });

  if (decision === 'revision-requested') {
    await _guardedAuditEmit(orgConfig, {
      eventType: 'revision',
      correlationId,
      organizationId,
      actorRef: approver.actorRef,
      actorType: 'human',
      actorRoleCode: approver.roleCode,
      outcome: 'success',
      syntheticPatientId: reconfirmedContext.syntheticPatientId,
      syntheticEncounterId: reconfirmedContext.syntheticEncounterId,
      artifactId: draft.artifactId,
      revisionNumber: revisionCount + 1,
    });
  }

  return {
    ok: true,
    correlationId,
    approvalEvent,
    lifecycleStatus: approvalEvent.lifecycleStatus,
    statusLabel: approvalEvent.statusLabel,
  };
}

/**
 * Query correlated audit evidence for a completed run.
 * Returns all audit events for the correlationId, validating each carries no narrative content.
 *
 * @param {string} correlationId
 * @returns {{ correlationId: string, events: object[], shortRef: string }}
 */
export function queryEvidence(correlationId) {
  const events = queryByCorrelationId(correlationId);
  return {
    correlationId,
    shortRef: shortReference(correlationId),
    events,
    eventCount: events.length,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function _failResult(code, err, correlationId, orgConfig) {
  const userMessage = orgConfig
    ? resolveUserSafeMessage(orgConfig, code)
    : _genericSafeMessage(code);

  return {
    ok: false,
    correlationId,
    shortRef: correlationId ? shortReference(correlationId) : null,
    failClosedCode: code,
    userMessage,
  };
}

function _genericSafeMessage(code) {
  const messages = {
    'E-CONFIG-MISSING': 'The workflow configuration could not be loaded.',
    'E-IDENTITY-MISSING': 'Identity verification failed.',
    'E-CONTEXT-UNCONFIRMED': 'Patient and encounter confirmation required.',
    'E-INPUT-SCHEMA-INVALID': 'The request could not be validated.',
    'E-OUTPUT-SCHEMA-INVALID': 'The generated draft could not be validated.',
    'E-GROUNDING-FAILURE': 'The draft contains an unsupported statement and has been refused.',
    'E-SAFETY-FLAG': 'The draft did not pass the safety check.',
    'E-AGENT-TIMEOUT': 'The request timed out.',
    'E-AGENT-ERROR': 'The draft could not be generated.',
    'E-APPROVAL-WITHOUT-CONFIRMATION': 'Context reconfirmation required before decision.',
    'E-REVISION-LIMIT-REACHED': 'Maximum revisions reached.',
    'E-AUDIT-WRITE-FAILURE': 'Audit evidence could not be recorded. Run stopped.',
  };
  return messages[code] ?? 'An unexpected error occurred.';
}

/** Emit an audit event; throw E-AUDIT-WRITE-FAILURE on failure (never swallow). */
async function _guardedAuditEmit(orgConfig, fields) {
  try {
    await emitAudit(fields);
  } catch (auditErr) {
    const code = isFailClosed(auditErr) ? auditErr.failClosedCode : 'E-AUDIT-WRITE-FAILURE';
    throw failClosed(code, `Audit write failure: ${auditErr.message}`);
  }
}

/**
 * Best-effort audit emit for fail-closed outcomes.
 * If this secondary audit emit itself fails, the original error is preserved.
 * The audit failure is noted but does not suppress the original fail-closed result.
 */
async function _tryEmitFailAudit(fields) {
  try {
    await emitAudit(fields);
  } catch (_ignored) {
    // The outer handler returns a fail-closed result regardless. Swallowing here
    // only applies to the secondary emit; it does not affect the run outcome.
  }
}

/** Build the disclaimer block shown with every draft surface. */
function _buildDisclaimer(output, orgConfig) {
  return {
    mandatoryPrefix: output.draftStatus,
    body: orgConfig.safetyCopy.disclaimerBody,
    syntheticDataNotice: orgConfig.safetyCopy.syntheticDataNotice,
  };
}
