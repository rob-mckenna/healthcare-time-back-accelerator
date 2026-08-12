/**
 * Draft, source-reference, and evidence presentation surfaces.
 *
 * REQ-WF-003  REQ-WF-004  REQ-AUD-004  REQ-SAFE-001  ADR-20260812-004
 *
 * Every surface that renders the artifact carries `draftStatus` first, then the
 * configured disclaimer and synthetic-data notice. The label is taken from the
 * artifact itself, never re-typed, and rendering is refused if it is absent or
 * altered. The evidence surface prints only the fields the audit contract allows,
 * so no narrative or synthetic payload value can reach it.
 */

const REQUIRED_DRAFT_STATUS = 'DRAFT — HUMAN REVIEW REQUIRED';

function refuse(detail) {
  const err = new Error(detail);
  err.failClosedCode = 'E-SAFETY-FLAG';
  err.isFailClosed = true;
  return err;
}

/**
 * Assert the artifact carries the immutable draft label before anything is shown.
 *
 * @param {object} draft
 * @throws {Error} E-SAFETY-FLAG
 */
export function assertDraftLabel(draft) {
  if (draft?.draftStatus !== REQUIRED_DRAFT_STATUS) {
    throw refuse(`artifact does not carry "${REQUIRED_DRAFT_STATUS}"`);
  }
  if (draft.lifecycleStatus !== 'DRAFT') {
    throw refuse(`agent output lifecycleStatus must be DRAFT, found "${draft.lifecycleStatus}"`);
  }
}

/**
 * Render the draft for the care-team surface.
 *
 * @param {object} draft — validated agent output
 * @param {object} disclaimer — { mandatoryPrefix, body, syntheticDataNotice }
 * @param {object} orgConfig
 * @param {string} shortRef
 * @returns {string}
 */
export function renderDraft(draft, disclaimer, orgConfig, shortRef) {
  assertDraftLabel(draft);

  const t = orgConfig.terminology ?? {};
  const lines = [];

  lines.push(`*** ${draft.draftStatus} ***`);
  lines.push(disclaimer.body);
  lines.push(disclaimer.syntheticDataNotice);
  lines.push(`Ref ${shortRef}   Artifact ${draft.artifactId} v${draft.artifactVersion}`);
  lines.push(`Patient ${draft.context.syntheticPatientId}   Encounter ${draft.context.syntheticEncounterId}`);
  lines.push('');

  lines.push(`${t.shiftLabel ?? 'Shift closeout'} summary (${draft.shiftSummary.structureLabel ?? 'structured'})`);
  lines.push(`  ${draft.shiftSummary.narrative}`);
  lines.push(`  ${t.sourceReferenceLabel ?? 'Source references'}: ${draft.shiftSummary.sourceReferences.length}`);
  lines.push('');

  lines.push(`Handoff summary → ${draft.handoffSummary.receivingRoleLabel}`);
  lines.push(`  ${draft.handoffSummary.narrative}`);
  lines.push(`  ${draft.handoffSummary.pendingHumanDecisionNotice}`);
  lines.push(`  ${t.sourceReferenceLabel ?? 'Source references'}: ${draft.handoffSummary.sourceReferences.length}`);
  lines.push('');

  lines.push(`Open items (${draft.openItems.length})`);
  for (const item of draft.openItems) {
    lines.push(`  [${item.itemId}] ${item.description}`);
  }
  lines.push('');

  lines.push(`Follow-up items (${draft.followUpItems.length})`);
  for (const item of draft.followUpItems) {
    lines.push(`  [${item.itemId}] ${item.description}`);
  }
  lines.push('');
  lines.push(`*** ${draft.draftStatus} ***`);

  return lines.join('\n');
}

/**
 * The master source-reference list the nurse can open.
 *
 * @param {object} draft
 * @returns {Array<object>}
 */
export function listSourceReferences(draft) {
  assertDraftLabel(draft);
  return draft.sourceReferences ?? [];
}

/**
 * Open one source reference against the approved synthetic bundle.
 * A reference that does not resolve is refused, never rendered as unsupported text.
 *
 * @param {object} bundle — approved synthetic source bundle
 * @param {object} ref — a sourceReference
 * @returns {{ reference: object, resourceType: string, content: object }}
 * @throws {Error} E-GROUNDING-FAILURE
 */
export function openSourceReference(bundle, ref) {
  const entry = (bundle.entries ?? []).find((e) => e.resourceId === ref.resourceId);
  if (!entry) {
    const err = new Error(`source reference ${ref.resourceId} does not resolve in ${bundle.bundleId}`);
    err.failClosedCode = 'E-GROUNDING-FAILURE';
    err.isFailClosed = true;
    throw err;
  }
  return { reference: ref, resourceType: entry.resourceType, content: entry.content };
}

/**
 * Render the correlated evidence view. Only audit-contract fields are printed.
 *
 * @param {{ correlationId: string, shortRef: string, events: object[] }} evidence
 * @returns {string}
 */
export function renderEvidence(evidence) {
  const lines = [];
  lines.push(`Correlated evidence for ${evidence.correlationId} (Ref ${evidence.shortRef})`);
  lines.push(`  ${evidence.events.length} event(s)`);
  for (const e of evidence.events) {
    const parts = [
      e.occurredAt,
      e.eventType.padEnd(20),
      e.outcome.padEnd(8),
      `actor=${e.actorRef}`,
      `type=${e.actorType}`,
    ];
    if (e.actorRoleCode) parts.push(`role=${e.actorRoleCode}`);
    if (e.failClosedCode) parts.push(`code=${e.failClosedCode}`);
    if (e.artifactId) parts.push(`artifact=${e.artifactId}`);
    if (e.approvalEventId) parts.push(`approval=${e.approvalEventId}`);
    lines.push(`  ${parts.join('  ')}`);
  }
  return lines.join('\n');
}

/**
 * Assert that no audit event carries narrative, generated text, or a payload value.
 * The contract sets additionalProperties: false; this is the render-time backstop.
 *
 * @param {object[]} events
 * @throws {Error} E-SAFETY-FLAG
 */
export function assertNoSensitivePayload(events) {
  const forbidden = [
    'narrative', 'content', 'draft', 'summary', 'shiftSummary', 'handoffSummary',
    'decisionReason', 'revisionInstructions', 'displayName', 'email', 'name',
  ];
  for (const event of events) {
    for (const key of forbidden) {
      if (key in event) {
        throw refuse(`audit event ${event.auditEventId} carries a forbidden field "${key}"`);
      }
    }
  }
}
