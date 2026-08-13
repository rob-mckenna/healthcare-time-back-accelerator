# Fail-closed catalog

**Owner:** Tank — Copilot Studio Engineer
**REQ IDs:** REQ-WF-007, REQ-SAFE-006
**WP:** WP-04

Every condition that stops a shift-closeout run is listed here with its code,
trigger, user-safe message source, audit outcome, and test coverage evidence.

The twelve codes are defined in
`contracts/schemas/common/definitions.schema.json#/$defs/failClosedCode`.

Rules that apply to every code (from `docs/conventions/draft-and-safety-status.md`):

1. The run stops. Nothing partial is shown as if it were a complete draft.
2. An audit event is emitted carrying the code. An audit event with outcome
   `failure` or `blocked` without a `failClosedCode` is refused by the contract.
3. The user sees the message configured in `safetyCopy.errorMessageOverrides`,
   never a raw exception, stack trace, endpoint, or payload fragment.
4. `E-AUDIT-WRITE-FAILURE` stops the run even if evidence cannot be recorded.

---

## Catalog

### E-IDENTITY-MISSING

| Attribute | Value |
|---|---|
| Trigger | `requester.authenticated` is not `true`; `actorRef` is absent or malformed; `roleCode` is absent, unrecognised, or not in `personas.authorizedRoleCodes` |
| Guard | `src/orchestration/identity-guard.mjs#assertIdentity` |
| Audit eventType | `request` |
| Audit outcome | `blocked` |
| User message source | `safetyCopy.errorMessageOverrides["E-IDENTITY-MISSING"]` |
| Harborlight message | "We could not verify your identity for this workflow. Please sign out, sign back in, and try again." |
| Test coverage | `run-fail-closed-catalog.mjs` — unauthenticated, missing actorRef, unauthorized role |
| Evidence boundary | BLOCKER-002 repository authorization controls are resolved; live connected-tenant role sourcing remains NOT RUN under RISK-020 (see `docs/risks.md`) |

---

### E-CONFIG-MISSING

| Attribute | Value |
|---|---|
| Trigger | Organization config file not found; required key absent; `authorizedRoleCodes` empty |
| Guard | `src/orchestration/config-loader.mjs#loadOrgConfig` |
| Audit eventType | `request` |
| Audit outcome | `blocked` |
| User message source | Generic safe message (config is unavailable; no pack to query) |
| Message | "The workflow configuration could not be loaded. Please contact your administrator." |
| Test coverage | `run-fail-closed-catalog.mjs` — non-existent organization ID |

---

### E-CONTEXT-UNCONFIRMED

| Attribute | Value |
|---|---|
| Trigger | Confirmation absent, malformed, stale, future-dated, or attributed to an actor other than the requester |
| Guard | `src/governance/assert-authorized-requester.mjs#assertPreGenerationHandoff` |
| Audit eventType | `context-confirmation` |
| Audit outcome | `blocked` |
| User message source | `safetyCopy.errorMessageOverrides["E-CONTEXT-UNCONFIRMED"]` |
| Default message | "Patient and encounter confirmation is required before a draft can be requested." |
| Test coverage | `run-fail-closed-catalog.mjs`; `connected-agent-orchestration.test.mjs`; `stale-context.test.mjs` |

---

### E-INPUT-SCHEMA-INVALID

| Attribute | Value |
|---|---|
| Trigger | Agent input fails validation against `shift-closeout-agent-input.schema.json` |
| Guard | `src/orchestration/input-builder.mjs#buildInput` |
| Audit eventType | `request` |
| Audit outcome | `failure` |
| User message source | `safetyCopy.errorMessageOverrides["E-INPUT-SCHEMA-INVALID"]` |
| Default message | "The request could not be validated. Please try again." |
| Test coverage | `run-fail-closed-catalog.mjs` — empty requestedScope (minItems violation) |

---

### E-OUTPUT-SCHEMA-INVALID

| Attribute | Value |
|---|---|
| Trigger | Agent output fails `shift-closeout-agent-output.schema.json`; `lifecycleStatus` is not `DRAFT`; `correlationId` echo mismatch |
| Guard | `src/orchestration/output-validator.mjs#validateOutput` step 1 and step 4 |
| Audit eventType | `generation` |
| Audit outcome | `failure` |
| User message source | `safetyCopy.errorMessageOverrides["E-OUTPUT-SCHEMA-INVALID"]` |
| Default message | "The generated draft could not be validated and will not be shown." |
| Test coverage | `run-fail-closed-catalog.mjs` — correlation echo mismatch, lifecycleStatus const violation |

---

### E-GROUNDING-FAILURE

