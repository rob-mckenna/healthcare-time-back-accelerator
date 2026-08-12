/**
 * Correlation identifier — mint and inspect.
 *
 * REQ-AUD-001  ADR-20260812-002
 * See docs/conventions/correlation-id.md
 *
 * One identifier is minted per shift-closeout run by the experience layer.
 * Every other component echoes it unchanged. A mismatch is fail-closed.
 */

import { randomBytes } from 'node:crypto';

/** Mint one correlation identifier per run. Uses a CSPRNG for the hex segment. */
export function mintCorrelationId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hex = randomBytes(16).toString('hex'); // 32 lowercase hex chars
  return `CORR-${date}-${hex}`;
}

/**
 * Extract the user-visible short reference (last 8 hex characters).
 * For human conversation only — never used as a lookup key or stored as the
 * correlation value. See docs/conventions/correlation-id.md §User-visible short reference.
 */
export function shortReference(correlationId) {
  return correlationId.slice(-8);
}

/** Return true when the value matches the required CORR-YYYYMMDD-<32hex> format. */
export function isValidCorrelationId(correlationId) {
  return typeof correlationId === 'string' &&
    /^CORR-\d{8}-[0-9a-f]{32}$/.test(correlationId);
}

/** Assert that two correlationIds are identical. Used by the echo check in output-validator. */
export function assertEcho(inputId, outputId) {
  if (inputId !== outputId) {
    throw Object.assign(
      new Error(`Correlation echo mismatch: input=${inputId} output=${outputId}`),
      { failClosedCode: 'E-OUTPUT-SCHEMA-INVALID' }
    );
  }
}
