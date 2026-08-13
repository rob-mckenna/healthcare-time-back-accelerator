/**
 * Foundry adapter — simulation boundary.
 *
 * REQ-SCOPE-002  REQ-AGT-001  REQ-AGT-005
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SIMULATION BOUNDARY — NOT AN OPERATIONAL INTEGRATION
 *
 * This adapter returns a pre-validated example output derived from
 * contracts/examples/shift-closeout-agent-output.example.json, with
 * run-specific identifiers (correlationId, context, artifactId, generationId,
 * timestamps) updated to match the current request.
 *
 * The target invocation path is selected by ADR-20260813-011. Issue #6
 * separately verified the deployed Foundry agent and its live behavior.
 * Direct Copilot Studio connected-agent validation remains NOT RUN under
 * RISK-020, so this local journey continues to use the simulation boundary.
 *
 * After the direct connection and request/response adaptation are verified,
 * the body of invoke() below can be replaced without changing the surrounding
 * validation, approval, or audit controls.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ADR-20260812-010: A deferred capability may not appear as a stub, a mock
 * endpoint, or a placeholder that implies a working integration. This file is
 * a documented simulation boundary, not a hidden stub.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { failClosed } from './fail-closed.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const EXAMPLE_OUTPUT_PATH = join(
  REPO_ROOT, 'contracts', 'examples', 'shift-closeout-agent-output.example.json'
);

/**
 * Invoke the Shift Closeout Agent.
 *
 * In the prototype this returns the example output with run-specific identifiers
 * applied. See the simulation boundary notice above.
 *
 * @param {object} input — validated agent input (shift-closeout-agent-input contract)
 * @param {object} orgConfig — organization configuration (for timeout)
 * @param {object} [_testOptions] — test-only overrides; not for production use
 * @param {number} [_testOptions.timeoutMs] — override timeout for testing E-AGENT-TIMEOUT
 * @returns {Promise<object>} Agent output payload (to be validated before use)
 * @throws FailClosedError E-AGENT-TIMEOUT | E-AGENT-ERROR
 */
export async function invoke(input, orgConfig, _testOptions) {
  const timeoutMs = _testOptions?.timeoutMs ?? orgConfig?.operations?.agentTimeoutMs ?? 60000;

  // Wrap in a timeout so the runner enforces E-AGENT-TIMEOUT even in simulation.
  return Promise.race([
    _simulatedInvocation(input),
    _timeout(timeoutMs),
  ]);
}

async function _simulatedInvocation(input) {
  let example;
  try {
    example = JSON.parse(await readFile(EXAMPLE_OUTPUT_PATH, 'utf8'));
  } catch (err) {
    throw failClosed('E-AGENT-ERROR', `Simulation boundary: cannot load example output — ${err.message}`);
  }

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const newGenerationId = `GEN-${randomBytes(9).toString('hex').toUpperCase().slice(0, 16)}`;
  const newArtifactId = `ART-${randomBytes(9).toString('hex').toUpperCase().slice(0, 16)}`;
  const idk = input.idempotencyKey;

  // Apply run-specific identifiers to the example output.
  const output = {
    ...example,
    correlationId: input.correlationId,
    generationId: newGenerationId,
    idempotencyKey: idk,
    generatedAt: now,
    organizationId: input.organizationId,
    artifactId: newArtifactId,
    context: {
      ...example.context,
      syntheticPatientId: input.context.syntheticPatientId,
      syntheticEncounterId: input.context.syntheticEncounterId,
      shiftPeriodLabel: input.shiftPeriod?.label ?? example.context.shiftPeriodLabel,
    },
    requestedScope: input.requestedScope,
    provenance: {
      ...example.provenance,
      sourceBundleId: input.sourceBundle.bundleId,
      sourceBundleSha256: input.sourceBundle.bundleSha256,
    },
  };

  // Propagate revision metadata if this is a revision request.
  if (input.revision) {
    output.revision = {
      priorGenerationId: input.revision.priorGenerationId,
      revisionNumber: input.revision.revisionNumber,
    };
  } else {
    delete output.revision;
  }

  return output;
}

function _timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(failClosed('E-AGENT-TIMEOUT', `Agent did not respond within ${ms}ms`));
    }, ms);
  });
}

/** Symbolic export used by the runner to detect the simulation boundary at run-time. */
export const IS_SIMULATION_BOUNDARY = true;

/** Human-readable label shown in audit evidence when this boundary is active. */
export const SIMULATION_BOUNDARY_LABEL =
  'SIMULATION BOUNDARY — direct Copilot Studio connected-agent validation NOT RUN (RISK-020)';