| Attribute | Value |
|---|---|
| Trigger | A `sourceReference.resourceId` in any section does not resolve to an entry in the approved source bundle; bundle is empty |
| Guard | `src/orchestration/output-validator.mjs#validateOutput` step 3 |
| Audit eventType | `generation` |
| Audit outcome | `failure` |
| User message source | `safetyCopy.errorMessageOverrides["E-GROUNDING-FAILURE"]` |
| Default message | "The draft contains a statement that could not be traced to an approved source. The draft has been refused." |
| Test coverage | `run-fail-closed-catalog.mjs` — empty bundle, partial bundle (missing resourceId) |
| Note | Also emitted if source reference inspection cannot resolve a reference at presentation time (step 4) |

---

### E-SAFETY-FLAG

| Attribute | Value |
|---|---|
| Trigger | Any of the nine `safetyStatus` boolean fields is not `true`; `groundingCoverageRatio` is not `1` |
| Guard | `src/orchestration/output-validator.mjs#validateOutput` step 2 |
| Audit eventType | `generation` |
| Audit outcome | `failure` |
| User message source | `safetyCopy.errorMessageOverrides["E-SAFETY-FLAG"]` |
| Default message | "The draft did not pass the required safety check and will not be shown." |
| Test coverage | `run-fail-closed-catalog.mjs` — `noDiagnosis: false` |

---

### E-AGENT-TIMEOUT

| Attribute | Value |
|---|---|
| Trigger | Agent invocation does not return within `operations.agentTimeoutMs` |
| Guard | `src/orchestration/foundry-adapter.mjs#invoke` — Promise.race with timeout |
| Audit eventType | `generation` |
| Audit outcome | `failure` |
| User message source | `safetyCopy.errorMessageOverrides["E-AGENT-TIMEOUT"]` |
| Default message | "The draft request took too long to complete. Please try again." |
| Test coverage | `run-fail-closed-catalog.mjs` — 1 ms timeout override via `_testOptions.timeoutMs` |

---

### E-AGENT-ERROR

| Attribute | Value |
|---|---|
| Trigger | Agent invocation throws a non-timeout error (network failure, parse error, example file unavailable in simulation) |
| Guard | `src/orchestration/foundry-adapter.mjs#invoke` catch block |
| Audit eventType | `generation` |
| Audit outcome | `failure` |
| User message source | `safetyCopy.errorMessageOverrides["E-AGENT-ERROR"]` |
| Default message | "The draft could not be generated. Please try again." |
| Test coverage | Verified by `IS_SIMULATION_BOUNDARY` export confirming the error path is present; live invocation path maps thrown errors to this code |

---

### E-APPROVAL-WITHOUT-CONFIRMATION

| Attribute | Value |
|---|---|
| Trigger | Reconfirmation absent, malformed, stale, future-dated, attributed to the wrong actor, or for a mismatched patient/encounter; decision reason absent for reject or revision |
| Guard | `src/governance/assert-authorized-requester.mjs#assertPreApprovalHandoff`; `src/orchestration/approval-orchestrator.mjs#recordDecision` |
| Audit eventType | `decision` |
| Audit outcome | `blocked` |
| User message source | `safetyCopy.errorMessageOverrides["E-APPROVAL-WITHOUT-CONFIRMATION"]` |
| Default message | "Patient and encounter confirmation is required before a decision can be recorded." |
| Test coverage | `run-fail-closed-catalog.mjs`; `connected-agent-orchestration.test.mjs`; `stale-context.test.mjs` |

---

### E-REVISION-LIMIT-REACHED

| Attribute | Value |
|---|---|
| Trigger | `revisionNumber >= operations.maxRevisions` when decision is `revision-requested` |
| Guard | `src/orchestration/approval-orchestrator.mjs#recordDecision` |
| Audit eventType | `decision` |
| Audit outcome | `blocked` |
| User message source | `safetyCopy.errorMessageOverrides["E-REVISION-LIMIT-REACHED"]` |
| Default message | "The maximum number of revision requests has been reached. Please reject the draft and start a new request." |
| Test coverage | `run-fail-closed-catalog.mjs` — revisionNumber equals maxRevisions (3) |
| Config | `operations.maxRevisions` in the organization pack (Harborlight: 3) |

---

### E-AUDIT-WRITE-FAILURE

| Attribute | Value |
|---|---|
| Trigger | Audit event schema validation fails; event log write throws; audit schema cannot be loaded |
| Guard | `src/orchestration/audit-adapter.mjs#emit` |
| Audit eventType | N/A — the audit write itself failed; the run stops |
| Audit outcome | N/A |
| User message source | `safetyCopy.errorMessageOverrides["E-AUDIT-WRITE-FAILURE"]` |
| Default message | "The workflow evidence record could not be written. The run has stopped." |
| Test coverage | `run-fail-closed-catalog.mjs` — missing required fields, outcome=failure without failClosedCode |
| Note | This code is deliberately included: if evidence cannot be recorded, the run is not permitted to continue on the assumption that it went well |

---

## Test command

```
node src/orchestration/test/run-fail-closed-catalog.mjs
```

Expected output: all twelve codes exercised, all user-safe messages resolved,
exit code 0.
