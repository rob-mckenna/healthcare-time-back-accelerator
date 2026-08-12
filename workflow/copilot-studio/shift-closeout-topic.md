# Shift Closeout Topic — Copilot Studio Specification

**Owner:** Tank — Copilot Studio Engineer
**REQ IDs:** REQ-WF-001 through REQ-WF-007, REQ-SCOPE-001, REQ-SCOPE-004, REQ-SAFE-004
**WP:** WP-04

---

> **SIMULATION BOUNDARY NOTICE**
>
> This document specifies the Copilot Studio topic for the shift-closeout experience.
> Direct Copilot Studio-to-Foundry invocation binding is pending resolution of
> **BLOCKER-001** (invocation model unverified) and **BLOCKER-002** (role claim
> availability unverified) in `docs/risks.md`. The topic specification is complete;
> the live binding implementation follows when those blockers are resolved.
>
> Per ADR-20260812-010, this document does not contain working platform
> configuration for unverified product behavior. See `docs/risks.md` BLOCKER-001
> and BLOCKER-002 for the decision required and the recommended resolution path.

---

## 1. Topic overview

| Attribute | Value |
|---|---|
| Topic name | `ShiftCloseout` |
| Trigger phrase | Provided by the configured organization's `shiftLabel` value |
| Entry point | User intent: "I need to close out my shift" |
| Conversation surface | Copilot Studio (Microsoft 365 Copilot embedded experience or standalone agent) |
| Authentication | System-topic `AuthenticateUser` required before any node in this topic |
| Authorization | `roleCode` must be in `personas.authorizedRoleCodes`; see BLOCKER-002 |
| Draft label | `DRAFT — HUMAN REVIEW REQUIRED` on every surface that renders the artifact |

---

## 2. Topic flow — six steps

The topic implements the six-step nurse journey defined in the P0 milestone
acceptance criteria (`docs/plan/p0-execution-plan.md`).

### Step 1 — Authentication and authorization (M1)

1. Call `System.AuthenticateUser` to obtain an authenticated session.
2. If authentication fails: surface `errorMessageOverrides["E-IDENTITY-MISSING"]`
   from the configuration pack. End the topic.
3. Resolve the user's `roleCode` — see BLOCKER-002 for the pending resolution path.
4. If `roleCode` is absent or not in `personas.authorizedRoleCodes`: surface
   `errorMessageOverrides["E-IDENTITY-MISSING"]`. End the topic.
5. Build `actorRef` as `USR-{opaque-reference}` — never include a display name,
   email address, or user principal name in the identifier.
6. Mint one correlation identifier: `CORR-{YYYYMMDD}-{32 hex chars}`. Carry it
   through every turn. Display the short reference (last 8 chars) as `Ref {hex}`.

**Fail closed:** Any gap in steps 1–6 emits `E-IDENTITY-MISSING` and ends the topic.

### Step 2 — Patient and encounter confirmation (M2)

1. Present a disambiguation card showing:
   - Synthetic patient identifier with `SYN-PAT-` prefix
   - Synthetic encounter identifier with `SYN-ENC-` prefix
   - Synthetic data notice from `safetyCopy.syntheticDataNotice`
2. Ask: "Is this the correct patient and encounter for your shift closeout?"
3. If the user declines or is unsure: surface `errorMessageOverrides["E-CONTEXT-UNCONFIRMED"]`.
   Offer a restart. End the topic if not restarted.
4. On confirmation: record `preGenerationConfirmedAt` (UTC ISO-8601), `confirmedByRef`.

**Fail closed:** Generation does not begin without a recorded `preGenerationConfirmedAt`.

### Step 3 — Draft generation (M3)

1. Show a progress indicator: "{shiftLabel} draft is being prepared…"
2. Assemble the agent input payload per `contracts/schemas/shift-closeout-agent-input.schema.json`.
3. Invoke the Shift Closeout Agent via the configured invocation path — see BLOCKER-001.
4. On timeout (`E-AGENT-TIMEOUT`): surface the configured message. End the topic.
5. On agent error (`E-AGENT-ERROR`): surface the configured message. End the topic.
6. Validate the agent output through the deterministic validation layer:
   - Schema validation → `E-OUTPUT-SCHEMA-INVALID`
   - Safety assertions → `E-SAFETY-FLAG`
   - Grounding resolution → `E-GROUNDING-FAILURE`
   - Correlation echo → `E-OUTPUT-SCHEMA-INVALID`
