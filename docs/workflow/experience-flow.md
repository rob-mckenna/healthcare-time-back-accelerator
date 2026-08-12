# Shift-closeout experience flow

**Owner:** Tank — Copilot Studio Engineer
**REQ IDs:** REQ-WF-001 through REQ-WF-007, REQ-SCOPE-001 through REQ-SCOPE-004
**WP:** WP-04

This document describes the complete shift-closeout experience from the nurse's
perspective, mapping each step to requirements, contracts, and implementation files.

---

## Context

The nurse is a care-team hero reclaiming time from the Second Shift. The experience
must be bounded, honest, and human-authoritative. Every generated artifact is a
draft; every decision is a human act.

---

## Journey overview (six milestones)

```
M1: Request  →  M2: Confirm  →  M3: Draft  →  M4: Inspect  →  M5: Decide  →  M6: Evidence
```

Each milestone has a defined acceptance condition in
`docs/plan/p0-execution-plan.md` §Milestone acceptance.

---

## Step-by-step flow

### M1 — The nurse requests a shift-closeout draft

**What happens:**

1. The nurse opens the care-team Copilot Studio agent and expresses the
   shift-closeout intent.
2. The system authenticates the nurse's identity.
3. The system verifies the nurse's role against `personas.authorizedRoleCodes`.
4. The system mints exactly one correlation identifier: `CORR-{date}-{32 hex}`.
5. The short reference (last 8 hex chars, `Ref {hex}`) is displayed immediately.
6. An audit event of type `request` with outcome `success` is emitted.

**Fail-closed conditions:**

| Condition | Code |
|---|---|
| Not authenticated | `E-IDENTITY-MISSING` |
| Role not in authorizedRoleCodes | `E-IDENTITY-MISSING` |
| Config unavailable | `E-CONFIG-MISSING` |

**Implementation:** `src/orchestration/identity-guard.mjs`, `src/orchestration/correlation.mjs`

---

### M2 — The nurse confirms the synthetic patient and encounter

**What happens:**

1. The system displays a confirmation card showing:
   - Synthetic patient identifier (`SYN-PAT-` prefix)
   - Synthetic encounter identifier (`SYN-ENC-` prefix)
   - Synthetic data notice from `safetyCopy.syntheticDataNotice`
2. The nurse confirms. `preGenerationConfirmedAt` and `confirmedByRef` are recorded.
3. An audit event of type `context-confirmation` with outcome `success` is emitted.

**Fail-closed conditions:**

| Condition | Code |
|---|---|
| Confirmation absent or invalid | `E-CONTEXT-UNCONFIRMED` |
| Identifiers missing or malformed | `E-CONTEXT-UNCONFIRMED` |
| Nurse declines or skips | `E-CONTEXT-UNCONFIRMED` |

**Implementation:** `src/orchestration/context-guard.mjs#assertPreGenerationConfirmed`

---

### M3 — The nurse receives a structured Foundry draft

**What happens:**

1. The system shows a progress indicator using `terminology.shiftLabel`.
2. The agent input is assembled per `contracts/schemas/shift-closeout-agent-input.schema.json`
   and validated. Invalid input is refused with `E-INPUT-SCHEMA-INVALID`.
3. The Shift Closeout Agent is invoked via the configured path
   (pending BLOCKER-001 resolution; simulation boundary active in the prototype).
4. The output is validated in fixed order before any content is rendered:
   a. Schema validation — `E-OUTPUT-SCHEMA-INVALID`
   b. Safety assertions (9 fields) — `E-SAFETY-FLAG`
   c. Grounding resolution — `E-GROUNDING-FAILURE`
   d. Correlation echo — `E-OUTPUT-SCHEMA-INVALID`
5. The artifact digest (`artifactSha256`) is computed.
6. An audit event of type `generation` with `schemaValidationPassed: true` and
   `groundingVerified: true` is emitted.
7. An audit event of type `presentation` is emitted.
8. The draft is rendered with:
   - `DRAFT — HUMAN REVIEW REQUIRED` (immutable, always first)
   - Configured `disclaimerBody`
   - Configured `syntheticDataNotice`
   - Short reference `Ref {shortRef}`

**Fail-closed conditions:**

| Condition | Code |
|---|---|
| Input schema invalid | `E-INPUT-SCHEMA-INVALID` |
| Agent timeout | `E-AGENT-TIMEOUT` |
| Agent error | `E-AGENT-ERROR` |
| Output schema invalid | `E-OUTPUT-SCHEMA-INVALID` |
| Safety flag false | `E-SAFETY-FLAG` |
| Unresolvable source reference | `E-GROUNDING-FAILURE` |
| Correlation echo mismatch | `E-OUTPUT-SCHEMA-INVALID` |

**Implementation:** `src/orchestration/input-builder.mjs`, `src/orchestration/foundry-adapter.mjs`,
`src/orchestration/output-validator.mjs`, `src/orchestration/shift-closeout-runner.mjs`

---

### M4 — The nurse inspects the source references

**What happens:**

1. Each rendered section (shift summary, handoff summary, open items, follow-up items)
   includes a source references control.
2. Selecting a reference shows `fieldLabel` and `statementExcerpt`.
3. Selecting "View source" opens the underlying synthetic resource content.
4. Every `sourceReference.resourceId` resolves to an entry in the approved bundle.

**Fail-closed condition:** An unresolvable reference emits `E-GROUNDING-FAILURE`.
The draft is refused rather than shown with an unsupported statement.

**Implementation:** `src/orchestration/output-validator.mjs` (grounding resolution step)

---

### M5 — The nurse approves, rejects, or requests a revision

**What happens — Approve:**

