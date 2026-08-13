# P0 execution plan

Owner: Trinity, sole integration owner. Baseline accepted 2026-08-12 at the
Design Review with Switch, Tank, Neo, and Morpheus.

Scope is locked to Option A in `SQUAD_BOOTSTRAP.md` section 3: one Copilot Studio
care-team experience, one Foundry Shift Closeout Agent, one synthetic FHIR-shaped
dataset, one shift-closeout workflow, one human approval path, one minimal audit
event, and one simple illustrative time-back view. Anything outside that list is
`FUTURE` and prose-only, per ADR-20260812-010.

Requirement identifiers are defined in `docs/traceability/requirements-matrix.md`.

## Rules of engagement

1. **Single integration owner.** Trinity integrates. No agent merges another
   agent's work.
2. **No concurrent edits.** Every path in the ownership map below has exactly one
   owner. An agent that needs a change in a path it does not own raises a change
   request to Trinity and does not edit it.
3. **`contracts/` is Trinity-only.** A safety constraint must never be relaxed as
   a side effect of unblocking a task.
4. **Evidence, not assertion.** A work package is accepted when its validation
   command has been run and its actual output recorded, per
   `SQUAD_BOOTSTRAP.md` section 8.
5. **Fail closed on ambiguity.** If a work package would require relaxing a
   synthetic-only, draft-only, human-approval, fail-closed, or
   no-clinical-recommendation rule, the agent stops that package and records a
   blocker in `docs/risks.md` with impact, evidence, safe options,
   recommendation, and the exact human decision required.
6. **No stubs for deferred systems.** See ADR-20260812-010.

## File ownership map

Exclusive, non-overlapping. Paths not listed are unowned and require a Trinity
decision before creation.

| Owner | Paths |
|---|---|
| Trinity | `contracts/**`, `config/**`, `docs/architecture/**`, `docs/traceability/**`, `docs/conventions/**`, `docs/plan/**`, `docs/evidence/**`, `docs/risks.md`, `docs/assumptions.md`, `package.json`, `package-lock.json`, `scripts/**`, `src/view/**`, `tests/integration/nurse-journey.test.mjs`, `.gitignore` |
| Morpheus | `data/synthetic/**`, `src/governance/**`, `docs/governance/**` |
| Neo | `agent/instructions/**`, `agent/evaluation/**`, `docs/agent/**` |
| Tank | `workflow/**`, `src/orchestration/**`, `docs/workflow/**` |
| Switch | `docs/narrative/**`, `docs/demo/**`, `README.md` |

Shared read access is unrestricted. Every agent reads `contracts/` and
`docs/conventions/` and implements against them.

During WP-09 the integration owner made surgical cross-scope edits inside
`src/orchestration/**`, `src/governance/**`, `agent/instructions/**` examples,
`tests/**`, and `README.md` to wire the packages together. Each such edit is
listed in `docs/evidence/2026-08-12-integration-run.md` so the owning agent can
review exactly what changed in its scope.

## Work packages

### WP-00 — Architecture baseline

| | |
|---|---|
| Owner | Trinity |
| Depends on | Nothing |
| Requirements | REQ-CFG-001 to 005, REQ-DATA-001 to 004, REQ-AGT-001 to 005, REQ-APPR-001 to 003, REQ-AUD-001 to 003, REQ-MET-001 to 002, REQ-SAFE-001 to 006, REQ-VAL-001 to 004, REQ-SCOPE-008 |
| Target files | `contracts/**`, `config/**`, `docs/**`, `package.json`, `scripts/**` |
| Status | **Complete** |

**Acceptance criteria.** The eight shared contracts required by
`SQUAD_BOOTSTRAP.md` section 8 exist as JSON Schema 2020-12, alongside a
source-reference contract and a shared definitions module, each with
valid examples and negative fixtures; ten ADRs accepted; requirements matrix,
risks, assumptions, and this plan exist; Harborlight example pack validates in
place with environment-value separation and no credentials; validation tooling
runs from a clean checkout.

**Validation.** `npm run validate`

### WP-01 — Synthetic dataset

