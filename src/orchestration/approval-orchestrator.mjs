/**
 * Approval orchestrator — captures and validates human decisions on generated drafts.
 *
 * REQ-APPR-001  REQ-APPR-002  REQ-APPR-003  REQ-WF-005  REQ-WF-006
 * ADR-20260812-007  ADR-20260812-009
 *
 * Owns:
 *   - Pre-approval context reconfirmation (assertPreApprovalConfirmed)
 *   - artifactSha256 binding
 *   - Decision reason requirement (reject / revision-requested)
 *   - Revision count enforcement (maxRevisions)
 *   - Approval event construction and schema validation
 *   - lifecycleStatus transition: DRAFT → APPROVED-SIMULATED | REJECTED | REVISION-REQUESTED
 *
 * The lifecycleStatus of an artifact moves only via a validated approval event.
 * No artifact transitions from DRAFT to any other state without an authenticated,
 * authorized human event carrying the artifact digest and a re-confirmed context.
 *
 * Note on phi-scan: The decisionReasonScanned flag is required on approval events
 * that carry a decisionReason. src/governance/phi-scan.mjs (WP-06, Morpheus) is
 * the single implementation and is called directly by _scanDecisionReason below,
 * so the marker cannot be set without the governance scan having run.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { failClosed } from './fail-closed.mjs';
import { scanText } from '../governance/phi-scan.mjs';
import { assertPreApprovalHandoff } from '../governance/assert-authorized-requester.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SCHEMA_DIR = join(REPO_ROOT, 'contracts', 'schemas');

let _approvalValidator = null;

async function getApprovalValidator() {
  if (_approvalValidator) return _approvalValidator;

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);

  const schemaFiles = [
    join(SCHEMA_DIR, 'common', 'definitions.schema.json'),
    join(SCHEMA_DIR, 'approval-event.schema.json'),
  ];
  for (const f of schemaFiles) {
    ajv.addSchema(JSON.parse(await readFile(f, 'utf8')));
  }

  _approvalValidator = ajv.getSchema(
    'https://contracts.second-shift-accelerator.example/v1/approval-event.schema.json'
  );
  return _approvalValidator;
}

/**
 * Canonical JSON serialization: object keys sorted at every depth, array order
 * preserved. Used so the same artifact always produces the same digest.
 */
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Compute the artifact digest over the canonical serialization.
 * Bound into the approval event so the decision cannot be replayed against different content.
 *
 * The digest covers every nested field (narrative text, source references, safety
 * status, provenance), so any change to presented content changes the digest. The
 * `artifactSha256` property itself is excluded, which makes the computation stable
 * whether it is run before or after the digest has been attached to the artifact.
 *
 * @param {object} artifact — agent output
 * @returns {string} lowercase hex SHA-256
 */
export function computeArtifactSha256(artifact) {
  const { artifactSha256: _excluded, ...content } = artifact ?? {};
  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex');
}

/**
 * Record a human decision on a generated draft.
 *
 * @param {object} params
 * @param {string} params.correlationId
 * @param {string} params.organizationId
 * @param {object} params.approver — { actorRef, roleCode, authenticated }
 * @param {object} params.artifact — agent output (for SHA-256 binding)
 * @param {object} params.reconfirmedContext — pre-approval reconfirmation
 * @param {string} params.reconfirmedByRef — human actor who performed the reconfirmation
 * @param {object} params.originalContext — pre-generation context (for match check)
 * @param {'approved'|'rejected'|'revision-requested'} params.decision
 * @param {string} [params.decisionReason] — required for rejected / revision-requested
 * @param {number} [params.revisionNumber] — current revision count (for limit check)
 * @param {object} params.orgConfig — organization configuration
 * @returns {Promise<object>} Validated approval event
 * @throws FailClosedError on any gate failure
 */
