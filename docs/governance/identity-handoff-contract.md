# Identity Handoff Contract — Connected-Agent Path

**Owner:** Morpheus (Data, Security, and Quality Engineer)
**Requirement IDs:** REQ-WF-001, REQ-APPR-001, REQ-APPR-002, REQ-APPR-003, REQ-SAFE-004, REQ-AUD-002
**Raised against:** BLOCKER-001, BLOCKER-002 (`docs/risks.md`)
**Issue:** #5 — Resolve BLOCKER-002 identity and authorization for connected Foundry agent
**Related work:** #4 (direct Copilot Studio–Foundry connection), #6 (Foundry grounding)

---

## Why this document exists

BLOCKER-001 was resolved in favor of Copilot Studio's built-in, preview
Microsoft Foundry connected-agent path rather than a Power Automate proxy
flow this team controls end to end. That changes the trust boundary: instead
of a proxy component the team writes, authenticates, and can inspect, the
identity path now runs through a preview product surface.

Current Microsoft Learn documentation for the connected-agent path describes
project-endpoint and Agent ID configuration. **It does not document whether,
how, or under what conditions the signed-in user's Microsoft Entra identity
or role claims are propagated to the connected Foundry agent.** Per
`SQUAD_BOOTSTRAP.md` §5 ("Transparent limitations") and the fail-closed,
synthetic-only decision recorded in `.squad/decisions.md`
(2026-08-12: *Synthetic-only draft workflow with fail-closed human
authority*), this repository must not assume undocumented product behaviour
is operational, and must not represent it as verified.

This document defines the **identity handoff envelope** — the minimal,
explicit set of fields that may cross the boundary from the Copilot Studio
experience into any component that governs generation or approval — and the
fail-closed control that enforces it: `src/governance/assert-authorized-requester.mjs`.

Nothing in this document, or in the control it describes, asserts that
Copilot Studio's connected Foundry agent *actually* delivers these fields at
runtime in the target tenant. That remains unverified. What this document and
control guarantee is that **no downstream component in this repository can
proceed past the identity or context gate without an envelope that already
satisfies every rule below**, regardless of what the connected-agent
transport does or does not propagate.

---

## The identity handoff envelope

A connected-agent handoff is any payload that crosses from the Copilot
Studio experience layer toward generation or approval. It is composed of
two independent envelopes, checked at two different points in the workflow:

### 1. Pre-generation envelope

```jsonc
{
  "requester": {
    "actorRef": "USR-RN0000000001",   // opaque human reference, pattern ^USR-[A-Z0-9]{8,24}$
    "roleCode": "registered-nurse",    // must be in personas.authorizedRoleCodes for the org
    "authenticated": true              // must be exactly true
  },
  "context": {
    "syntheticPatientId": "SYN-PAT-PED0001A",
    "syntheticEncounterId": "SYN-ENC-PEDENC001",
    "preGenerationConfirmedAt": "2026-08-13T06:45:00Z", // UTC, must not be stale
    "confirmedByRef": "USR-RN0000000001"                // must equal requester.actorRef
  }
}
```

### 2. Pre-approval envelope

```jsonc
{
  "approver": {
    "actorRef": "USR-RN0000000001",
    "roleCode": "registered-nurse",
    "authenticated": true
  },
  "reconfirmedContext": {
    "syntheticPatientId": "SYN-PAT-PED0001A",     // must equal the original request context
    "syntheticEncounterId": "SYN-ENC-PEDENC001",  // must equal the original request context
    "preApprovalConfirmedAt": "2026-08-13T06:52:00Z" // UTC, must not be stale
  },
  "reconfirmedByRef": "USR-RN0000000001"           // must equal approver.actorRef
}
```