| | |
|---|---|
| Owner | Morpheus |
| Depends on | WP-00 |
| Requirements | REQ-DATA-001, REQ-DATA-002, REQ-DATA-003, REQ-SCOPE-003 |
| Target files | `data/synthetic/patients/*.json`, `data/synthetic/encounters/*.json`, `data/synthetic/bundles/*.json`, `docs/governance/synthetic-data.md` |
| Status | **Complete** — accepted 2026-08-12, evidence in `docs/evidence/2026-08-12-integration-run.md` |

**Scope.** One pediatric encounter sufficient for a credible shift closeout: a
patient, an encounter, observations, care-plan entries, and outstanding items.
Enough variety for two or three distinct open items, no more.

**Acceptance criteria.**
- Every patient and encounter validates against
  `contracts/schemas/synthetic-context.schema.json`.
- Every bundle validates against
  `contracts/schemas/synthetic-source-bundle.schema.json`.
- All identifiers carry `SYN-PAT-`, `SYN-ENC-`, or `SYN-BDL-` prefixes.
- No direct identifier fields present; `syntheticOnly` is `true` throughout.
- Every content element the agent may cite has a stable reference target, so
  `source-reference-resolution` can succeed.
- `npm run scan:secrets` finds nothing.

**Validation.**
```
node scripts/validate-contracts.mjs
node scripts/scan-secrets.mjs
```

### WP-02 — Narrative and demonstration script

| | |
|---|---|
| Owner | Switch |
| Depends on | WP-00 |
| Requirements | REQ-STORY-001, REQ-STORY-002, REQ-STORY-003, REQ-SCOPE-008 |
| Target files | `docs/narrative/storybrand.md`, `docs/demo/demonstration-script.md`, `docs/demo/talk-track.md` |
| Status | **Complete** — accepted 2026-08-12, evidence in `docs/evidence/2026-08-12-integration-run.md` |

**Scope.** The StoryBrand frame and the words spoken over the six-step journey.
Care team as hero, the Second Shift as the problem, Microsoft capabilities as
guide, this bounded plan, and time back with trust as the outcome.

**Acceptance criteria.**
- All five StoryBrand elements are explicit and traceable to REQ-STORY-001.
- The script narrates outcomes, not a product feature tour.
- Every deferred capability mentioned is marked `FUTURE` with an explicit
  statement that it is not implemented.
- Every time-back figure quoted appears alongside `ILLUSTRATIVE`.
- No phrase from `docs/conventions/prohibited-claims.json` appears.
- The script includes the moment where the draft is refused, so fail-closed
  behaviour is demonstrated rather than described.

**Validation.** `node scripts/validate-docs.mjs`

### WP-03 — Agent instruction pack

| | |
|---|---|
| Owner | Neo |
| Depends on | WP-00, WP-01 |
| Requirements | REQ-AGT-002, REQ-AGT-003, REQ-AGT-004, REQ-SAFE-002 |
| Target files | `agent/instructions/shift-closeout/v1.0.0/system.md`, `agent/instructions/shift-closeout/v1.0.0/output-contract.md`, `agent/instructions/shift-closeout/v1.0.0/manifest.json`, `docs/agent/instruction-versioning.md` |
| Status | **Complete** — accepted 2026-08-12, digest `f9020da9…` verified against provenance in the local run |

**Scope.** Versioned, file-based instructions producing output that satisfies
`contracts/schemas/shift-closeout-agent-output.schema.json` on the first attempt
for the WP-01 dataset.

**Acceptance criteria.**
- Instructions live as repository files under a semantic version directory.
- `manifest.json` records the version and the SHA-256 digest over the instruction
  content, matching what provenance will carry.
- Instructions state `camelCase` field naming explicitly (ADR-20260812-005).
- Instructions state that no recommendation, assessment, or plan may be produced
  and that every section requires source references (ADR-20260812-003).
- Instructions state the correlation identifier is echoed unchanged.
- A generated sample output validates against the output contract and passes the
  cross-field rules.

**Validation.**
```
node scripts/validate-contracts.mjs
node agent/evaluation/check-instruction-digest.mjs
```

### WP-04 — Care-team experience and orchestration