1. The system re-presents the patient and encounter for explicit reconfirmation.
2. `preApprovalConfirmedAt` is recorded.
3. Patient and encounter identifiers are verified against the generation-gate values
   (`context-reconfirmation-match` rule).
4. An approval event is assembled per `contracts/schemas/approval-event.schema.json`,
   bound to `artifactSha256`.
5. `lifecycleStatus` moves from `DRAFT` to `APPROVED-SIMULATED`.
6. The nurse sees: "APPROVED — SIMULATED FINALIZATION ONLY" and the notice
   that no record has been written to any system of record.

**What happens — Reject:**

1. The nurse provides a required reason (max 512 chars, scanned).
2. The approval event records `decision: "rejected"` and `decisionReasonScanned: true`.
3. `lifecycleStatus` moves to `REJECTED`.

**What happens — Request revision:**

1. The nurse provides required revision instructions.
2. The system checks `revisionNumber < operations.maxRevisions`. If the limit is
   reached: `E-REVISION-LIMIT-REACHED`.
3. The revision request is recorded, the draft is withdrawn, and generation restarts
   within the same correlation ID.

**Fail-closed conditions:**

| Condition | Code |
|---|---|
| preApprovalConfirmedAt absent | `E-APPROVAL-WITHOUT-CONFIRMATION` |
| Patient or encounter mismatch | `E-APPROVAL-WITHOUT-CONFIRMATION` |
| Reason absent for reject/revise | `E-APPROVAL-WITHOUT-CONFIRMATION` |
| Revision limit reached | `E-REVISION-LIMIT-REACHED` |

**Implementation:** `src/orchestration/context-guard.mjs#assertPreApprovalConfirmed`,
`src/orchestration/approval-orchestrator.mjs#recordDecision`

---

### M6 — The nurse inspects correlated approval and audit evidence

**What happens:**

1. The nurse requests the evidence view (or it is shown automatically after a decision).
2. The correlation identifier retrieves all audit events for the run.
3. The event timeline is shown: request → context-confirmation → generation →
   presentation → decision.
4. Each event shows type, timestamp, outcome, and fail-closed code (if any).
5. No event carries narrative content, patient values, or generated text.
6. The illustrative time-back view is shown with `ILLUSTRATIVE` on every value.
7. The disclaimer is shown: "These figures are illustrative and derived from a
   synthetic example scenario. They are not measured care-team or organizational outcomes."

**Implementation:** `src/orchestration/shift-closeout-runner.mjs#queryEvidence`,
`src/orchestration/audit-adapter.mjs#queryByCorrelationId`

---

## Draft label rules

The `draftStatus` label `DRAFT — HUMAN REVIEW REQUIRED` must appear on every surface
that renders the artifact: the conversational canvas, any exported text, and any copied
block. The label never changes, including after approval. An approved artifact is a draft
that a human accepted; it is not a signed clinical document. The approval event carries
the record of acceptance.

See `docs/conventions/draft-and-safety-status.md` for the full convention.

---

## Single correlation identifier

One correlation identifier is minted per run. It is carried through every component
and event. A mismatch is fail-closed. The bounded revision loop stays inside one run
and keeps the same identifier; each attempt gets its own `generationId`.

`requestDraft` mints the identifier. It accepts an existing identifier only when the
call also carries a `revision` block, which is the one case where a run legitimately
continues. Supplying an identifier without a revision fails closed with
`E-INPUT-SCHEMA-INVALID`, so no caller can join another run's evidence trail.

See `docs/conventions/correlation-id.md` for the format and convention.

---

## Governance wiring

The orchestration layer holds no second copy of a governance rule. Each step calls
the shared implementation in `src/governance/`, so the generation path and the
approval path cannot drift apart:

| Orchestration module | Governance module it calls | What it delegates |
|---|---|---|
| `output-validator.mjs` | `validate-payload.mjs` | The four ordered checks: output schema, safety assertions, grounding resolution, correlation echo |
| `approval-orchestrator.mjs` | `phi-scan.mjs` | The decision-reason scan behind `decisionReasonScanned` |
| `input-builder.mjs` | `phi-scan.mjs` | The revision-instruction scan behind `revisionInstructionsSanitized` |
| `audit-adapter.mjs` | `audit.mjs` | Minimal event construction and the write-failure contract |
| `src/view/time-back-view.mjs` | `metrics.mjs` | Illustrative figure computation from the organization pack |

Neither sanitisation marker can be set without its scan having run, and an audit
write failure raises `E-AUDIT-WRITE-FAILURE` and stops the run rather than being
logged and swallowed.

---

## Configuration-driven strings

Every organization-specific string comes from the organization configuration pack.
No organization name, persona name, unit label, role label, or time-back figure
is hardcoded in the orchestration layer. The Harborlight pack at
`config/organizations/harborlight/organization.json` is the example.

---

## Blocked sub-tasks

| Sub-task | Blocker | Impact |
|---|---|---|
| Live Copilot Studio-to-Foundry binding | BLOCKER-001 | Orchestration logic and validation are complete; the live invocation binding awaits human decision |
| Role claim resolution | BLOCKER-002 | Authorization check is implemented; the live claim source awaits human decision |

All fail-closed logic, validation, approval capture, audit events, and draft label
rules are fully implemented and tested. See `docs/risks.md` for the exact decisions required.

## Running the flow locally

`node scripts/run-local-journey.mjs` executes M1 through M6 against the synthetic
dataset with no platform dependency, printing the draft, the resolved source
references, every decision path, the correlated evidence, and the illustrative
view. Generation runs through the simulation boundary in
`src/orchestration/foundry-adapter.mjs`, which is labelled as such in the output and
in the run record. Recorded output is in
`docs/evidence/2026-08-12-integration-run.md`.
