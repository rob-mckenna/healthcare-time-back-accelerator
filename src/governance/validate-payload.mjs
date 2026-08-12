/**
 * Deterministic validation layer for Shift Closeout Agent output.
 *
 * Runs in fixed order per ADR-20260812-008. Each step fails closed.
 *
 *   1. Output schema validation       → E-OUTPUT-SCHEMA-INVALID
 *   2. Safety assertion check          → E-SAFETY-FLAG
 *   3. Grounding resolution            → E-GROUNDING-FAILURE
 *   4. Correlation echo check          → E-OUTPUT-SCHEMA-INVALID (mismatch)
 *
 * Consumed by both the generation path and the approval path so the two
 * cannot diverge, per ADR-20260812-008.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA_DIR = join(ROOT, 'contracts', 'schemas');

const SCHEMA_NAMES = [
  'common/definitions.schema.json',
  'source-reference.schema.json',
  'synthetic-context.schema.json',
  'synthetic-source-bundle.schema.json',
  'shift-closeout-agent-input.schema.json',
  'shift-closeout-agent-output.schema.json',
  'approval-event.schema.json',
  'audit-event.schema.json',
  'illustrative-metric.schema.json',
];

const OUTPUT_SCHEMA_ID =
  'https://contracts.second-shift-accelerator.example/v1/shift-closeout-agent-output.schema.json';

const SAFETY_BOOLEAN_FIELDS = [
  'noDiagnosis',
  'noTreatmentOrMedicationRecommendation',
  'noTriage',
  'noClinicalRecommendation',
  'noPatientOrFamilyCommunication',
  'syntheticSourceOnly',
  'groundingComplete',
];

let _ajv = null;

function getAjv() {
  if (_ajv) return _ajv;
  _ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: false });
  addFormats(_ajv);
  for (const name of SCHEMA_NAMES) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8'));
    _ajv.addSchema(schema);
  }
  return _ajv;
}

function collectSourceReferences(node, refs = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectSourceReferences(item, refs);
  } else if (node && typeof node === 'object') {
    if (Array.isArray(node.sourceReferences)) {
      refs.push(...node.sourceReferences);
    }
    for (const val of Object.values(node)) {
      collectSourceReferences(val, refs);
    }
  }
  return refs;
}

/**
 * Validate Shift Closeout Agent output in fixed order.
 *
 * @param {object} output - Parsed agent output object
 * @param {string} expectedCorrelationId - Correlation ID from the request
 * @param {object} approvedBundle - Approved synthetic source bundle
 * @returns {{
 *   valid: boolean,
 *   failClosedCode: string | null,
 *   step: string | null,
 *   detail: string | null
 * }}
 */
export function validatePayload(output, expectedCorrelationId, approvedBundle) {
  const ajv = getAjv();
  const validate = ajv.getSchema(OUTPUT_SCHEMA_ID);

  // Step 1 — output schema
  const schemaValid = validate(output);
  if (!schemaValid) {
    const detail = (validate.errors ?? [])
      .map(e => `${e.instancePath || '(root)'} ${e.message}`)
      .join('; ');
    return { valid: false, failClosedCode: 'E-OUTPUT-SCHEMA-INVALID', step: 'schema', detail };
  }

  // Step 2 — safety assertions
  const safety = output.safetyStatus ?? {};
  for (const field of SAFETY_BOOLEAN_FIELDS) {
    if (safety[field] !== true) {
      return {
        valid: false,
        failClosedCode: 'E-SAFETY-FLAG',
        step: 'safety',
        detail: `safetyStatus.${field} is not true`,
      };
    }
  }
  if (safety.groundingCoverageRatio !== 1) {
    return {
      valid: false,
      failClosedCode: 'E-SAFETY-FLAG',
      step: 'safety',
      detail: 'safetyStatus.groundingCoverageRatio must be exactly 1',
    };
  }

  // Step 3 — grounding resolution
  const bundleIds = new Set((approvedBundle.entries ?? []).map(e => e.resourceId));
  const allRefs = collectSourceReferences(output);
  const unresolved = allRefs.filter(r => !bundleIds.has(r.resourceId));
  if (unresolved.length > 0) {
    return {
      valid: false,
      failClosedCode: 'E-GROUNDING-FAILURE',
      step: 'grounding',
      detail: `unresolved resource references: ${unresolved.map(r => r.resourceId).join(', ')}`,
    };
  }

  // Step 4 — correlation echo
  if (output.correlationId !== expectedCorrelationId) {
    return {
      valid: false,
      failClosedCode: 'E-OUTPUT-SCHEMA-INVALID',
      step: 'correlation',
      detail: `correlation mismatch — output has ${output.correlationId}, expected ${expectedCorrelationId}`,
    };
  }

  return { valid: true, failClosedCode: null, step: null, detail: null };
}

/**
 * Validate any contract document against its registered schema by $id.
 *
 * @param {object} doc - Document to validate
 * @param {string} schemaId - Full $id of the JSON Schema
 * @returns {{ valid: boolean, errors: object[] | null }}
 */
export function validateAgainstSchema(doc, schemaId) {
  const ajv = getAjv();
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    return { valid: false, errors: [{ message: `schema not registered: ${schemaId}` }] };
  }
  const ok = validate(doc);
  return { valid: ok, errors: ok ? null : (validate.errors ?? []) };
}
