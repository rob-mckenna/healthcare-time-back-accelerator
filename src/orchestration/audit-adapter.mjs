/**
 * Audit adapter — emit minimal, correlated audit events.
 *
 * REQ-AUD-001  REQ-AUD-002  REQ-AUD-003  REQ-AUD-004
 * ADR-20260812-008
 *
 * One minimal audit event per journey step. The contract provides nowhere to
 * put generated narrative, synthetic resource payloads, or resolved identity.
 * See contracts/schemas/audit-event.schema.json.
 *
 * Sink: in-process event log for the prototype. When environmentBindings.auditEventSink
 * resolves to a value, that variable name is recorded but the actual write target is
 * out-of-scope for P0 (deferred enterprise service).
 *
 * Event construction and emission use src/governance/audit.mjs (WP-06, Morpheus)
 * so the audit shape and the write-failure contract have one implementation.
 *
 * Rule: An audit write failure emits E-AUDIT-WRITE-FAILURE and stops the run.
 * It is never logged and swallowed (REQ-AUD-003).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { failClosed } from './fail-closed.mjs';
import { buildAuditEvent, emitAuditEvent } from '../governance/audit.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SCHEMA_DIR = join(REPO_ROOT, 'contracts', 'schemas');

/** In-process event log. Tests and the runner read this after the run. */
export const auditLog = [];

/** Reset the in-process log (for test isolation). */
export function resetAuditLog() {
  auditLog.splice(0, auditLog.length);
}

let _auditValidator = null;

async function getAuditValidator() {
  if (_auditValidator) return _auditValidator;

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);

  const schemaFiles = [
    join(SCHEMA_DIR, 'common', 'definitions.schema.json'),
    join(SCHEMA_DIR, 'audit-event.schema.json'),
  ];
  for (const f of schemaFiles) {
    ajv.addSchema(JSON.parse(await readFile(f, 'utf8')));
  }

  _auditValidator = ajv.getSchema(
    'https://contracts.second-shift-accelerator.example/v1/audit-event.schema.json'
  );
  return _auditValidator;
}

/**
 * Emit one audit event.
 *
 * @param {object} fields — event fields (partial; required fields are validated)
 * @throws FailClosedError E-AUDIT-WRITE-FAILURE on any failure
 */
export async function emit(fields) {
  const auditEventId = `AUD-${randomBytes(9).toString('hex').toUpperCase().slice(0, 16)}`;
  const occurredAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Built by the governance audit module, which allows only the minimal
  // contract fields — there is nowhere to attach narrative or payload content.
  const event = buildAuditEvent({ ...fields, auditEventId, occurredAt });

  // Validate against the audit-event contract
  let validate;
  try {
    validate = await getAuditValidator();
  } catch (schemaErr) {
    throw failClosed('E-AUDIT-WRITE-FAILURE', `Audit schema could not be loaded: ${schemaErr.message}`);
  }

  const valid = validate(event);
  if (!valid) {
    const paths = (validate.errors ?? []).map(e => e.instancePath || e.schemaPath).join('; ');
    throw failClosed('E-AUDIT-WRITE-FAILURE', `Audit event schema validation failed: ${paths}`);
  }

  // Write through the governance emitter, which converts any sink failure into
  // E-AUDIT-WRITE-FAILURE rather than logging and continuing.
  const result = await emitAuditEvent(event, (e) => { auditLog.push(e); });
  if (!result.success) {
    throw failClosed(result.failClosedCode ?? 'E-AUDIT-WRITE-FAILURE', `Audit log write failed: ${result.detail}`);
  }

  return event;
}

/**
 * Retrieve all audit events for a given correlationId.
 * Used by the correlated evidence view (M6).
 *
 * @param {string} correlationId
 * @returns {object[]}
 */
export function queryByCorrelationId(correlationId) {
  return auditLog.filter(e => e.correlationId === correlationId);
}
