# Direct Copilot Studio → Microsoft Foundry Connection Specification

**Owner:** Tank — Copilot Studio Engineer
**REQ IDs:** REQ-WF-001 through REQ-WF-007, REQ-SCOPE-001, REQ-SCOPE-002, REQ-SCOPE-004,
REQ-AGT-001, REQ-SAFE-001 through REQ-SAFE-006, REQ-AUD-001, REQ-APPR-001 through REQ-APPR-003
**WP:** WP-04
**Status:** Specification complete. Live connectivity **NOT RUN — pending #6 project/Agent ID
and tenant verification.**

---

> **Decision (issue #4).** Copilot Studio's preview **Agents → Add an agent → Connect to an
> external agent → Microsoft Foundry** path is the selected binding for the single
> Shift Closeout Agent invocation, using a new-portal Foundry project endpoint and Agent ID.
> This supersedes the Power Automate proxy flow previously recorded as the recommended option
> for BLOCKER-001 in `docs/risks.md`. This document does not change `docs/risks.md`,
> `docs/assumptions.md`, or any ADR — see the handoff redlines in the closing session report
> for the exact edits proposed to Trinity.
>
> Per ADR-20260812-010, this document specifies configuration; it does not assert that the
> connection has been created, tested, or verified in any tenant. That evidence does not exist
> yet.

---

## 1. Official source

Microsoft Learn: [Connect to a Microsoft Foundry agent (preview) — Microsoft Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-foundry-agent)
(`ms.date: 2026-02-13`, retrieved 2026-08-13).

Everything in §2 through §5 below is transcribed or paraphrased directly from that page. No
step, field, or behavior is introduced beyond what the page documents.

## 2. Preview status and harness

The connected-agent feature is explicitly marked **(preview)** in its own title. The page
states it is "powered by the **standard harness**," which uses the billing options described
in Microsoft's standard-harness licensing documentation. This is a licensing and platform
maturity fact, not an implementation detail this accelerator controls — it must be disclosed
wherever this binding is described, per REQ-SAFE-006 (unverified platform behavior is never
represented as operational) and ADR-20260812-010 (deferred/unverified capability is prose-only
until evidenced).

## 3. New Foundry portal requirement

> "When connecting to Microsoft Foundry agents from Copilot Studio, you can only connect to
> agents created in the **new Microsoft Foundry portal**. Connecting to an agent created in the
> previous portal leads to an error indicating `'404 - Version not found'`."

The single Shift Closeout Agent (BLOCKER-003, issue #6) must be created and hosted in the new
Foundry portal. An agent created in the previous portal cannot be connected through this path
and is not a fallback.

## 4. Setup steps (verbatim sequence from the Learn page)

1. On the **Agents** page for the Copilot Studio agent, select **Add an agent**.
2. Under **Connect to an external agent**, select **Microsoft Foundry**.
3. Select an existing connection, or create a new one. Creating a new connection requires the
   **Foundry project endpoint URL** — this is `{{FOUNDRY_PROJECT_ENDPOINT}}` in the reusable
   token contract (`SQUAD_BOOTSTRAP.md` §4), supplied at runtime and never committed.
4. Select **Next**.
5. Enter a **Name** and **Description** for the connected agent. The description is
   consumed by the main Copilot Studio agent's own reasoning to decide when to invoke the
   connected agent, per Microsoft's "writing effective metadata" guidance. It must describe the
   Shift Closeout Agent's purpose specifically enough that it is not confused with any other
   tool or agent — in this accelerator there is exactly one, so the description states the
   single purpose plainly (see §6).
6. Enter the **Agent Id** for the target Foundry agent — `{{FOUNDRY_AGENT_ID}}` in the token
   contract, supplied at runtime and never committed.
7. Adjust the description if needed for disambiguation against other tools (not applicable in
   P0 — see §6).
8. Select **Add Agent**.
9. Test the connected agent immediately after creation. The **Agent Id** can be changed later
   from the agent's details page if the deployed agent is redeployed or replaced.

The Learn page also states plainly that the integrator is responsible for reviewing and testing
connected agents for their specific use case, including data flow appropriateness, quality and
trustworthiness, permissions and approvals, and observability/identity/human-oversight
functions — none of which the connector configures automatically. This is the basis for §7
below.

## 5. Single workflow, single agent

This binding connects exactly one Copilot Studio agent (the care-team `ShiftCloseout` topic
owner) to exactly one Microsoft Foundry agent (the Shift Closeout Agent), matching
REQ-SCOPE-001, REQ-SCOPE-002, and REQ-SCOPE-004. No additional connected agent, tool, or
external agent type is added. The Name and Description entered in step 5 above must not be
written generically ("assistant", "helper agent"): the description should state that the
connected agent drafts a shift-closeout summary and handoff from approved synthetic source data
and returns a structured, source-referenced draft — nothing else — so the main agent's routing
cannot mistake it for a different capability if one is added later.

## 6. Identity and authorization boundary — explicit gap

The Learn page above does **not** describe, anywhere, how (or whether) the signed-in end
user's Microsoft Entra identity, role claims, or any authorization context propagate through
the connected-agent invocation to the Foundry agent or back. It documents connection
credentials (the project endpoint connection) and agent addressing (the Agent Id) only. The
"you're responsible for" note in §4 step 9 explicitly places identity and human-oversight
verification on the implementer, not the connector.

**This specification therefore makes no assumption that the Foundry connection supplies,
carries, or verifies requester identity, role, or authorization.** Every invocation of the
connected agent must be gated by the explicit, validated requester context established
independently in the Copilot Studio topic, per issue #5 (`docs/risks.md` BLOCKER-002):

- The topic must call `System.AuthenticateUser` and resolve a `roleCode` from a source Tank
  does not assume — see BLOCKER-002 and issue #5 for the pending resolution path.
- The topic must independently verify `roleCode` against `personas.authorizedRoleCodes` and
  fail closed with `E-IDENTITY-MISSING` before the connected agent is ever reached.
- The opaque `actorRef` used in the agent input (§7 below) must be built and validated by the
  topic's own identity guard (`src/orchestration/identity-guard.mjs#assertIdentity`), never
  read from any field the Foundry connection surfaces.
- If issue #5 resolves the role-claim source, that resolution happens in the Copilot Studio
  topic (or an upstream system called from it), strictly before the connected-agent action
  node — never inside or after it.

No document from Microsoft, including the one cited here, is treated as satisfying REQ-WF-001
or REQ-SAFE-004. Those requirements are satisfied only by the existing orchestration guards.

## 7. Input mapping — existing contract onto the connected-agent invocation

The connected-agent action node receives whatever the Copilot Studio topic passes as its
invocation input. The existing agent input contract
(`contracts/schemas/shift-closeout-agent-input.schema.json`) is unchanged — the same envelope
Tank has already specified — and its fields map onto the invocation as follows:

| Existing contract field | Source in the topic | Carried across the connected-agent invocation as |
|---|---|---|
| `requester.actorRef`, `requester.roleCode`, `requester.authenticated` | `identity-guard.mjs` output, gated per §6 | Opaque input values; never a display name, email, or token |
| `context.syntheticPatientId`, `context.syntheticEncounterId` | M2 confirmation card, `context-guard.mjs#assertPreGenerationConfirmed` | Confirmed identifiers only, after `preGenerationConfirmedAt` is recorded |
| `correlationId` | Minted once by the topic (`src/orchestration/correlation.mjs`) | Passed unchanged; the agent must echo it in `provenance`/`correlationId` on return (§8) |
| `sourceBundle.bundleId`, `bundleVersion`, `bundleSha256`, `approvedForGeneration` | Configured approved synthetic bundle | Passed as an approved reference only — never inline resource content beyond what the bundle already authorizes |
| `requestedScope`, `shiftPeriod`, `expectedOutputContractVersion`, `agentInstructionVersion` | Topic configuration and `input-builder.mjs#buildInput` | Passed unchanged after schema validation (`E-INPUT-SCHEMA-INVALID` on failure) |
| `revision.*` (when present) | Revision loop (M5) | Sanitised revision instructions only (`revisionInstructionsSanitized: true`); never raw user text |

The full envelope is still assembled and schema-validated by `input-builder.mjs` **before** the
connected-agent action node runs. The connected agent receives the validated envelope as its
invocation content; it never receives an unvalidated or partially-built request.

## 8. Output mapping — connected-agent response onto the existing contract

The connected agent's response must be parsed back into the unchanged
`contracts/schemas/shift-closeout-agent-output.schema.json` envelope before any content is
rendered. The mapping is symmetric to §7:

| Field group in the output contract | What must be present in the parsed response |
|---|---|
| `draftStatus`, `lifecycleStatus: "DRAFT"` | Immutable label and const lifecycle value — refused if absent or altered |
| `safetyStatus` (nine fields) | All nine flags `true`, `groundingCoverageRatio: 1` |
| `correlationId` | Must equal the `correlationId` passed in §7 exactly — a mismatch is `E-OUTPUT-SCHEMA-INVALID` |
| `shiftSummary`, `handoffSummary`, `openItems`, `followUpItems` (as requested by `requestedScope`) | Structured draft content, each with `sourceReferences` |
| `sourceReferences` (master list) | Every reference resolvable to the approved bundle — unresolvable entries are `E-GROUNDING-FAILURE` |
| `provenance` | `agentInstructionVersion`, `agentInstructionSha256`, `sourceBundleId`, `sourceBundleSha256`, `modelConfigRef` |
| `disclaimer` | `mandatoryPrefix`, `body`, `syntheticDataNotice` |

The four-step deterministic validation order in `output-validator.mjs` (schema validation →
safety assertions → grounding resolution → correlation echo) runs unchanged, regardless of
which invocation binding produced the raw response. The connected-agent path changes nothing
about how the response is validated — it only changes how the response is obtained.

## 9. Preserved invariants

The following are unchanged by this connection method and must not be weakened by any future
implementation of this specification:

- Dual patient/encounter confirmation: once before generation (`preGenerationConfirmedAt`),
  once before approval (`preApprovalConfirmedAt`), with a cross-field match check.
- Fail-closed behavior on every one of the twelve codes in
  `docs/workflow/fail-closed-catalog.md`.
- Human approval is the only path from `DRAFT` to `APPROVED-SIMULATED`; the connected agent can
  never emit anything but `DRAFT`.
- No chart write, no production action, no patient/family communication, no autonomous
  finalization — the connected-agent path has no access to any system of record and none is
  introduced here.
- The `DRAFT — HUMAN REVIEW REQUIRED` notice on every surface that renders the artifact.

## 10. Exception paths added or clarified for the connected-agent binding

These extend the fail-closed catalog for conditions specific to the connected-agent invocation
model. Each still maps to an existing code in
`contracts/schemas/common/definitions.schema.json#/$defs/failClosedCode` — no new code is
introduced without a contract change, which is out of Tank's scope for this issue.

| Condition | Trigger | Mapped code | Notes |
|---|---|---|---|
| Missing connection | The Microsoft Foundry connection referenced by the connected-agent action does not exist, was removed, or authentication to it fails | `E-AGENT-ERROR` | Surfaced before any draft content is requested; no partial draft is possible |
| Unavailable agent | The Agent Id does not resolve (agent deleted, wrong portal, wrong project) or the connected agent does not respond within `operations.agentTimeoutMs` | `E-AGENT-TIMEOUT` (timeout) or `E-AGENT-ERROR` (resolution failure) | A `'404 - Version not found'`-class error (§3, old-portal agent) is treated as `E-AGENT-ERROR` |
| Invalid output | The parsed response fails schema validation, a safety flag is not `true`, or grounding does not resolve | `E-OUTPUT-SCHEMA-INVALID`, `E-SAFETY-FLAG`, or `E-GROUNDING-FAILURE` per §8 | Unchanged from the existing catalog |
| Correlation mismatch | The response's echoed `correlationId` does not equal the value sent in §7 | `E-OUTPUT-SCHEMA-INVALID` | Treated identically whether the mismatch originates from a caching, retry, or multi-turn defect in the connector |
| Authorization context absent | The topic reaches the connected-agent action node without a validated `actorRef`/`roleCode` per §6 | `E-IDENTITY-MISSING` | This is a topic-authoring defect if it occurs — the action node must be unreachable without passing the identity guard, not merely discouraged |

## 11. Test flow (specification only — NOT RUN)

The following sequence is specified for the eventual live test, once issue #6 provisions the
Foundry project and Agent Id and a tenant is available:

1. Confirm the Foundry agent exists in the new Foundry portal (§3) with the versioned
   instruction content loaded per `docs/agent/deployment.md`.
2. Create or select the Microsoft Foundry connection in Copilot Studio using the project
   endpoint (§4 step 3).
3. Add the connected agent with Name/Description (§4 step 5) and Agent Id (§4 step 6).
4. Use Copilot Studio's immediate test capability (§4 step 9) with a synthetic, approved
   request built from the example fixtures in `contracts/examples/valid/`.
5. Confirm the test response validates against the output contract (§8) and that all nine
   safety flags are `true`.
6. Confirm the identity/authorization gate in §6 is reachable and enforced — attempt the test
   both as an authorized and an unauthorized synthetic role, and confirm the unauthorized
   attempt never reaches the connected-agent action node.
7. Record the actual result (pass/fail, exact error text if any) as evidence. Until this
   sequence runs, this document's status remains **NOT RUN**.

## 12. Dependencies

- **Issue #5** — BLOCKER-002, identity and authorization for the connected Foundry agent. This
  document assumes issue #5's resolution lands in the topic's identity guard, not in the
  Foundry connection.
- **Issue #6** — BLOCKER-003, isolated Foundry Prompt Agent provisioning. The project endpoint
  and Agent Id this document references do not exist until issue #6 is resolved.

## 13. References

- Microsoft Learn: [Connect to a Microsoft Foundry agent (preview)](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-foundry-agent)
- `docs/risks.md` — BLOCKER-001, BLOCKER-002, BLOCKER-003
- `docs/assumptions.md` — ASM-006 through ASM-009
- `docs/architecture/decisions/ADR-20260812-010.md` — deferred/unverified capability rule
- `workflow/copilot-studio/shift-closeout-topic.md` and
  `workflow/copilot-studio/shift-closeout-topic.yaml` (updated alongside this document)
- `docs/workflow/fail-closed-catalog.md`
- `docs/conventions/correlation-id.md`, `docs/conventions/draft-and-safety-status.md`