| | |
|---|---|
| Owner | Tank |
| Depends on | WP-00, WP-01; live binding depends on BLOCKER-002 and RISK-020 validation |
| Requirements | REQ-WF-001 to 007, REQ-SCOPE-001, REQ-SCOPE-004, REQ-SAFE-004, REQ-AUD-001, REQ-AUD-004 |
| Target files | `workflow/copilot-studio/shift-closeout-topic.md`, `workflow/copilot-studio/*.yaml`, `src/orchestration/**`, `docs/workflow/fail-closed-catalog.md`, `docs/workflow/experience-flow.md` |
| Status | **Complete locally; target path decided; direct validation NOT RUN** — orchestration runs end to end against the synthetic dataset. ADR-20260813-011 resolves BLOCKER-001 with the direct Foundry connected-agent path. Target-tenant request/response adaptation remains untested under RISK-020, and role-claim authorization remains blocked by BLOCKER-002. |

**Scope.** The single shift-closeout experience: authenticated request, patient
and encounter confirmation, draft presentation, source-reference inspection,
decision capture, bounded revision, and the correlated evidence view.

**Acceptance criteria.**
- Mints exactly one correlation identifier per run per
  `docs/conventions/correlation-id.md`, and displays the eight-character short
  reference.
- Refuses to request generation without `preGenerationConfirmedAt`.
- Renders `draftStatus` and the configured disclaimer on every surface that shows
  the artifact, including any exported or copied text.
- Presents source references and lets the user open the referenced synthetic
  content.
- Offers approve, reject, and request-revision, and refuses to submit a rejection
  or revision without a reason.
- Enforces `operations.maxRevisions` and emits `E-REVISION-LIMIT-REACHED`.
- Every one of the twelve fail-closed codes maps to a configured user-safe
  message from `safetyCopy.errorMessageOverrides`. No raw exception, endpoint,
  stack trace, or payload fragment is ever rendered.
- Reads every organization-specific string from the pack. No name, unit, role
  label, or figure is hardcoded.

**Validation.**
```
node scripts/validate-contracts.mjs
node src/orchestration/test/run-fail-closed-catalog.mjs
node scripts/validate-docs.mjs
```

**Outstanding sub-tasks.** Direct connected-agent validation is **NOT RUN**
under RISK-020. Role-claim authorization waits on BLOCKER-002 in
`docs/risks.md`. All other sub-tasks proceed.

### WP-05 — Foundry agent deployment and binding

| | |
|---|---|
| Owner | Neo |
| Depends on | WP-03, WP-04; BLOCKER-003 resolved |
| Requirements | REQ-SCOPE-002, REQ-AGT-001, REQ-AGT-005, REQ-SAFE-002 |
| Target files | `agent/evaluation/**`, `agent/deployment/**`, `docs/agent/deployment.md`, `docs/agent/grounding-evaluation.md` |
| Status | **Complete for Foundry-agent deployment and live evaluation.** Issue #6 provisioned the isolated `shift-closeout-agent`, verified zero tools and the instruction digest, and completed the bounded live suite with 7/7 passing after a human-authorized capacity increase. See `docs/evidence/2026-08-13-foundry-agent-provisioning.md` and `docs/evidence/2026-08-13-foundry-live-evaluation.md`. This does not constitute direct Copilot Studio connected-agent validation; the local slice still uses `src/orchestration/foundry-adapter.mjs`. |

**Acceptance criteria.**
- Deployment configuration evidence shows external retrieval and knowledge
  augmentation disabled, satisfying BLOCKER-003. — **Met 2026-08-13**.
- The agent accepts an input validating against the input contract and returns
  output validating against the output contract. — **Met live 2026-08-13**.
- Provenance carries the correlation identifier unchanged plus the instruction
  version and digest from WP-03. — **Met live 2026-08-13**.
- An evaluation set over the WP-01 dataset shows complete grounding, and a
  deliberately unsupported request is refused with `E-GROUNDING-FAILURE`. —
  **Met locally and live 2026-08-13**.
- No configuration value is committed; endpoints resolve through
  `environmentBindings`. — Met; the project endpoint and agent ID are resolved
  only via the local, gitignored azd environment state.