export async function recordDecision(params) {
  const {
    correlationId, organizationId, approver, artifact,
    reconfirmedContext, reconfirmedByRef, originalContext,
    decision, decisionReason, revisionNumber = 0,
    orgConfig,
  } = params;

  // Pre-approval context reconfirmation (REQ-APPR-003, REQ-SAFE-004)
  const handoff = assertPreApprovalHandoff({
    approver, reconfirmedContext, reconfirmedByRef, originalContext, orgConfig,
  });
  if (!handoff.ok) throw failClosed(handoff.failClosedCode, handoff.error);

  // Revision limit check (REQ-WF-006)
  if (decision === 'revision-requested') {
    const maxRevisions = orgConfig?.operations?.maxRevisions ?? 3;
    if (revisionNumber >= maxRevisions) {
      throw failClosed(
        'E-REVISION-LIMIT-REACHED',
        `operations.maxRevisions (${maxRevisions}) reached; revisionNumber=${revisionNumber}`
      );
    }
  }

  // Decision reason required for non-approval decisions
  if ((decision === 'rejected' || decision === 'revision-requested') &&
      (!decisionReason || !decisionReason.trim())) {
    throw failClosed(
      'E-APPROVAL-WITHOUT-CONFIRMATION',
      `decisionReason is required for decision="${decision}"`
    );
  }

  // Scan decision reason with the governance PHI/PII scanner (src/governance/phi-scan.mjs).
  // decisionReasonScanned is set only after that scan has run and passed.
  let decisionReasonScanned;
  if (decisionReason) {
    _scanDecisionReason(decisionReason);
    decisionReasonScanned = true;
  }

  const artifactSha256 = computeArtifactSha256(artifact);
  const approvalEventId = `APR-${randomBytes(9).toString('hex').toUpperCase().slice(0, 16)}`;
  const recordedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const lifecycleStatus = LIFECYCLE_FOR[decision];
  const statusLabel = STATUS_LABEL_FOR[decision];

  const event = {
    contractVersion: orgConfig.operations.outputContractVersion,
    approvalEventId,
    correlationId,
    recordedAt,
    organizationId,
    decision,
    approver,
    artifact: {
      artifactId: artifact.artifactId,
      artifactVersion: artifact.artifactVersion,
      artifactSha256,
      generationId: artifact.generationId,
      agentInstructionVersion: artifact.provenance.agentInstructionVersion,
    },
    reconfirmedContext,
    revisionNumber,
    lifecycleStatus,
    statusLabel,
  };

  if (decisionReason) {
    event.decisionReason = decisionReason;
    event.decisionReasonScanned = decisionReasonScanned;
  }

  // Validate the event against the approval-event contract
  const validate = await getApprovalValidator();
  const valid = validate(event);
  if (!valid) {
    const paths = (validate.errors ?? []).map(e => e.instancePath || e.schemaPath).join('; ');
    throw failClosed('E-INPUT-SCHEMA-INVALID', `Approval event schema validation failed: ${paths}`);
  }

  return event;
}

const LIFECYCLE_FOR = {
  'approved': 'APPROVED-SIMULATED',
  'rejected': 'REJECTED',
  'revision-requested': 'REVISION-REQUESTED',
};

const STATUS_LABEL_FOR = {
  'approved': 'APPROVED — SIMULATED FINALIZATION ONLY',
  'rejected': 'REJECTED — NOT FOR USE',
  'revision-requested': 'REVISION REQUESTED — DRAFT WITHDRAWN',
};

/**
 * Structural checks plus the governance PHI/PII scan for decision reason text.
 * src/governance/phi-scan.mjs is the single implementation behind
 * decisionReasonScanned; a finding refuses the decision rather than redacting it.
 */
function _scanDecisionReason(reason) {
  if (typeof reason !== 'string') {
    throw failClosed('E-INPUT-SCHEMA-INVALID', 'decisionReason must be a string');
  }
  if (reason.length > 512) {
    throw failClosed('E-INPUT-SCHEMA-INVALID', 'decisionReason exceeds 512 characters');
  }
  if (reason.includes('\0')) {
    throw failClosed('E-INPUT-SCHEMA-INVALID', 'decisionReason contains a null byte');
  }

  const scan = scanText(reason);
  if (!scan.passed) {
    throw failClosed(
      'E-SAFETY-FLAG',
      `decisionReason failed the PHI scan: ${scan.findings.map(f => f.ruleId).join(', ')}`
    );
  }
}
