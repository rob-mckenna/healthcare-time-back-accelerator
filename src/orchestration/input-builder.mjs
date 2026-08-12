/**
 * Agent input builder — constructs and schema-validates the Shift Closeout Agent input.
 *
 * REQ-WF-001  REQ-WF-002  REQ-AGT-001  REQ-VAL-001  ADR-20260812-008
 *
 * Assembles the complete input object from the validated run context, then validates
 * it against contracts/schemas/shift-closeout-agent-input.schema.json before the
 * agent is invoked. A request that fails schema validation is refused with
 * E-INPUT-SCHEMA-INVALID and never reaches the agent.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { failClosed } from './fail-closed.mjs';
import { scanRevision } from '../governance/phi-scan.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SCHEMA_DIR = join(REPO_ROOT, 'contracts', 'schemas');

let _validator = null;

async function getValidator() {
  if (_validator) return _validator;

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);

  const schemaFiles = [
    join(SCHEMA_DIR, 'common', 'definitions.schema.json'),
    join(SCHEMA_DIR, 'source-reference.schema.json'),
    join(SCHEMA_DIR, 'shift-closeout-agent-input.schema.json'),
  ];
  for (const f of schemaFiles) {
    ajv.addSchema(JSON.parse(await readFile(f, 'utf8')));
  }

  _validator = ajv.getSchema(
    'https://contracts.second-shift-accelerator.example/v1/shift-closeout-agent-input.schema.json'
  );
  return _validator;
}

/**
 * Build the agent input payload.
 *
 * @param {object} params
 * @param {string} params.correlationId
 * @param {object} params.requester — { actorRef, roleCode, authenticated }
 * @param {object} params.context — { syntheticPatientId, syntheticEncounterId, preGenerationConfirmedAt, confirmedByRef }
 * @param {object} params.sourceBundle — { bundleId, bundleVersion, bundleSha256, approvedForGeneration }
 * @param {object} params.shiftPeriod — { start, end, label? }
 * @param {object} params.orgConfig — loaded organization configuration
 * @param {string[]} [params.requestedScope] — defaults to all four sections
 * @param {object} [params.revision] — { priorGenerationId, revisionNumber, revisionInstructions?, revisionInstructionsSanitized }
 * @returns {Promise<object>} Validated input payload
 * @throws FailClosedError E-INPUT-SCHEMA-INVALID
 */
export async function buildInput(params) {
  const {
    correlationId,
    requester,
    context,
    sourceBundle,
    shiftPeriod,
    orgConfig,
    requestedScope = ['shiftSummary', 'handoffSummary', 'openItems', 'followUpItems'],
    revision,
  } = params;

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const requestId = `GEN-${randomBytes(9).toString('hex').toUpperCase().slice(0, 16)}`;
  // Generated per request from a CSPRNG. Not a credential and never persisted.
  const idempotencyKey = `IDK-${randomBytes(16).toString('hex')}`;

  const input = {
    contractVersion: orgConfig.operations.inputContractVersion,
    requestId,
    correlationId,
    idempotencyKey,
    requestedAt: now,
    organizationId: orgConfig.organizationId,
    terminologyPack: orgConfig.terminology?.terminologyPack ?? orgConfig.organizationId,
    locale: orgConfig.terminology?.locale ?? 'en-US',
    requester,
    context,
    sourceBundle,
    shiftPeriod,
    requestedScope,
    expectedOutputContractVersion: orgConfig.operations.outputContractVersion,
    agentInstructionVersion: '1.0.0',
    groundingThreshold: orgConfig.operations.groundingThreshold ?? 1,
  };

  if (revision) {
    input.revision = _sanitizeRevision(revision);
  }

  const validate = await getValidator();
  const valid = validate(input);
  if (!valid) {
    const paths = (validate.errors ?? []).map(e => e.instancePath || e.schemaPath).join('; ');
    throw failClosed('E-INPUT-SCHEMA-INVALID', `Input schema validation failed: ${paths}`);
  }

  return input;
}

/**
 * Apply the governance PHI/PII and prompt-injection scan to human revision text.
 *
 * `revisionInstructionsSanitized` is a fail-closed marker in the input contract,
 * so it may only be set here, after src/governance/phi-scan.mjs has run and
 * passed. Untrusted revision text that carries an identifier or an instruction
 * override refuses the request; it is never forwarded to the agent.
 *
 * @param {object} revision
 * @returns {object} revision block with the sanitisation marker set
 * @throws FailClosedError E-INPUT-SCHEMA-INVALID | E-SAFETY-FLAG
 */
function _sanitizeRevision(revision) {
  const instructions = revision.revisionInstructions;
  if (instructions === undefined || instructions === null) {
    return { ...revision, revisionInstructionsSanitized: true };
  }

  const scan = scanRevision(instructions);
  if (!scan.passed) {
    throw failClosed(
      'E-SAFETY-FLAG',
      `revisionInstructions failed the governance scan: ${scan.findings.map(f => f.ruleId).join(', ')}`
    );
  }

  return { ...revision, revisionInstructionsSanitized: true };
}
