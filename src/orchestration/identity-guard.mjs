/**
 * Identity guard — authentication and authorization.
 *
 * REQ-WF-001  REQ-APPR-001  REQ-APPR-002
 * ADR-20260812-007
 *
 * Validates that the requester is authenticated and holds an authorized role.
 *
 * BLOCKER-002 (docs/risks.md): Whether directory role claims are available to a
 * Copilot Studio topic in the target tenant is unverified. This guard implements
 * the full authorization check against personas.authorizedRoleCodes. Resolving a
 * live role claim requires BLOCKER-002 to be answered. Until then, the roleCode
 * is supplied by the caller (the proxy flow or a labelled fixture per the BLOCKER-002
 * safe options).
 */

import { failClosed } from './fail-closed.mjs';
import {
  assertAuthorizedRequester,
  assertNoIdentityPropagation,
} from '../governance/assert-authorized-requester.mjs';

/**
 * Assert that a requester object is authenticated and authorized.
 *
 * @param {object} requester — { actorRef, roleCode, authenticated }
 * @param {object} orgConfig — loaded organization configuration
 * @throws FailClosedError E-IDENTITY-MISSING on any failure
 */
export function assertIdentity(requester, orgConfig) {
  const result = assertAuthorizedRequester(requester, orgConfig);
  if (!result.ok) throw failClosed(result.failClosedCode, result.error);

  const propagation = assertNoIdentityPropagation({ requester });
  if (!propagation.ok) throw failClosed(propagation.failClosedCode, propagation.error);
}
