/**
 * Organization configuration loader.
 *
 * REQ-CFG-001  REQ-CFG-002  REQ-CFG-003  REQ-CFG-004
 * ADR-20260812-001  ADR-20260812-006
 *
 * Loads the organization pack from config/organizations/{orgId}/organization.json.
 * Validates required top-level keys.
 * Resolves the user-safe error message for a given fail-closed code.
 * Reads environment variable names from environmentBindings — never the values.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { failClosed } from './fail-closed.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const REQUIRED_TOP_KEYS = [
  'contractVersion', 'organizationId', 'personas', 'operations', 'safetyCopy', 'environmentBindings'
];
const REQUIRED_PERSONAS_KEYS = ['authorizedRoleCodes'];
const REQUIRED_OPERATIONS_KEYS = ['maxRevisions', 'agentTimeoutMs', 'inputContractVersion', 'outputContractVersion'];
const REQUIRED_SAFETY_COPY_KEYS = ['mandatoryDraftPrefix', 'disclaimerBody', 'errorMessageOverrides'];

/**
 * Load and validate the organization configuration pack.
 *
 * @param {string} organizationId — e.g. "harborlight"
 * @returns {Promise<object>} Parsed configuration object.
 * @throws FailClosedError with code E-CONFIG-MISSING when required config is absent.
 */
export async function loadOrgConfig(organizationId) {
  const configPath = join(REPO_ROOT, 'config', 'organizations', organizationId, 'organization.json');
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (err) {
    throw failClosed('E-CONFIG-MISSING', `Organization config not found for "${organizationId}": ${configPath}`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    throw failClosed('E-CONFIG-MISSING', `Organization config is invalid JSON for "${organizationId}"`);
  }

  for (const key of REQUIRED_TOP_KEYS) {
    if (config[key] === undefined) {
      throw failClosed('E-CONFIG-MISSING', `Organization config missing required key "${key}" for "${organizationId}"`);
    }
  }
  for (const key of REQUIRED_PERSONAS_KEYS) {
    if (config.personas[key] === undefined) {
      throw failClosed('E-CONFIG-MISSING', `Organization config missing personas.${key}`);
    }
  }
  for (const key of REQUIRED_OPERATIONS_KEYS) {
    if (config.operations[key] === undefined) {
      throw failClosed('E-CONFIG-MISSING', `Organization config missing operations.${key}`);
    }
  }
  for (const key of REQUIRED_SAFETY_COPY_KEYS) {
    if (config.safetyCopy[key] === undefined) {
      throw failClosed('E-CONFIG-MISSING', `Organization config missing safetyCopy.${key}`);
    }
  }

  if (!Array.isArray(config.personas.authorizedRoleCodes) || config.personas.authorizedRoleCodes.length === 0) {
    throw failClosed('E-CONFIG-MISSING', 'Organization config personas.authorizedRoleCodes must be a non-empty array');
  }

  return config;
}

/**
 * Resolve the user-safe message for a fail-closed code.
 * Returns the configured override if present; falls back to the generic safe message.
 * Never returns a raw exception, stack trace, or internal detail.
 *
 * @param {object} config — loaded organization config
 * @param {string} code — failClosedCode
 * @returns {string}
 */
export function resolveUserSafeMessage(config, code) {
  const overrides = config?.safetyCopy?.errorMessageOverrides ?? {};
  if (overrides[code]) return overrides[code];
  return GENERIC_SAFE_MESSAGES[code] ?? GENERIC_SAFE_MESSAGES._default;
}

/** Generic safe messages for codes without organization-specific overrides. */
const GENERIC_SAFE_MESSAGES = {
  'E-IDENTITY-MISSING': 'We could not verify your identity for this workflow. Please sign out, sign back in, and try again.',
  'E-CONFIG-MISSING': 'The workflow configuration could not be loaded. Please contact your administrator.',
  'E-CONTEXT-UNCONFIRMED': 'Patient and encounter confirmation is required before a draft can be requested.',
  'E-INPUT-SCHEMA-INVALID': 'The request could not be validated. Please try again.',
  'E-OUTPUT-SCHEMA-INVALID': 'The generated draft could not be validated and will not be shown.',
  'E-GROUNDING-FAILURE': 'The draft contains a statement that could not be traced to an approved source. The draft has been refused.',
  'E-SAFETY-FLAG': 'The draft did not pass the required safety check and will not be shown.',
  'E-AGENT-TIMEOUT': 'The draft request took too long to complete. Please try again.',
  'E-AGENT-ERROR': 'The draft could not be generated. Please try again.',
  'E-APPROVAL-WITHOUT-CONFIRMATION': 'Patient and encounter confirmation is required before a decision can be recorded.',
  'E-REVISION-LIMIT-REACHED': 'The maximum number of revision requests has been reached. Please reject the draft and start a new request.',
  'E-AUDIT-WRITE-FAILURE': 'The workflow evidence record could not be written. The run has stopped.',
  _default: 'An unexpected error occurred. Please contact your administrator.',
};
