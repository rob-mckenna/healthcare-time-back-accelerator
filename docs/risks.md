# Risks

Owner: Trinity. Raised at the Design Review on 2026-08-12 by Switch, Tank, Neo,
and Morpheus, consolidated under a single identifier scheme.

Severity is the impact if the risk is realised during a P0 demonstration or
review. `Blocker` means work stops for the affected scope until a human decides.

## Blocker register

These are the items where the accepted baseline cannot proceed to a working
implementation without a decision or a verification that Trinity cannot make.

### BLOCKER-001 — Copilot Studio to Foundry invocation model

| | |
|---|---|
| Raised by | Tank |
| Severity | Blocker |
| Affects | REQ-SCOPE-001, REQ-SCOPE-002, REQ-AGT-001, work packages WP-04 and WP-05 |
| Blocks | **RESOLVED for path selection.** Live direct connected-agent validation remains outstanding under RISK-020. |
| Status (2026-08-13) | **RESOLVED.** ADR-20260813-011 selects the documented direct Microsoft Foundry connected-agent path. |

**Evidence.** Microsoft Learn documents a preview Copilot Studio path:
**Agents → Add an agent → Connect to an external agent → Microsoft Foundry**.
Creating the connection requires a Foundry project endpoint, followed by Name,
Description, and Agent Id. The Foundry agent must have been created in the new
Microsoft Foundry portal.

The human owner selected this direct path in issue #4. ADR-20260813-011 records
the decision and removes Power Automate from the target invocation path.

**Resolution boundary.** The official source establishes how to add and address
the connected Foundry agent. It does not establish this accelerator's structured
request/response adaptation, timeout semantics, error taxonomy, or end-user
identity propagation. Direct connected-agent validation is therefore
**NOT RUN** and tracked as RISK-020. BLOCKER-002's repository controls are
resolved separately; live identity and role propagation remain inside the
RISK-020 connected-tenant validation boundary.

**Official source.**
[Connect to a Microsoft Foundry agent (preview)](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-foundry-agent),
reviewed 2026-08-13.

### BLOCKER-002 — Repository identity and authorization controls

| | |
|---|---|
| Raised by | Tank |
| Severity | Blocker |
| Affects | REQ-WF-001, REQ-APPR-001, REQ-APPR-002, work package WP-04 |
| Blocks | **RESOLVED for repository controls.** Connected-tenant identity and role handoff validation remains NOT RUN under RISK-020. |
| Status (2026-08-13) | **RESOLVED.** Repository identity, authorization, context freshness, approval authority, and audit-minimality controls are implemented and exercised. |

**Repository evidence.** `src/governance/assert-authorized-requester.mjs`
enforces authenticated opaque human actors, organization-authorized roles,
forbidden identity-field rejection, fresh patient/encounter confirmation, and
same-actor confirmation at generation and approval. The running orchestration
invokes these gates before generation and before any decision is recorded.
Approval and audit paths independently reject agent/system approvers and redact
identity-bearing or token-like fields. The contract and evidence boundary is
documented in `docs/governance/identity-handoff-contract.md` and exercised by
the connected-agent orchestration, missing-identity, unauthorized-role,
stale-context, approval-bypass, and audit-minimality tests.

**Resolution boundary.** This evidence validates the repository's behavior
when it receives an identity handoff envelope. It does not prove that a live
Copilot Studio connected-agent configuration in the target tenant can source,
shape, and transmit that envelope. No live tenant identity propagation or role
mapping is claimed. That connected-system validation remains **NOT RUN** under
RISK-020 and must fail closed if the repository envelope cannot be preserved.

### BLOCKER-003 — Foundry external retrieval default must be verified and disabled

| | |
|---|---|
| Raised by | Neo |
| Severity | Blocker |
| Affects | REQ-SAFE-002, REQ-AGT-004, work package WP-05 |
| Blocks | Any demonstration of generated content. |
| Status (2026-08-13, updated) | **RESOLVED.** Tool/retrieval configuration verified. Live behavioral evaluation ran 7/7 passing after a human-authorized capacity increase — see below. |