**Validation.**
```
node agent/evaluation/run-grounding-evaluation.mjs
node scripts/validate-contracts.mjs
node scripts/scan-secrets.mjs
```

### WP-06 — Approval, audit, and shared validation utility

| | |
|---|---|
| Owner | Morpheus |
| Depends on | WP-00; consumed by WP-04 and WP-05 |
| Requirements | REQ-APPR-001 to 003, REQ-AUD-001 to 003, REQ-SAFE-005, REQ-VAL-003 |
| Target files | `src/governance/validate-payload.mjs`, `src/governance/phi-scan.mjs`, `src/governance/approval.mjs`, `src/governance/audit.mjs`, `docs/governance/approval-and-audit.md` |
| Status | **Complete** — accepted 2026-08-12; the orchestration layer now calls these modules directly rather than carrying its own copies |

**Scope.** The single deterministic validation layer described in
ADR-20260812-008, plus approval and audit event emission. Used by both the
generation path and the approval path so the two cannot diverge.

**Acceptance criteria.**
- Validation runs in the fixed order: output schema, safety assertions, grounding
  resolution, correlation echo. Each failure emits its specific code.
- `phi-scan.mjs` is the single implementation behind `decisionReasonScanned` and
  `revisionInstructionsSanitized`. Neither marker can be set without it running.
- An approval binds to `artifactSha256` and `reconfirmedContext`, and refuses if
  the re-confirmed patient or encounter differs from the request.
- Every terminal outcome emits exactly one audit event; every `FAILED` or
  `BLOCKED` outcome carries a `failClosedCode`.
- An audit write failure emits `E-AUDIT-WRITE-FAILURE` and stops the run. It is
  never logged and swallowed.
- No display name, email address, or free-text identity value is written to any
  approval or audit event.

**Validation.**
```
node scripts/validate-contracts.mjs
node src/governance/test/run-governance-checks.mjs
node scripts/scan-secrets.mjs
```

### WP-07 — Illustrative time-back view

| | |
|---|---|
| Owner | Morpheus, rendered by Tank under WP-04 |
| Depends on | WP-06 |
| Requirements | REQ-MET-001, REQ-MET-002, REQ-SCOPE-007 |
| Target files | `src/governance/metrics.mjs`, `src/view/time-back-view.mjs`, `docs/governance/illustrative-metrics.md` |
| Status | **Complete** — accepted 2026-08-12; figures come from `illustrativeMetrics` in the organization pack and the view refuses to render an unlabelled metric |

**Acceptance criteria.**
- Emits baseline duration, assisted duration, time returned, draft outcome, and
  approval coverage, validating against
  `contracts/schemas/illustrative-metric.schema.json`.
- Every value carries `metricLabel: "ILLUSTRATIVE"`, `illustrative: true`,
  `notForClinicalUse: true`, and the disclaimer text.
- Baseline figures come from the organization pack, never from code.
- Time returned equals baseline minus assisted; the `metric-arithmetic` rule
  passes.
- The view states plainly that the figures are illustrative and derived from a
  synthetic example scenario.

**Validation.**
```
node scripts/validate-contracts.mjs
node scripts/validate-docs.mjs
```

### WP-08 — Accelerator README and reuse guide

| | |
|---|---|
| Owner | Switch |
| Depends on | WP-02; final content after WP-04 to WP-07 |
| Requirements | REQ-CFG-005, REQ-STORY-001, REQ-STORY-003, REQ-SCOPE-008 |
| Target files | `README.md` |
| Status | **Complete** — accepted 2026-08-12 |

**Acceptance criteria.**
- States what this is, what it deliberately is not, and the safety boundaries in
  the first screen of content.
- Explains adding another organization by copying the example pack and supplying
  environment values, with no core logic change.
- Lists every validation command with its purpose.
- Contains no phrase from `docs/conventions/prohibited-claims.json` and marks
  every deferred capability `FUTURE`.

**Validation.** `node scripts/validate-docs.mjs`

### WP-09 — Integration and milestone acceptance

