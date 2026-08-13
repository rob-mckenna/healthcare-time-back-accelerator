# Risks

Owner: Trinity. Raised at the Design Review on 2026-08-12 by Switch, Tank, Neo,
and Morpheus, consolidated under a single identifier scheme.

Severity is the impact if the risk is realised during a P0 demonstration or
review. `Blocker` means work stops for the affected scope until a human decides.

## Open blockers requiring a human decision

These are the items where the accepted baseline cannot proceed to a working
implementation without a decision or a verification that Trinity cannot make.

### BLOCKER-001 — Copilot Studio to Foundry invocation model is unverified

| | |
|---|---|
| Raised by | Tank |
| Severity | Blocker |
| Affects | REQ-SCOPE-001, REQ-SCOPE-002, REQ-AGT-001, work packages WP-04 and WP-05 |
| Blocks | Experience-to-agent binding only. Contracts, synthetic data, governance, and narrative continue. |

**Evidence.** The charter requires one Copilot Studio experience calling one
Foundry Shift Closeout Agent and returning a structured payload synchronously
enough for a nurse to review in one sitting. Neither the exact invocation
mechanism nor its timeout and payload-size behaviour has been verified in this
environment. The charter prohibits representing unverified product behaviour as
operational, so this cannot be assumed.

**Safe options.**

1. Invoke through a Power Automate flow acting as a proxy, giving explicit
   control over request shaping, timeout, retry, and fail-closed mapping.
2. Invoke directly from the Copilot Studio topic if a supported direct action
   exists and is verified in the target tenant.
3. Defer the binding and demonstrate the agent through the validation harness
   alone, marking the experience layer `FUTURE`.

**Recommendation.** Option 1. It is the most likely to be supported, it puts the
fail-closed mapping in a component the team controls, and it does not weaken any
safety invariant.

**Exact human decision required.** "Approve the Power Automate proxy flow as the
Copilot Studio to Foundry invocation path for P0, and confirm a tenant and
environment where it can be verified." If the answer is no, name the direct
mechanism to use instead.

### BLOCKER-002 — Role claims as Copilot Studio topic variables are unverified

| | |
|---|---|
| Raised by | Tank |
| Severity | Blocker |
| Affects | REQ-WF-001, REQ-APPR-001, REQ-APPR-002, work package WP-04 |
| Blocks | Authorization enforcement in the experience layer. |

**Evidence.** `REQ-WF-001` requires an authenticated user in an authorized role,
and the approval gate requires `roleCode` checked against
`personas.authorizedRoleCodes`. Whether directory role claims are available to a
Copilot Studio topic in the target tenant, and in what shape, is not verified.
Without it, the experience layer can authenticate but cannot authorize, and the
approval gate degrades to "any signed-in user".

**Safe options.**

1. Verify claim availability in the target tenant and bind `roleCode` from the
   claim.
2. Resolve the role in the proxy flow from a directory lookup, keyed by the
   signed-in user, and pass it to the topic as a validated value.
3. Use a synthetic role fixture for P0, clearly labelled, with the authorization
   check implemented and exercised against the fixture.

**Recommendation.** Option 2 if BLOCKER-001 resolves to the proxy flow, because
the lookup lands in a component the team controls. Option 3 is acceptable only if
the demonstration explicitly states that the role is a fixture, and the
authorization code path is real.

**Exact human decision required.** "Confirm whether directory role claims can be
made available to the Copilot Studio topic in the target tenant. If not, approve
resolving `roleCode` in the proxy flow, or approve a labelled synthetic role
fixture for P0."

### BLOCKER-003 — Foundry external retrieval default must be verified and disabled

| | |
|---|---|
| Raised by | Neo |
| Severity | Blocker |
| Affects | REQ-SAFE-002, REQ-AGT-004, work package WP-05 |
| Blocks | Any demonstration of generated content. |
| Status (2026-08-13) | **Partially answered, still open.** Tool/retrieval configuration verified. Live behavioral evaluation blocked by deployment capacity — see below. |

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