**Evidence.** `safetyStatus.externalRetrievalDisabled` is pinned to `true` in the
output contract, and `groundingCoverageRatio` is pinned to `1`. Both assume no
external knowledge augmentation contributes to a draft. That is an assertion the
payload makes about its own deployment, which the payload cannot prove. If any
retrieval or knowledge-augmentation feature is enabled by default on the agent,
content could enter a draft that does not resolve to the approved synthetic
bundle — which in a healthcare handoff is unsourced clinical-adjacent text.

**2026-08-13 update (issue #6).** An isolated, non-production Foundry project
(`second-shift-p0-dev`, `eastus2`) was provisioned and exactly one Prompt Agent
(`shift-closeout-agent`, model `gpt-4.1-mini` v`2025-04-14`, `GlobalStandard`
capacity `1`) was created via the `azure-ai-projects` SDK v2 preview. Direct
verification of the created agent's definition via SDK confirmed:

- No `tools` key present on the agent definition (not merely an empty array).
- No hosted agents, no capability host, and no Azure Container Registry exist
  in the project (all confirmed empty/absent via direct `az`/`az rest` queries).
- The agent's stored instructions SHA-256 matches
  `manifest.json#instructionSha256` exactly:
  `f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96`.

This directly verifies the tool/retrieval-configuration half of BLOCKER-003.

**2026-08-13 follow-up — live behavioral evaluation could not run at capacity 1.**
Every agent-mediated invocation attempt (6 total, including diagnostics)
returned HTTP 429 `rate_limit_exceeded`. A direct, non-agent model call
succeeded trivially (10 total tokens), proving the model deployment itself
was healthy. The deployment's configured rate limits were `request: 1/60s`
and `token: 1000/60s` — but the agent's stored system instructions alone are
approximately 4,000 tokens, so every agent-mediated call was rejected
regardless of the caller's own input size or requested output length. Full
diagnosis: `docs/evidence/2026-08-13-foundry-agent-provisioning.md`.

**2026-08-13 resolution — capacity increase authorized and live evaluation ran.**
A human explicitly authorized raising the same non-production `gpt-4.1-mini`
`GlobalStandard` deployment from capacity `1` to capacity `10` (no region,
model, version, SKU, project, or agent change). Post-change verification
confirmed rate limits of `request: 10/60s` and `token: 10000/60s`, and that
the agent still has zero tools attached, unchanged `kind: "prompt"`, unchanged
model reference, and unchanged agent version. The bounded live evaluation
suite required by WP-05 (valid structured draft, source grounding,
unsupported-fact refusal, prompt-injection refusal,
prohibited-clinical-recommendation refusal, immutable draft/safety constants,
malformed/schema output handling) then ran serially and **all 7 cases
passed**, each validated through the existing deterministic
schema/grounding/safety validator before being counted as passing. Full
result detail, including three genuine (non-safety) structured-output
prompt-completeness findings discovered and fixed during iterative live
testing: `docs/evidence/2026-08-13-foundry-live-evaluation.md`.

BLOCKER-003 is **resolved**: both the tool/retrieval-configuration half and
the live behavioral-evaluation half are now evidenced.

**Safe options (historical).**

1. Verify the agent deployment configuration, disable every retrieval and
   knowledge-augmentation feature, and record the verified configuration as
   evidence before any demonstration. — **Done; see the 2026-08-13 update
   above.**
2. Keep the external grounding check as the compensating control and accept that
   a violation is detected after generation rather than prevented. — Retained
   as defence in depth regardless of resolution.
3. Approve a capacity increase for the `gpt-4.1-mini` `GlobalStandard`
   deployment so the live behavioral evaluation suite can actually run. —
   **Done; capacity raised to 10 under explicit human authorization, and the
   live suite ran and passed 7/7. See
   `docs/evidence/2026-08-13-foundry-live-evaluation.md`.**

**Cost/cleanup note.** The deployment remains at capacity `10` in the isolated,
non-production project. Reverting to capacity `1` or tearing down the
isolated project once dependent review work concludes are both safe cleanup
options for a human to choose; neither is performed unilaterally here.

### BLOCKER-004 — Governing charter is truncated and defines no blocker codes

| | |
|---|---|
| Raised by | Trinity |
| Severity | Blocker for governance, not for implementation |
| Affects | REQ-VAL-004 and the escalation protocol itself |
| Blocks | Nothing technical. Recorded because the escalation protocol references content that does not exist. |

**Evidence.** `SQUAD_BOOTSTRAP.md` ends at line 342 in the middle of the ADR
format code block in section 9, with no closing fence. The task instructions
direct agents to escalate conditions matching `BLOCKER-*`, but the charter
defines no `BLOCKER-*` codes and contains no definition-of-done section, despite
both being referenced. Agents have therefore been improvising blocker codes,
which is why this file renumbers them.

The charter is human-owned and read-only for every agent, so it cannot be
repaired here.

**Safe options.**

1. The human owner completes section 9 and adds the missing `BLOCKER-*` catalog
   and definition of done.
2. The team adopts this file as the blocker register for P0, with `BLOCKER-NNN`
   as the identifier scheme, until the charter is completed.

**Recommendation.** Option 2 immediately so work is not stalled, and option 1 at
the next charter revision.

**Exact human decision required.** "Confirm that `docs/risks.md` is the P0 blocker
register using `BLOCKER-NNN` identifiers, and state whether `SQUAD_BOOTSTRAP.md`
section 9 onward will be completed."

## Open risks

| ID | Risk | Raised by | Severity | Affects | Mitigation | Status |
|---|---|---|---|---|---|---|
| RISK-001 | Handoff content drifts into clinical recommendation under realistic inputs | Switch, Neo | High | REQ-SAFE-002 | No recommendation surface exists in the output contract (ADR-20260812-003); `additionalProperties: false`; safety assertions checked externally | Mitigated at baseline |
| RISK-002 | Generated text includes statements not present in the approved source | Neo | High | REQ-AGT-004 | Every section requires resolvable source references; `groundingCoverageRatio` pinned to `1`; `E-GROUNDING-FAILURE` refuses the run | Mitigated at baseline |
| RISK-003 | A demonstration audience reads `APPROVED-SIMULATED` as a clinical approval | Switch, Morpheus | High | REQ-SAFE-003 | Value is explicitly suffixed; draft label never changes; ADR-20260812-004 | Mitigated at baseline |
| RISK-004 | Illustrative time-back figures are quoted as measured results | Switch | High | REQ-MET-001 | Label, boolean, disclaimer, and not-for-clinical-use flag all carried on the value itself; prohibited claim list blocks the phrasings | Mitigated at baseline |
| RISK-005 | A real endpoint or credential is pasted into the example organization pack | Morpheus | High | REQ-CFG-003 | `environmentBindings` values must match a variable-name pattern, so a literal fails validation; `npm run scan:secrets` as backstop | Mitigated at baseline |
| RISK-006 | Free-text rejection reasons or revision instructions carry identifiable content | Morpheus | Medium | REQ-DATA-001 | `decisionReasonScanned` and `revisionInstructionsSanitized` pinned to `true`; `src/governance/phi-scan.mjs` is called directly by `src/orchestration/approval-orchestrator.mjs` and `src/orchestration/input-builder.mjs`, so neither marker can be set without the scan running | Mitigated — a decision reason carrying a telephone number and an injected revision instruction were both refused with `E-SAFETY-FLAG` in the 2026-08-12 local run |
| RISK-007 | Audit events accumulate narrative content as fields are added for convenience | Morpheus | Medium | REQ-AUD-002 | `additionalProperties: false` on the audit contract; negative fixture proves refusal | Mitigated at baseline |
| RISK-008 | The correlation identifier is regenerated mid-run, splitting the audit trail | Tank | Medium | REQ-AUD-001 | Single minting authority; echo mismatch is fail-closed; `correlation-propagation` rule | Mitigated at baseline |
| RISK-009 | Agent instruction changes are made in a console, so a draft cannot be reproduced | Neo | Medium | REQ-AGT-002 | Instructions live as versioned repository files; `agentInstructionSha256` required in provenance; `npm run evaluate:digest` recomputes the digest from the instruction content | Mitigated — the deployment binding under BLOCKER-003 is now verified: the live agent's stored instructions digest matched `manifest.json` exactly at creation and again after the capacity change, and every live-evaluated output echoed the correct digest |
| RISK-010 | The revision loop runs unbounded, producing cost and confusing evidence | Tank | Medium | REQ-WF-006 | `operations.maxRevisions` in the organization pack; `E-REVISION-LIMIT-REACHED` | Mitigated — the limit refusal was exercised in the 2026-08-12 local run and in `npm run test:fail-closed` |
| RISK-011 | Audit write failure is swallowed and the run continues without evidence | Morpheus | Medium | REQ-AUD-003 | `E-AUDIT-WRITE-FAILURE` is an explicit fail-closed code, not a logged warning; `src/orchestration/audit-adapter.mjs` writes through `src/governance/audit.mjs` and converts any sink failure into that code | Mitigated — two audit write-failure cases pass in `npm run test:fail-closed` |
| RISK-012 | Error messages leak endpoints, payload fragments, or stack traces to the user | Tank | Medium | REQ-WF-007 | `safetyCopy.errorMessageOverrides` supplies every user-facing message; raw exceptions never rendered | Mitigated — all twelve codes map to configured messages in `npm run test:fail-closed`, and the local run showed only the configured text on refusal |
| RISK-013 | Synthetic identifiers are mistaken for real ones in a screenshot or export | Morpheus | Low | REQ-DATA-002 | Mandatory `SYN-` prefixes and a direct-identifier denylist; two negative fixtures | Mitigated at baseline |
| RISK-014 | Scope expands during implementation because a stub looks easy to add | Trinity | Medium | REQ-SCOPE-008 | ADR-20260812-010 prohibits stubs for deferred systems; Trinity is the sole integration owner | Ongoing |
| RISK-015 | Two agents edit the same file and a safety constraint is lost in a merge | Trinity | Medium | REQ-VAL-004 | Non-overlapping file ownership in `docs/plan/p0-execution-plan.md`; `contracts/` is Trinity-only | Ongoing |
| RISK-016 | Node, npm, or AJV availability differs on another machine and validation cannot run | Trinity | Low | REQ-VAL-001 | Single dev dependency set, lockfile committed, no global tooling required | Mitigated at baseline |
| RISK-017 | The simulated generation boundary is mistaken for the separately validated live Foundry agent or a live Copilot Studio connection | Trinity | High | REQ-SAFE-006, REQ-SCOPE-002 | `src/orchestration/foundry-adapter.mjs` exports `IS_SIMULATION_BOUNDARY` and a label naming RISK-020; the local journey separately records issue #6 live-agent evidence and direct connected-agent `NOT RUN` status; integration tests assert both | Mitigated at the artifact level; the spoken demonstration must still state it, per `docs/demo/talk-track.md` |
| RISK-018 | A narrow secret-scan carve-out is widened until a committed credential passes | Trinity | Medium | REQ-VAL-003 | The carve-out applies to one rule only, fires only when the matched value contains a template interpolation, and leaves literal-value detection unchanged; `tests/security/secret-exposure.test.mjs` asserts twelve credential-shaped and identifier-shaped values still fire and that a literal key on a line that also contains an interpolation is still caught | Mitigated — 10 of 10 secret-exposure tests pass and `npm run scan:secrets` reports zero findings across 120 files |
| RISK-019 | The isolated P0 Foundry deployment's minimal capacity (`GlobalStandard`, capacity 1, ≈1,000 tokens/60s) cannot admit a single agent-mediated call once the ~4,000-token versioned instructions are included, so live evaluation cannot run at this capacity regardless of retry cadence | Neo | High | REQ-AGT-004, work package WP-05 | Root-caused via a direct (non-agent) diagnostic call that succeeded trivially, isolating the failure to the agent-mediated code path; see `docs/evidence/2026-08-13-foundry-agent-provisioning.md` | Resolved — capacity raised to 10 under explicit human authorization; verified via `az` at `request: 10/60s`, `token: 10000/60s`; all 7 bounded live evaluation cases then ran and passed, see `docs/evidence/2026-08-13-foundry-live-evaluation.md` |
| RISK-020 | The preview direct connected-agent path may not preserve the repository's structured request/response contract, identity/role handoff envelope, or expected interactive behavior in the target Copilot Studio tenant | Trinity | High | REQ-SCOPE-001, REQ-WF-001, REQ-WF-003, REQ-SAFE-005, WP-04 | Keep the local simulation boundary; author and test explicit request/response and identity adaptation; run deterministic validation before rendering or approval; fail closed if the contracts cannot be preserved | Open — connected-tenant validation **NOT RUN**. Repository controls resolve BLOCKER-002 locally, and issue #6 evidence covers the Foundry agent, but neither proves the live Copilot Studio connection |

## Review

Risks are reviewed at each integration checkpoint in
`docs/plan/p0-execution-plan.md`. A risk moves to `Mitigated` only when a
validation command produces evidence, never on assertion.

Last reviewed 2026-08-12 at the WP-09 integration checkpoint. RISK-006,
RISK-010, RISK-011, and RISK-012 moved to `Mitigated` against the recorded run
in `docs/evidence/2026-08-12-integration-run.md`. RISK-009 moved to
`Partially mitigated`. RISK-017 and RISK-018 were raised by this integration.
At that checkpoint BLOCKER-001 through BLOCKER-004 remained open; no live
Copilot Studio or Foundry work had been performed or claimed.

Updated 2026-08-13 for issue #6 (WP-05, BLOCKER-003). An isolated Foundry
project and the single Prompt Agent were provisioned and verified with no
tools attached — see `docs/evidence/2026-08-13-foundry-agent-provisioning.md`.
BLOCKER-003 was initially left open because live behavioral evaluation could
not run at the originally authorized deployment capacity. RISK-019 was raised
to record this.

Updated again 2026-08-13 (same day, follow-on work): a human explicitly
authorized raising the deployment's capacity from `1` to `10`; the bounded
live evaluation suite then ran and all 7 cases passed. BLOCKER-003 and
RISK-019 both moved to **Resolved** against
`docs/evidence/2026-08-13-foundry-live-evaluation.md`.

Updated again 2026-08-13 for issue #4: ADR-20260813-011 resolves BLOCKER-001's
path-selection decision with the documented direct Microsoft Foundry
connected-agent path. Power Automate is not the target intermediary. RISK-020
records the remaining live Copilot Studio validation gap. Direct
connected-agent validation is **NOT RUN**; BLOCKER-004 remains open, and no
live user identity propagation is claimed.

Updated again 2026-08-13 for issue #5 / merged PR #8: BLOCKER-002 is
**resolved for repository identity and authorization controls**. The repository
now enforces the explicit identity handoff, authorized roles, fresh same-actor
context confirmation, human-only approval, and audit redaction with executable
tests. Connected-tenant identity/role sourcing and propagation remain **NOT
RUN** under RISK-020; repository validation is not live connected-system
validation.
