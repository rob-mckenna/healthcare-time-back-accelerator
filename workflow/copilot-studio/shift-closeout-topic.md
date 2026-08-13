# Shift Closeout Topic — Copilot Studio Specification

**Owner:** Tank — Copilot Studio Engineer
**REQ IDs:** REQ-WF-001 through REQ-WF-007, REQ-SCOPE-001, REQ-SCOPE-004, REQ-SAFE-004
**WP:** WP-04

---

> **SIMULATION BOUNDARY NOTICE**
>
> This document specifies the Copilot Studio topic for the shift-closeout experience.
> **BLOCKER-001 invocation model is resolved** (issue #4): Copilot Studio's preview
> **Agents → Add an agent → Connect to an external agent → Microsoft Foundry** path,
> using a new-portal Foundry project endpoint and Agent Id. This supersedes the
> Power Automate proxy option previously recorded for BLOCKER-001. See
> `docs/workflow/copilot-studio-foundry-direct-connection.md` for the full
> specification, official citation, adaptation boundary, and exception paths.
>
> **BLOCKER-002 is resolved for repository controls** by issue #5 / PR #8.
> Explicit requester, authorized-role, context-freshness, same-confirmer,
> human-approval, and audit-redaction gates are implemented and tested. The
> Microsoft Foundry connector documentation does not describe end-user Entra
> identity or role-claim propagation, so this topic never assumes the connection
> supplies them. Live connected-tenant identity and role handoff remains **NOT
> RUN** under RISK-020.
>
> Issue #6 is resolved and supplies the new-portal Foundry agent. Direct
> Copilot Studio connected-agent validation is still **NOT RUN**: no Copilot
> Studio connection or request/response adaptation has been tested in a target
> tenant.

---

## 1. Topic overview

| Attribute | Value |
|---|---|
| Topic name | `ShiftCloseout` |
| Trigger phrase | Provided by the configured organization's `shiftLabel` value |
| Entry point | User intent: "I need to close out my shift" |
| Conversation surface | Copilot Studio (Microsoft 365 Copilot embedded experience or standalone agent) |
| Authentication | System-topic `AuthenticateUser` required before any node in this topic |
| Authorization | `roleCode` must be in `personas.authorizedRoleCodes`; the repository gate is implemented and tested under BLOCKER-002 / issue #5. The live role source is never assumed from the Foundry connection and remains NOT RUN in a connected tenant under RISK-020. |
| Agent invocation | Connected agent via **Agents → Add an agent → Connect to an external agent → Microsoft Foundry** (preview, standard harness). One Copilot Studio agent, one connected Foundry agent. See `docs/workflow/copilot-studio-foundry-direct-connection.md`. |
| Draft label | `DRAFT — HUMAN REVIEW REQUIRED` on every surface that renders the artifact |

---

## 2. Topic flow — six steps

The topic implements the six-step nurse journey defined in the P0 milestone
acceptance criteria (`docs/plan/p0-execution-plan.md`).

### Step 1 — Authentication and authorization (M1)

1. Call `System.AuthenticateUser` to obtain an authenticated session.
2. If authentication fails: surface `errorMessageOverrides["E-IDENTITY-MISSING"]`
   from the configuration pack. End the topic.
3. Resolve the user's `roleCode` into the repository-validated identity handoff
   envelope defined by issue #5. The Foundry connected-agent documentation does
   not describe end-user identity or role propagation, so the live role source
   must be configured and validated in the topic (or a system it calls directly),
   never assumed from the connected-agent action node in Step 3. That target-
   tenant validation remains NOT RUN under RISK-020.
4. If `roleCode` is absent or not in `personas.authorizedRoleCodes`: surface
   `errorMessageOverrides["E-IDENTITY-MISSING"]`. End the topic.
5. Build `actorRef` as `USR-{opaque-reference}` — never include a display name,
   email address, or user principal name in the identifier.
6. Mint one correlation identifier: `CORR-{YYYYMMDD}-{32 hex chars}`. Carry it
   through every turn. Display the short reference (last 8 chars) as `Ref {hex}`.

**Fail closed:** Any gap in steps 1–6 emits `E-IDENTITY-MISSING` and ends the topic.
The connected-agent action node in Step 3 must be structurally unreachable unless
steps 1–6 have completed successfully. The cited documentation does not establish
an authorization check for this accelerator's requester context.

### Step 2 — Patient and encounter confirmation (M2)

1. Present a disambiguation card showing:
   - Synthetic patient identifier with `SYN-PAT-` prefix
   - Synthetic encounter identifier with `SYN-ENC-` prefix
   - Synthetic data notice from `safetyCopy.syntheticDataNotice`
2. Ask: "Is this the correct patient and encounter for your shift closeout?"
3. If the user declines or is unsure: surface `errorMessageOverrides["E-CONTEXT-UNCONFIRMED"]`.
   Offer a restart. End the topic if not restarted.
4. On confirmation: record `preGenerationConfirmedAt` (UTC ISO-8601) and
   `confirmedByRef` from the same authorized human `USR-*` requester.

**Fail closed:** Generation does not begin unless the confirmation is fresh
(`operations.maxContextAgeMs`), `confirmedByRef` matches the requester, and
the envelope contains no sensitive identity keys.

### Step 3 — Draft generation (M3)

1. Show a progress indicator: "{shiftLabel} draft is being prepared…"
2. Assemble the agent input payload per `contracts/schemas/shift-closeout-agent-input.schema.json`.
3. Invoke the Shift Closeout Agent through a connected-agent action created via
   **Agents → Add an agent → Connect to an external agent → Microsoft Foundry**
   (preview, standard harness), addressed by the configured Foundry project
   endpoint connection and Agent Id. See
   `docs/workflow/copilot-studio-foundry-direct-connection.md` for the supported
   setup sequence and the accelerator's adaptation requirements. The cited
   Microsoft documentation does not define transport for this repository's JSON
   contracts. The exact request/response adaptation must be authored and
   validated in the target tenant. This direct invocation is **NOT RUN**.
4. On timeout (`E-AGENT-TIMEOUT`): surface the configured message. End the topic.
5. On agent error (`E-AGENT-ERROR`) — including a missing/removed Foundry
   connection or an unresolvable Agent Id: surface the configured message. End
   the topic.
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
2. Record `preApprovalConfirmedAt` and `reconfirmedByRef` from the current
   authenticated human. If either is absent: `E-APPROVAL-WITHOUT-CONFIRMATION`.
3. Verify patient and encounter match the generation-gate values. If mismatch:
   `E-APPROVAL-WITHOUT-CONFIRMATION`.
4. Verify the reconfirmation is fresh and `reconfirmedByRef` equals the
   approver's `USR-*` actor reference. `AGT-*` and `SYS-*` cannot decide.
5. Record the approval event per `contracts/schemas/approval-event.schema.json`.
6. Display `statusLabel: "APPROVED — SIMULATED FINALIZATION ONLY"`.
7. Display: "No record has been written to any system of record. This is a
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

**Fail closed on every path:** No decision is recorded without a fresh
`preApprovalConfirmedAt`, a matching `reconfirmedByRef`, and matching
patient/encounter context.

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
| Copilot Studio-to-Foundry invocation model decision | BLOCKER-001 | **Resolved** (issue #4, ADR-20260813-011) — direct Foundry connected-agent path. Issue #6 supplied and validated the Foundry agent; direct Copilot Studio binding and contract adaptation remain **NOT RUN** under RISK-020. |
| Repository identity and role authorization controls | BLOCKER-002 | **Resolved** (issue #5 / PR #8) — explicit handoff, authorization, freshness, same-confirmer, human-only approval, and audit-redaction controls are implemented and tested. Live connected-tenant role sourcing and propagation remain NOT RUN under RISK-020. |

All other sub-tasks — fail-closed logic, validation, approval capture, audit events,
error surface rules, draft label rules — are fully specified and implemented in
`src/orchestration/`.

See `docs/risks.md` for the remaining connected-tenant validation risk and
`docs/workflow/copilot-studio-foundry-direct-connection.md` for the full connected-agent
specification.

---

## 6. Connected-agent exception paths

These are accelerator handling requirements for conditions observed around the
Foundry connected-agent invocation. They do not claim that the connector exposes
these exact native error categories. Full detail is in
`docs/workflow/copilot-studio-foundry-direct-connection.md`.

| Exception | Mapped code |
|---|---|
| Missing connection (Foundry connection removed or authentication to it fails) | `E-AGENT-ERROR` |
| Unavailable agent (Agent Id unresolvable, or the connected agent does not respond within `operations.agentTimeoutMs`) | `E-AGENT-ERROR` or `E-AGENT-TIMEOUT` |
| Invalid output (schema, safety, or grounding validation fails) | `E-OUTPUT-SCHEMA-INVALID`, `E-SAFETY-FLAG`, or `E-GROUNDING-FAILURE` |
| Correlation mismatch (echoed `correlationId` does not match the value sent) | `E-OUTPUT-SCHEMA-INVALID` |
| Authorization context absent (the connected-agent action node is reached without a validated `actorRef`/`roleCode`) | `E-IDENTITY-MISSING` |

No new fail-closed code is introduced by the connected-agent binding; every condition maps to
an existing entry in `contracts/schemas/common/definitions.schema.json#/$defs/failClosedCode`.
