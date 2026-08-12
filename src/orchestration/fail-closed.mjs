/**
 * Shared fail-closed error type.
 *
 * Every guard and validator in the orchestration layer throws a FailClosedError
 * when it stops a run. The runner catches it, emits the appropriate audit event,
 * and surfaces the user-safe message from the organization config.
 *
 * REQ-WF-007  REQ-SAFE-006  ADR-20260812-008
 */

/**
 * Create a fail-closed error.
 *
 * @param {string} code — one of the failClosedCode enum values
 * @param {string} [internalDetail] — structured detail for logging (never shown to user; max 200 chars)
 * @returns {Error}
 */
export function failClosed(code, internalDetail) {
  const err = new Error(internalDetail ?? code);
  err.failClosedCode = code;
  err.isFailClosed = true;
  return err;
}

/** Type-guard: is this a FailClosedError? */
export function isFailClosed(err) {
  return err && err.isFailClosed === true;
}
