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

/** actorRef must match the opaque reference pattern. */
const ACTOR_REF_PATTERN = /^(USR|AGT|SYS)-[A-Z0-9]{8,24}$/;

/** userRoleCode values must match the contract enum. */
const ROLE_CODES = new Set([
  'registered-nurse', 'charge-nurse', 'clinical-supervisor',
  'administrator', 'demo-observer'
]);

/**
 * Assert that a requester object is authenticated and authorized.
 *
 * @param {object} requester — { actorRef, roleCode, authenticated }
 * @param {object} orgConfig — loaded organization configuration
 * @throws FailClosedError E-IDENTITY-MISSING on any failure
 */
export function assertIdentity(requester, orgConfig) {
  if (!requester || typeof requester !== 'object') {
    throw failClosed('E-IDENTITY-MISSING', 'requester is absent');
  }

  if (requester.authenticated !== true) {
    throw failClosed('E-IDENTITY-MISSING', 'requester.authenticated is not true');
  }

  if (!requester.actorRef || !ACTOR_REF_PATTERN.test(requester.actorRef)) {
    throw failClosed('E-IDENTITY-MISSING', 'requester.actorRef is missing or malformed');
  }

  if (!requester.roleCode || !ROLE_CODES.has(requester.roleCode)) {
    throw failClosed('E-IDENTITY-MISSING', `requester.roleCode "${requester.roleCode}" is not a recognised role code`);
  }

  const authorized = orgConfig?.personas?.authorizedRoleCodes ?? [];
  if (!authorized.includes(requester.roleCode)) {
    throw failClosed(
      'E-IDENTITY-MISSING',
      `requester.roleCode "${requester.roleCode}" is not in authorizedRoleCodes for org "${orgConfig?.organizationId}"`
    );
  }
}