7. If any validation step fails: surface the mapped message. Do **not** show any part
   of the draft. End the topic.
8. Render the draft header: `DRAFT — HUMAN REVIEW REQUIRED` (immutable label).
9. Render the configured `disclaimerBody` and `syntheticDataNotice`.
10. Render the short correlation reference: `Ref {shortRef}`.

**Fail closed:** Any validation failure in step 6 refuses the draft entirely. No partial
content is shown as if it were a complete draft.

### Step 4 — Source reference inspection (M4)

1. Each rendered section (shift summary, handoff summary, open items, follow-up items)
   includes a "Source references" control.
2. Selecting a reference shows the `fieldLabel` and `statementExcerpt` from the
   `sourceReference` object.
3. Selecting "View source" opens the underlying synthetic resource content from the
   approved source bundle.
4. If a reference cannot be resolved to the bundle: surface `E-GROUNDING-FAILURE`.
   Do not show the draft.

### Step 5 — Human decision (M5)

Present three clearly labeled controls:

| Control | Action |
|---|---|
| **Approve** | `approvalActionLabel` from config |
| **Reject** | Ask for a required reason before recording |
| **Request revision** | Ask for required revision instructions (up to `maxRevisions`) |

**Approve path:**
1. Present the patient and encounter again for explicit reconfirmation.
2. Record `preApprovalConfirmedAt`. If absent: `E-APPROVAL-WITHOUT-CONFIRMATION`.
3. Verify patient and encounter match the generation-gate values. If mismatch:
   `E-APPROVAL-WITHOUT-CONFIRMATION`.
4. Record the approval event per `contracts/schemas/approval-event.schema.json`.
5. Display `statusLabel: "APPROVED — SIMULATED FINALIZATION ONLY"`.
6. Display: "No record has been written to any system of record. This is a
   simulated prototype approval event."

**Reject path:**
1. Require a reason (free text, max 512 chars).
2. Scan reason for prohibited content — see `decisionReasonScanned`.
3. Record the rejection event.
4. Display `statusLabel: "REJECTED — NOT FOR USE"`.

**Revision path:**
1. Require revision instructions.
2. Check `revisionNumber < operations.maxRevisions`. If limit reached: `E-REVISION-LIMIT-REACHED`.
3. Scan revision instructions — see `revisionInstructionsSanitized`.
4. Return to step 3 (generation) with the revision request appended to the input.

**Fail closed on every path:** No decision is recorded without `preApprovalConfirmedAt`
and a matching patient/encounter context.

### Step 6 — Correlated evidence view (M6)

1. Display the correlation identifier and short reference.
2. Show the event timeline: request → context-confirmation → generation → presentation →
   decision.
3. Each event entry shows: event type, timestamp, outcome, fail-closed code (if any).
4. Show the illustrative time-back view per `contracts/schemas/illustrative-metric.schema.json`,
   with `ILLUSTRATIVE` on every value.
5. State: "These figures are illustrative and derived from a synthetic example scenario.
   They are not measured care-team or organizational outcomes."

---

## 3. Error surface rules

Every fail-closed code maps to a configured user-safe message from
`safetyCopy.errorMessageOverrides`. See `docs/workflow/fail-closed-catalog.md` for the
complete mapping.

Rules:
- Never render a raw exception, stack trace, endpoint, agent prompt fragment,
  correlation detail, or internal field path.
- Never show a partial draft after a validation failure.
- Always show the configured message from the organization pack.
- Always include `Ref {shortRef}` in error messages so a user can report the event.

---

## 4. Draft surface rules

Every surface that renders the draft must include:

1. `DRAFT — HUMAN REVIEW REQUIRED` (the immutable `draftStatus` label)
2. The configured `disclaimerBody`
3. The configured `syntheticDataNotice`
4. The short reference `Ref {shortRef}`
5. Source references for each section

If any of these elements cannot be rendered, the surface must not render the draft.

---

## 5. Blocked sub-tasks

| Sub-task | Blocker | Status |
|---|---|---|
| Live Copilot Studio-to-Foundry binding | BLOCKER-001 | Blocked — pending human decision |
| Role claim resolution from directory | BLOCKER-002 | Blocked — pending human decision |

All other sub-tasks — fail-closed logic, validation, approval capture, audit events,
error surface rules, draft label rules — are fully specified and implemented in
`src/orchestration/`.

See `docs/risks.md` for the exact human decisions required.