No display name, email address, user principal name, access/refresh/ID token,
tenant or object identifier, phone number, or date of birth may appear at
any nesting depth. Key comparison is case-insensitive and ignores separators,
so variants such as `Email`, `DISPLAY_NAME`, and `access_token` are also
refused. This is enforced structurally, not by convention — see
[Enforcement](#enforcement) below.

---

## Gates enforced

`src/governance/assert-authorized-requester.mjs` exports four functions.
Each returns a result object (`{ ok: true }` or `{ ok: false, error, failClosedCode }`);
none of them throw, matching the existing convention in
`src/governance/approval.mjs` and `src/governance/audit.mjs`.

| Function | Gate | Reused fail-closed code |
|---|---|---|
| `assertAuthorizedRequester(requester, orgConfig)` | Authenticated human `USR-*` actor, opaque `actorRef`, `roleCode` recognised and authorized for the organization | `E-IDENTITY-MISSING` |
| `assertNoIdentityPropagation(handoff)` | No forbidden identity-bearing field name anywhere in the payload, at any depth | `E-IDENTITY-MISSING` |
| `assertPreGenerationHandoff(params)` | Requester gate + propagation gate + well-formed synthetic patient/encounter IDs + fresh, non-future `preGenerationConfirmedAt` + `confirmedByRef === requester.actorRef` ("wrong confirmer" rejection) | `E-IDENTITY-MISSING` / `E-CONTEXT-UNCONFIRMED` |
| `assertPreApprovalHandoff(params)` | Approver gate + propagation gate + reconfirmed patient/encounter equal to the original request context + fresh, non-future `preApprovalConfirmedAt` + `reconfirmedByRef === approver.actorRef` ("wrong confirmer" rejection) | `E-IDENTITY-MISSING` / `E-APPROVAL-WITHOUT-CONFIRMATION` |

No new fail-closed code was introduced. `contracts/**` is explicitly out of
scope for this change (Trinity is the sole integration owner of
`contracts/`, per `.squad/decisions.md`), so this module maps every failure
onto an existing code already defined in
`contracts/schemas/common/definitions.schema.json#/$defs/failClosedCode`.

### Staleness

Both confirmation timestamps are checked against a maximum age, defaulting
to **15 minutes** (`DEFAULT_MAX_CONTEXT_AGE_MS`), overridable per
organization via `orgConfig.operations.maxContextAgeMs`. A missing,
non-numeric, or non-positive override falls back to the default rather than
disabling the check. A timestamp that fails to parse is treated as **infinitely
stale** (`ageMs` returns `Infinity`), so a malformed value fails closed rather
than being treated as fresh by default. A confirmation timestamped in the
future is also refused.

### Wrong confirmer

The pre-generation gate requires `context.confirmedByRef` to equal
`requester.actorRef`: the person the request is attributed to must be the
same person who confirmed the patient and encounter. The pre-approval gate
requires an explicit `reconfirmedByRef` to equal `approver.actorRef`. Neither
existing contract (`shift-closeout-agent-input.schema.json`'s `context`, or
`approval-event.schema.json`'s `reconfirmedContext`) carries a per-envelope
"who confirmed" field distinct from the requester/approver themselves — this
module's envelope is intentionally a superset used at the connected-agent
boundary, before those contracts are populated, so a captured or replayed
confirmation from a different actor is caught before it ever reaches
`context-guard.mjs` or `approval-orchestrator.mjs`.

### No identity propagation

`assertNoIdentityPropagation` walks the entire handoff object recursively
(objects and arrays, any depth) and reports any normalized key name on a
fixed deny-list (`name`, `displayName`, `email`, `upn`,
`userPrincipalName`, `accessToken`, `idToken`, `tenantId`, `oid`, `phone`,
`dateOfBirth`, and others). Key matching lowercases and removes punctuation,
so casing and underscore/hyphen variants cannot bypass the filter. **Only
key names are inspected — values are never read or repeated.** This means a refusal can name exactly
which field was rejected (e.g. `requester.email`) without ever writing the
offending value into an error message, a log line, or an audit event. This
is verified directly in `tests/security/audit-minimality.test.mjs`.

---

## Enforcement

The control is wired into the running orchestration:

- `identity-guard.mjs` delegates requester and approver authorization to
  `assertAuthorizedRequester`.
- `shift-closeout-runner.mjs::requestDraft()` invokes
  `assertPreGenerationHandoff` before input construction and scans the final
  agent input again before the Foundry adapter boundary.
- `approval-orchestrator.mjs::recordDecision()` invokes
  `assertPreApprovalHandoff` before any decision is constructed.
- `shift-closeout-runner.mjs::recordDecision()` requires and threads the
  explicit `reconfirmedByRef`.

The control is exercised directly and through production orchestration by:

- `tests/integration/missing-identity.test.mjs`
- `tests/integration/unauthorized-role.test.mjs`
- `tests/integration/stale-context.test.mjs`
- `tests/integration/connected-agent-orchestration.test.mjs`
- `tests/security/audit-minimality.test.mjs`

against fixtures in `data/synthetic/governance/`.

---

## Human-only approval authority

Authorization is not inferred from role code alone. Request and decision
actors must use an opaque `USR-*` reference. `AGT-*`, `SYS-*`, malformed,
missing, or unauthenticated identities fail with `E-IDENTITY-MISSING`, even
if they supply an otherwise authorized nursing role. The standalone approval
builder applies the same human-only restriction so an alternate code path
cannot manufacture an agent- or system-approved event.

---

## What remains unverified

This document and the accompanying control assume the identity handoff
envelope above is what Copilot Studio would need to construct and pass
toward the connected Foundry agent. **Whether Copilot Studio's built-in
connected-agent path can actually be configured to produce exactly this
envelope — with no more and no less — in the target tenant is not verified
by this change.** That requires connected-tenant testing against a live Copilot Studio
environment and Foundry project. Issues #4 and #6 established the documented
connection design and isolated Foundry evidence, but direct Copilot Studio
connected-agent validation remains **NOT RUN** under RISK-020. The negative
paths in this PR are executable local production-orchestration evidence, not
connected-tenant evidence. Live identity propagation remains unverified
until that connected testing is performed, and no demonstration or
documentation may represent it as operational.

---

## Validation

```bash
node --test tests/integration/missing-identity.test.mjs
node --test tests/integration/unauthorized-role.test.mjs
node --test tests/integration/stale-context.test.mjs
node --test tests/integration/connected-agent-orchestration.test.mjs
node --test tests/security/audit-minimality.test.mjs
node src/governance/test/run-governance-checks.mjs
node scripts/validate-contracts.mjs
node scripts/scan-secrets.mjs
```