**However, live behavioral evaluation could not be run.** Every agent-mediated
invocation attempt (6 total, including diagnostics) returned HTTP 429
`rate_limit_exceeded`. A direct, non-agent model call succeeded trivially
(10 total tokens), proving the model deployment itself is healthy. The
deployment's configured rate limits are `request: 1/60s` and `token: 1000/60s`
— but the agent's stored system instructions alone are approximately 4,000
tokens, so every agent-mediated call is rejected regardless of the caller's
own input size or requested output length. This is a structural capacity
mismatch, not a transient burst limit; waiting does not resolve it. Full
diagnosis: `docs/evidence/2026-08-13-foundry-agent-provisioning.md`.

Because no live output was produced, none was validated, and the smoke
invocation plus the bounded live evaluation suite required by WP-05 (valid
structured draft, source grounding, unsupported-fact refusal,
prompt-injection refusal, prohibited-clinical-recommendation refusal,
draft/safety constants, malformed/schema output handling) did not run.
BLOCKER-003 is **not** resolved.

**Safe options.**

1. Verify the agent deployment configuration, disable every retrieval and
   knowledge-augmentation feature, and record the verified configuration as
   evidence before any demonstration. — **Done for the tool/retrieval half; see
   the 2026-08-13 update above.**
2. Keep the external grounding check as the compensating control and accept that
   a violation is detected after generation rather than prevented.
3. **New.** Approve a capacity increase for the `gpt-4.1-mini` `GlobalStandard`
   deployment (a capacity supporting roughly 6,000–8,000+ TPM would
   comfortably admit the ~4,000-token instructions plus a typical input bundle
   and output) so the live behavioral evaluation suite can actually run.
   Without this, live evaluation cannot proceed at any retry cadence.

**Recommendation.** Option 1 is complete. Option 3 is required to finish the
live-evaluation half of WP-05; option 2 remains as defence in depth regardless.