| | |
|---|---|
| Owner | Trinity |
| Depends on | WP-01 to WP-08 |
| Requirements | REQ-VAL-004 and every milestone below |
| Target files | `docs/plan/p0-execution-plan.md` acceptance record, `docs/risks.md`, `docs/evidence/**`, `scripts/run-local-journey.mjs`, `src/view/**`, `tests/integration/nurse-journey.test.mjs` |
| Status | **Complete for the local synthetic slice** — all six milestones passed in one run on 2026-08-12; live platform binding and evaluation remain blocked |

**Acceptance criteria.** All six milestones below demonstrated in one run against
the WP-01 dataset, with `npm run validate` passing and actual output recorded.

## Milestone acceptance for the nurse journey

The journey is accepted only when all six milestones pass in a single correlated
run. Partial passes are recorded as partial.

| ID | Milestone | Requirements | Accepted when |
|---|---|---|---|
| M1 | The nurse requests a shift-closeout draft | REQ-WF-001, REQ-SCOPE-001, REQ-AUD-001 | An authenticated user in an authorized role starts a run; exactly one correlation identifier is minted and the short reference is displayed; an unauthenticated or unauthorized attempt is refused with `E-IDENTITY-MISSING` and produces an audit event |
| M2 | The nurse confirms the synthetic patient and encounter | REQ-WF-002, REQ-SAFE-004, REQ-DATA-002 | The confirmation records `preGenerationConfirmedAt`; identifiers shown carry `SYN-` prefixes; skipping confirmation is refused with `E-CONTEXT-UNCONFIRMED` |
| M3 | The nurse receives a structured Foundry draft | REQ-SCOPE-002, REQ-AGT-003, REQ-AGT-005, REQ-SAFE-001, REQ-SAFE-002, REQ-WF-003 | The draft carries all four sections, `draftStatus` equal to `DRAFT — HUMAN REVIEW REQUIRED`, `lifecycleStatus` equal to `DRAFT`, and all nine safety assertions; it validates against the output contract before rendering; it contains no recommendation; provenance echoes the correlation identifier and names the instruction version and digest |
| M4 | The nurse inspects the source references | REQ-WF-004, REQ-AGT-004, REQ-DATA-004 | Every section exposes references resolving to the approved synthetic bundle; opening a reference shows the underlying synthetic content; an unsupported statement is refused with `E-GROUNDING-FAILURE` rather than shown |
| M5 | The nurse approves, rejects, or requests a revision | REQ-WF-005, REQ-WF-006, REQ-APPR-001, REQ-APPR-002, REQ-APPR-003, REQ-SAFE-004 | Each of the three decisions is exercised; approval requires `preApprovalConfirmedAt` matching the requested patient and encounter and binds to `artifactSha256`; rejection and revision require a reason; revision respects `operations.maxRevisions` and then emits `E-REVISION-LIMIT-REACHED`; the event carries `actorRef` and `roleCode` and no personal data; `lifecycleStatus` moves only via this event |
| M6 | The nurse inspects correlated approval and audit evidence | REQ-AUD-002, REQ-AUD-003, REQ-AUD-004, REQ-MET-001, REQ-MET-002 | A single correlation identifier retrieves request, generation, decision, and outcome events; every event validates against the audit contract and carries no narrative content; a fail-closed run in the same session shows its `failClosedCode`; the illustrative view renders with `ILLUSTRATIVE` on every value |

## Milestone acceptance record

Recorded 2026-08-12 by Trinity from a single execution of
`node scripts/run-local-journey.mjs` against `config/organizations/harborlight`
and `data/synthetic/bundles/SYN-BDL-PEDBDL01.json`. Full command output is in
`docs/evidence/2026-08-12-integration-run.md`.

