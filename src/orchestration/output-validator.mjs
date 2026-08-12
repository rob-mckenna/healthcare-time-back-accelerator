/**
 * Output validator — deterministic post-generation validation.
 *
 * REQ-SAFE-005  REQ-AGT-004  REQ-VAL-001  ADR-20260812-008
 *
 * Runs the four validation steps in fixed order after the agent returns and
 * before anything is presented to a user. Each step fails closed.
 *
 * Order (from ADR-20260812-008):
 *   1. Output schema validation           → E-OUTPUT-SCHEMA-INVALID
 *   2. Safety assertion check (9 fields)  → E-SAFETY-FLAG
 *   3. Grounding resolution               → E-GROUNDING-FAILURE
 *   4. Correlation echo check             → E-OUTPUT-SCHEMA-INVALID
 *
 * The four steps are implemented once, in src/governance/validate-payload.mjs
 * (WP-06, Morpheus), so the generation path and the approval path cannot
 * diverge. This module adapts the orchestration call shape to that utility and
 * converts its structured result into the fail-closed error the runner expects.
 */

import { validatePayload } from '../governance/validate-payload.mjs';
import { failClosed } from './fail-closed.mjs';

const REQUIRED_SAFETY_FLAGS = [
  'noDiagnosis',
  'noTreatmentOrMedicationRecommendation',
  'noTriage',
  'noClinicalRecommendation',
  'noPatientOrFamilyCommunication',
  'syntheticSourceOnly',
  'groundingComplete',
];

/**
 * Normalise the approved-bundle argument into the shape validatePayload expects.
 * Accepts a Set of resourceIds, a map of resourceId → resource, or a full bundle.
 */
function toApprovedBundle(bundleResources) {
  if (bundleResources && Array.isArray(bundleResources.entries)) {
    return bundleResources;
  }
  const ids = bundleResources instanceof Set
    ? [...bundleResources]
    : Object.keys(bundleResources ?? {});
  return { entries: ids.map((resourceId) => ({ resourceId })) };
}

/**
 * Run all four validation steps on the agent output.
 *
 * @param {object} output — agent output payload
 * @param {string} inputCorrelationId — the correlationId from the request (for echo check)
 * @param {Set<string>|object} bundleResources — approved resourceIds, resource map, or bundle
 * @returns {Promise<{ schemaValidationPassed: boolean, groundingVerified: boolean }>}
 * @throws FailClosedError on any step failure
 */
export async function validateOutput(output, inputCorrelationId, bundleResources) {
  const approvedBundle = toApprovedBundle(bundleResources);

  if (approvedBundle.entries.length === 0) {
    // No approved bundle means nothing can be resolved, so nothing may be shown.
    throw failClosed(
      'E-GROUNDING-FAILURE',
      'Approved source bundle is not available for grounding resolution'
    );
  }

  const result = validatePayload(output, inputCorrelationId, approvedBundle);
  if (!result.valid) {
    throw failClosed(result.failClosedCode, `${result.step}: ${result.detail}`);
  }

  return { schemaValidationPassed: true, groundingVerified: true };
}

/**
 * Step 2 — safety assertion check (exported for direct testing and defense-in-depth use).
 * The schema is the first defense (const: true on each flag) and
 * src/governance/validate-payload.mjs re-checks the same fields in the fixed
 * order; this export lets a caller assert the flags on their own.
 *
 * @param {object} safetyStatus — output.safetyStatus
 * @throws FailClosedError E-SAFETY-FLAG
 */
export function assertSafetyFlags(safetyStatus) {
  if (!safetyStatus) {
    throw failClosed('E-SAFETY-FLAG', 'safetyStatus is absent');
  }
  for (const field of REQUIRED_SAFETY_FLAGS) {
    if (safetyStatus[field] !== true) {
      throw failClosed('E-SAFETY-FLAG', `safetyStatus.${field} is not true`);
    }
  }
  if (typeof safetyStatus.groundingCoverageRatio !== 'number' || safetyStatus.groundingCoverageRatio !== 1) {
    throw failClosed('E-SAFETY-FLAG', `safetyStatus.groundingCoverageRatio is not 1`);
  }
}
