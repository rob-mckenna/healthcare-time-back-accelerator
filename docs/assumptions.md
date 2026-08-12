# Assumptions

Owner: Trinity. Raised at the Design Review on 2026-08-12 and consolidated under
a single identifier scheme.

An assumption is something the baseline depends on that has not been verified in
this environment. Each one names what breaks if it is wrong and who resolves it.
Nothing here is described as operational; where an assumption concerns Microsoft
product behaviour, it stays an assumption until evidence replaces it, per
`SQUAD_BOOTSTRAP.md` section 5.

## Scope and intent

| ID | Assumption | Owner | If wrong | Confidence |
|---|---|---|---|---|
| ASM-001 | P0 is a reusable prototype and solution pattern for demonstration and reuse, not a deployment to a care setting | Trinity | The entire safety posture would need re-basing against clinical governance | High |
| ASM-002 | No real patient, staff, or customer information enters this repository at any point | Morpheus | Every contract, fixture, and scan assumption is invalidated | High |
| ASM-003 | The audience for the demonstration includes clinical and executive stakeholders who will read `APPROVED-SIMULATED` and `ILLUSTRATIVE` labels literally | Switch | Labelling alone would be insufficient and narration would carry more of the burden | Medium |
| ASM-004 | Harborlight Children's Hospital is an invented example organization with no relationship to any real entity | Switch | The example pack would need replacing and the naming re-checked | High |
| ASM-005 | The shift-closeout scenario is representative enough of the Second Shift problem to carry the narrative | Switch | The vertical slice would still be technically valid but less persuasive | High |

## Platform and environment

| ID | Assumption | Owner | If wrong | Confidence |
|---|---|---|---|---|
| ASM-006 | A Copilot Studio environment and a Microsoft Foundry project are available to the team for P0 | Tank, Neo | The slice cannot be demonstrated end to end; the contracts and validation harness still stand | Medium |
| ASM-007 | The Copilot Studio experience can call the Foundry agent and receive a structured payload within an interactive timeout | Tank | See BLOCKER-001 in `docs/risks.md`; the proxy-flow option becomes mandatory | Low, unverified |
| ASM-008 | Directory role information can be made available to the authorization check in some supported form | Tank | See BLOCKER-002; a labelled synthetic role fixture is the fallback | Low, unverified |
| ASM-009 | The Foundry agent can be configured with external retrieval and knowledge augmentation disabled | Neo | See BLOCKER-003; the grounding check becomes the only control and prevention is lost | Medium, unverified |
| ASM-010 | Agent instructions can be maintained as versioned files in this repository and applied to the deployed agent | Neo | Reproducibility by instruction digest is lost and RISK-009 escalates | Medium |
| ASM-011 | Node.js 20 or later with npm is available wherever validation is run | Trinity | Validation cannot execute; no alternative runtime is provided | High |
| ASM-012 | Audit evidence in P0 is written to a simple local store, not to an enterprise logging platform | Morpheus | Retention, access control, and query behaviour would all need revisiting | High |

## Contracts and data

| ID | Assumption | Owner | If wrong | Confidence |
|---|---|---|---|---|
| ASM-013 | JSON Schema 2020-12 is consumable by every component that needs to validate a payload | Trinity | A translation of the contracts would be required per component, with drift risk | High |
| ASM-014 | The FHIR-shaped subset in the synthetic bundle is sufficient for a credible shift-closeout draft | Morpheus, Neo | The bundle expands, which is additive and does not change the contract shape | Medium |
| ASM-015 | The four output sections cover a realistic shift handoff without an advisory section | Neo, Switch | ADR-20260812-003 would be revisited, which requires explicit human sign-off | Medium |
| ASM-016 | Complete grounding is achievable for every section given the synthetic bundle, so a coverage ratio of `1` is a reachable state and not a permanent refusal | Neo | Generation would fail closed on every run and the bundle or the scope would need adjusting | High. Verified locally 2026-08-12: the local journey reached coverage `1` with 6 references resolving to bundle entries, and only a deliberately altered reference was refused |
| ASM-017 | An artifact digest over the canonical serialised draft is stable enough to bind an approval to it | Morpheus | Approvals could not be bound to a specific draft version and RISK-003 escalates | High. Verified locally 2026-08-12: `computeArtifactSha256` canonicalises nested keys and excludes the digest field, so the same draft yields the same digest before and after attachment, and an altered narrative yields a different one |
| ASM-018 | Opaque actor references can be issued stably per user outside the evidence record | Morpheus | Attribution would require a different mechanism; ADR-20260812-007 would be revisited | Medium |

## Process

| ID | Assumption | Owner | If wrong | Confidence |
|---|---|---|---|---|
| ASM-019 | Trinity is the sole integration owner and the only writer to `contracts/` for the duration of P0 | Trinity | Concurrent contract edits become possible and RISK-015 escalates | High |
| ASM-020 | Agents report with commands and actual results rather than descriptions of intent | Trinity | Completion cannot be accepted; `SQUAD_BOOTSTRAP.md` section 8 requires evidence | High |
| ASM-021 | `docs/risks.md` serves as the P0 blocker register until the governing charter defines its own codes | Trinity | Blocker identifiers diverge again across agents; see BLOCKER-004 | Medium, pending human confirmation |
| ASM-022 | Illustrative baseline durations in the Harborlight pack are invented figures used only to demonstrate the shape of the view | Switch, Morpheus | The figures would need sourcing, or the view would need to show structure with no numbers | High |

## Resolution

An assumption is closed by evidence, not by repetition. When one is verified, the
row moves to a statement of fact in the relevant ADR or convention document and
is removed from this file with the ADR named. When one is falsified, it becomes a
risk or a blocker in `docs/risks.md`.

Last reviewed 2026-08-12 at the WP-09 integration checkpoint. ASM-016 and ASM-017
were verified against the recorded run in
`docs/evidence/2026-08-12-integration-run.md` and now carry that evidence.
ASM-006 to ASM-009 are unchanged: no live Copilot Studio or Foundry environment
was reached in this integration, so nothing about live platform behaviour was
verified.