| ID | Result | Evidence from the run |
|---|---|---|
| M1 | Pass | One correlation identifier minted per run, eight-character short reference displayed; an unauthenticated request refused with `E-IDENTITY-MISSING` and shown the configured message only |
| M2 | Pass | `preGenerationConfirmedAt` recorded; `SYN-PAT-` and `SYN-ENC-` identifiers displayed; a request without confirmation refused with `E-CONTEXT-UNCONFIRMED` |
| M3 | Pass | Four sections present, `draftStatus` and `lifecycleStatus` correct, nine safety assertions true, no recommendation surface, provenance echoing the correlation identifier and matching the shipped instruction digest |
| M4 | Pass | Six source references resolved to bundle content; an altered reference refused with `E-GROUNDING-FAILURE` |
| M5 | Pass | All three decisions exercised; approval reconfirmed and bound to `artifactSha256`; wrong-patient reconfirmation, reasonless revision, injected revision text, an identifier in a decision reason, and a revision past `operations.maxRevisions` all refused |
| M6 | Pass | One correlation identifier retrieved fourteen events across request, confirmation, generation, presentation, decision, and revision; no event carried narrative content; every non-success outcome named its code; the illustrative view rendered with `ILLUSTRATIVE` on every figure |

Generation ran through the documented simulation boundary in this 2026-08-12
record. Subsequent issue #6 evidence completed the live Foundry agent evaluation.
The direct Copilot Studio connected-agent binding remains **NOT RUN** under
RISK-020, and BLOCKER-002 remains open.

## Dependency order

```
WP-00  (complete)
  ├─ WP-01  Morpheus   synthetic dataset
  ├─ WP-02  Switch     narrative and script
  ├─ WP-06  Morpheus   validation utility, approval, audit
  └─ WP-03  Neo        agent instructions          (needs WP-01)
        ├─ WP-04  Tank    experience               (needs WP-01, WP-06)
        └─ WP-05  Neo     agent deployment         (needs WP-03, WP-04, BLOCKER-003)
              └─ WP-07  Morpheus  illustrative view (needs WP-06)
                    └─ WP-08  Switch  README
                          └─ WP-09  Trinity  integration and milestones
```

WP-01, WP-02, WP-03, and WP-06 start immediately and in parallel. No two of them
touch a shared path.

## Validation commands

Run from the repository root.

| Command | Purpose |
|---|---|
| `npm install` | Restore the single dev dependency set |
| `npm run validate:contracts` | Compile schemas, validate examples, assert negative fixtures are refused for their recorded reason, apply cross-field rules |
| `npm run validate:docs` | Assert required documents exist, relative links resolve, no prohibited claim appears, and time-back figures carry the `ILLUSTRATIVE` label |
| `npm run scan:secrets` | Scan every file eligible for commit (tracked plus untracked-and-not-gitignored, including `.squad/`, `.github/`, `.copilot/`) for credential, connection string, and direct identifier patterns |
| `npm run validate` | All three in sequence |
| `npm run test:fail-closed` | Exercise every fail-closed code end to end in the orchestration layer |
| `npm run test:governance` | Exercise validation order, PHI scan, approval binding, audit minimality, and metric labelling |
| `npm run evaluate:digest` | Assert the shipped instruction digest matches the instruction content |
| `npm run evaluate:grounding` | Run the local grounding evaluation set; live Foundry evidence is recorded separately under issue #6 |
| `npm run test:unit` | Run every test under `tests/`, including the wrong-patient, malformed-output, prompt-injection, unsupported-fact, approval-bypass, secret-exposure, and end-to-end journey tests |
| `npm run demo` | Execute the complete local synthetic nurse journey, M1 to M6, and print the draft, source references, decisions, correlated evidence, and illustrative view |
| `npm run verify` | Every command above in sequence; the gate for integration |

## Integration checkpoints

1. **After WP-01, WP-02, WP-03, WP-06.** Trinity runs `npm run validate`, reviews
   contract conformance, and updates risk status. No demonstration yet.
2. **After WP-04 and WP-05.** Trinity confirms BLOCKER-001 and BLOCKER-003 are
   resolved, records BLOCKER-002 and RISK-020 explicitly, and exercises M1 to M4.
3. **After WP-07 and WP-08.** Trinity exercises M5 and M6 and records the
   milestone acceptance.

At every checkpoint a work package is accepted only with its command output
recorded. Scaffolding, mocked results, and descriptions of intended behaviour are
not accepted, per `SQUAD_BOOTSTRAP.md` section 8.