**Exact human decision required.** "Approve a capacity increase for the
`gpt-4.1-mini` deployment (or accept that live behavioral evaluation cannot run
at capacity 1), so BLOCKER-003's live-evaluation requirement can be answered."
No demonstration of live-generated content proceeds until this is answered.

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
| RISK-009 | Agent instruction changes are made in a console, so a draft cannot be reproduced | Neo | Medium | REQ-AGT-002 | Instructions live as versioned repository files; `agentInstructionSha256` required in provenance; `npm run evaluate:digest` recomputes the digest from the instruction content | Partially mitigated — the local run proved provenance carries the shipped digest; console drift cannot be excluded until the deployment binding under BLOCKER-003 is verified |
| RISK-010 | The revision loop runs unbounded, producing cost and confusing evidence | Tank | Medium | REQ-WF-006 | `operations.maxRevisions` in the organization pack; `E-REVISION-LIMIT-REACHED` | Mitigated — the limit refusal was exercised in the 2026-08-12 local run and in `npm run test:fail-closed` |
| RISK-011 | Audit write failure is swallowed and the run continues without evidence | Morpheus | Medium | REQ-AUD-003 | `E-AUDIT-WRITE-FAILURE` is an explicit fail-closed code, not a logged warning; `src/orchestration/audit-adapter.mjs` writes through `src/governance/audit.mjs` and converts any sink failure into that code | Mitigated — two audit write-failure cases pass in `npm run test:fail-closed` |
| RISK-012 | Error messages leak endpoints, payload fragments, or stack traces to the user | Tank | Medium | REQ-WF-007 | `safetyCopy.errorMessageOverrides` supplies every user-facing message; raw exceptions never rendered | Mitigated — all twelve codes map to configured messages in `npm run test:fail-closed`, and the local run showed only the configured text on refusal |
| RISK-013 | Synthetic identifiers are mistaken for real ones in a screenshot or export | Morpheus | Low | REQ-DATA-002 | Mandatory `SYN-` prefixes and a direct-identifier denylist; two negative fixtures | Mitigated at baseline |
| RISK-014 | Scope expands during implementation because a stub looks easy to add | Trinity | Medium | REQ-SCOPE-008 | ADR-20260812-010 prohibits stubs for deferred systems; Trinity is the sole integration owner | Ongoing |
| RISK-015 | Two agents edit the same file and a safety constraint is lost in a merge | Trinity | Medium | REQ-VAL-004 | Non-overlapping file ownership in `docs/plan/p0-execution-plan.md`; `contracts/` is Trinity-only | Ongoing |
| RISK-016 | Node, npm, or AJV availability differs on another machine and validation cannot run | Trinity | Low | REQ-VAL-001 | Single dev dependency set, lockfile committed, no global tooling required | Mitigated at baseline |
| RISK-017 | The simulated generation boundary is mistaken for a live Foundry agent in a demonstration | Trinity | High | REQ-SAFE-006, REQ-SCOPE-002 | `src/orchestration/foundry-adapter.mjs` exports `IS_SIMULATION_BOUNDARY` and a label naming BLOCKER-001 and BLOCKER-003; the local journey prints the boundary label before any draft and records it in the run evidence; `tests/integration/nurse-journey.test.mjs` asserts the run record says the live evaluation was not run | Mitigated at the artifact level; the spoken demonstration must still state it, per `docs/demo/talk-track.md` |
| RISK-018 | A narrow secret-scan carve-out is widened until a committed credential passes | Trinity | Medium | REQ-VAL-003 | The carve-out applies to one rule only, fires only when the matched value contains a template interpolation, and leaves literal-value detection unchanged; `tests/security/secret-exposure.test.mjs` asserts twelve credential-shaped and identifier-shaped values still fire and that a literal key on a line that also contains an interpolation is still caught | Mitigated — 10 of 10 secret-exposure tests pass and `npm run scan:secrets` reports zero findings across 120 files |
| RISK-019 | The isolated P0 Foundry deployment's minimal capacity (`GlobalStandard`, capacity 1, ≈1,000 tokens/60s) cannot admit a single agent-mediated call once the ~4,000-token versioned instructions are included, so live evaluation cannot run at this capacity regardless of retry cadence | Neo | High | REQ-AGT-004, work package WP-05 | Root-caused via a direct (non-agent) diagnostic call that succeeded trivially, isolating the failure to the agent-mediated code path; see `docs/evidence/2026-08-13-foundry-agent-provisioning.md` | Open — requires a human decision to approve a capacity increase or accept that live evaluation cannot run; see BLOCKER-003 |

## Review

Risks are reviewed at each integration checkpoint in
`docs/plan/p0-execution-plan.md`. A risk moves to `Mitigated` only when a
validation command produces evidence, never on assertion.

Last reviewed 2026-08-12 at the WP-09 integration checkpoint. RISK-006,
RISK-010, RISK-011, and RISK-012 moved to `Mitigated` against the recorded run
in `docs/evidence/2026-08-12-integration-run.md`. RISK-009 moved to
`Partially mitigated`. RISK-017 and RISK-018 were raised by this integration.
BLOCKER-001, BLOCKER-002, BLOCKER-003, and BLOCKER-004 remain open and unchanged;
no live Copilot Studio or Foundry work was performed or claimed.

Updated 2026-08-13 for issue #6 (WP-05, BLOCKER-003). An isolated Foundry
project and the single Prompt Agent were provisioned and verified with no
tools attached — see `docs/evidence/2026-08-13-foundry-agent-provisioning.md`.
BLOCKER-003 remains open: live behavioral evaluation could not run because the
authorized deployment capacity cannot admit a single agent-mediated call.
RISK-019 was raised to record this. BLOCKER-001, BLOCKER-002, and BLOCKER-004
remain open and unchanged; BLOCKER-002 is not claimed resolved and no user
identity propagation is claimed.
