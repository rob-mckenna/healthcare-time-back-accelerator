# Integration run evidence — 2026-08-12

Owner: Trinity, sole integration owner. Work package WP-09.
Governing charter: `SQUAD_BOOTSTRAP.md` (human-owned, read only).

This file records the commands run during the WP-09 integration and their actual
results. It is written from executed output, not from intent. The machine-readable
record of the journey itself is
[`2026-08-12-journey-run.json`](2026-08-12-journey-run.json), written by
`npm run demo -- --json`.

## Verdict

**The local synthetic shift-closeout vertical slice is complete and executable.**
All six milestones in [`../plan/p0-execution-plan.md`](../plan/p0-execution-plan.md)
passed in a single correlated run against the synthetic dataset.

**Live Microsoft platform work is not complete and is not claimed.** Generation runs
through the documented simulation boundary in
`src/orchestration/foundry-adapter.mjs`. BLOCKER-001, BLOCKER-002, and BLOCKER-003 in
[`../risks.md`](../risks.md) remain open. Live Foundry evaluation: **NOT RUN**.

## Environment

| Item | Value |
|---|---|
| Platform | Windows, PowerShell |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| Dependencies | `ajv` and `ajv-formats` only, already installed |
| Organization pack | `config/organizations/harborlight` |
| Synthetic dataset | `data/synthetic/bundles/SYN-BDL-PEDBDL01.json`, 9 entries |

## Commands and actual results

Every command below exits `0` unless stated otherwise.

| # | Command | Result |
|---|---|---|
| 1 | `npm run validate:contracts` | `48/48 contract checks passed` — 8 positive examples, 19 registered negative fixtures each refused for its recorded reason, 1 cross-field fixture, and 10 cross-field rules including the two new `illustrative-metrics-config-*` rules |
| 2 | `npm run validate:docs` | `18/18 documentation checks passed` — required documents, relative links, 13 prohibited claim phrases, `ILLUSTRATIVE` labelling, 10 ADRs complete and indexed, 51 requirement identifiers defined |
| 3 | `npm run scan:secrets` | `PASS no credential, connection string, or direct identifier found` — 125 files, 17013 lines, 11 rules, 0 documented allowances, 0 findings |
| 4 | `npm run test:fail-closed` | `Results: 38 passed, 0 failed of 38 checks` — all twelve codes, each mapped to a configured user-safe message |
| 5 | `npm run test:governance` | `31/31 governance checks passed` — validation order, PHI scan, approval binding, audit minimality, metric labelling |
| 6 | `npm run evaluate:digest` | `7/7 instruction digest checks passed` — `system.md` SHA-256 `f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96` matches `manifest.json` and all provenance examples |
| 7 | `npm run evaluate:grounding` | `18/18 grounding evaluation checks passed` against the local evaluation set; the script prints its own `[BLOCKER-003]` notice that the live Foundry endpoint is not available |
| 8 | `npm run test:unit` | `tests 120, pass 120, fail 0` across 9 test files, including wrong-patient, malformed-output, prompt-injection, unsupported-fact, approval-bypass, secret-exposure, and the end-to-end nurse journey test |
| 9 | `npm run demo` | `37/37 journey checks passed`, milestones M1 to M6 |
| 10 | `npm run verify` | All of the above in sequence, exit `0` (recorded 2026-08-12) |
| — | Live Foundry evaluation | **NOT RUN.** No credential, endpoint, or deployment configuration exists in this environment and no external retrieval evidence exists. BLOCKER-003 stays open. |

### Formatting and linting

The repository ships no formatter or linter configuration and no lint script. No
formatting or linting command exists to run; none was added, because adding one is
outside this integration's scope and would change files no work package accepted.
JSON well-formedness is enforced by `npm run validate:contracts`, and Markdown link
and content rules by `npm run validate:docs`.

## Adversarial and negative checks executed

| Case | Where | Result |
|---|---|---|
| Unauthenticated request | `npm run demo` M1, `npm run test:fail-closed` | Refused, `E-IDENTITY-MISSING`, configured message only |
| Unconfirmed patient or encounter | `npm run demo` M2 | Refused, `E-CONTEXT-UNCONFIRMED` |
| Wrong patient at approval | `npm run demo` M5, `tests/integration/wrong-patient.test.mjs` | Refused, `E-APPROVAL-WITHOUT-CONFIRMATION` |
| Malformed agent output | `tests/integration/malformed-output.test.mjs`, `npm run test:fail-closed` | Refused, `E-OUTPUT-SCHEMA-INVALID` |
| Prompt injection in revision instructions | `npm run demo` M5, `tests/security/prompt-injection.test.mjs` | Refused before the agent boundary, `E-SAFETY-FLAG` |
| Unsupported fact in a draft section | `npm run demo` M4, `tests/integration/unsupported-fact.test.mjs` | Refused, `E-GROUNDING-FAILURE` |
| Approval bypass attempt | `tests/integration/approval-bypass.test.mjs` | Refused; `lifecycleStatus` moves only through a validated approval event |
| Revision past the configured limit | `npm run demo` M5 | Refused, `E-REVISION-LIMIT-REACHED` |
| Reason text carrying a direct identifier | `npm run demo` M5 | Refused, `E-SAFETY-FLAG` |
| Altered artifact reusing an approval | `npm run demo` M5 | Digest differs, so the approval cannot be replayed |
| Credential and identifier patterns | `tests/security/secret-exposure.test.mjs` | 12 adversarial values still detected; 7 safe values produce no finding |

## Milestone results

From `docs/evidence/2026-08-12-journey-run.json`, a single execution of
`node scripts/run-local-journey.mjs`.

| ID | Milestone | Result |
|---|---|---|
| M1 | Authenticated nurse requests a draft | Pass — one correlation identifier per run, eight-character short reference, unauthenticated attempt refused |
| M2 | Nurse confirms synthetic patient and encounter | Pass — `SYN-PAT-` and `SYN-ENC-` identifiers confirmed, skipped confirmation refused |
| M3 | One simulated agent boundary produces a schema-valid draft | Pass — four sections, `DRAFT — HUMAN REVIEW REQUIRED`, `lifecycleStatus DRAFT`, nine safety assertions true, no recommendation surface, provenance matching the shipped instruction digest |
| M4 | Nurse inspects source references | Pass — 6 references resolved to bundle content across Encounter, Observation, Task, and CarePlan entries; an unresolvable reference refused |
| M5 | Nurse approves, rejects, or requests revision | Pass — all three decisions exercised; approval reconfirmed and bound to the artifact digest |
| M6 | Correlated approval and audit evidence, illustrative view | Pass — 22 total audit events emitted during the run (14 events from the primary correlated run, 5 from the rejection run, 3 from refused attempts), 3 successful decision events, no narrative content, every non-success outcome naming its code |

### Illustrative time-back view

Rendered from `illustrativeMetrics` in the Harborlight pack. Every figure is
labelled on the line that carries it.

| Row | Value |
|---|---|
| Baseline workflow duration | 24 min `[ILLUSTRATIVE]` |
| Assisted workflow duration | 9 min `[ILLUSTRATIVE]` |
| Time returned | 15 min `[ILLUSTRATIVE]` |
| Draft outcome | revised-before-approval `[ILLUSTRATIVE]` |
| Approval coverage | 1/2, 50 percent `[ILLUSTRATIVE]` |

These are sample figures from one synthetic scenario. They are not measured
results from any deployed system.

## Files changed in this integration

| Path | Change |
|---|---|
| `contracts/schemas/organization-config.schema.json` | Added the required `illustrativeMetrics` block: `metricLabel` pinned to `ILLUSTRATIVE`, bounded durations, and a `sampleBasisNote` that must itself carry the label |
| `config/organizations/harborlight/organization.json` | Added Harborlight `illustrativeMetrics` values: baseline 24, assisted 9, sample basis note |
| `contracts/examples/invalid/organization-config-illustrative-metrics-unlabelled.json` | New negative fixture: a pack describing the figures as measured is refused |
| `contracts/examples/invalid/organization-config-embedded-endpoint.json`, `-missing-disclaimer.json`, `-non-synthetic-data.json` | Added a valid `illustrativeMetrics` block so each fixture is still refused only for its recorded reason |
| `contracts/contract-index.json` | Registered the new fixture and the two new cross-field rules |
| `scripts/validate-contracts.mjs` | Added `illustrative-metrics-config-arithmetic` and `illustrative-metrics-config-matches-example` |
| `contracts/examples/shift-closeout-agent-output.example.json` and 5 invalid agent-output fixtures | Synchronised `provenance.agentInstructionSha256` to the validated instruction digest |
| `src/governance/metrics.mjs` | Removed the hardcoded baseline fallback; figures now come from the pack or the run fails closed with `E-CONFIG-MISSING`; added `sampleBasisNote` |
| `src/orchestration/output-validator.mjs` | Now delegates the four ordered validation steps to `src/governance/validate-payload.mjs` instead of carrying a second implementation |
| `src/orchestration/audit-adapter.mjs` | Now builds and writes through `src/governance/audit.mjs` |
| `src/orchestration/approval-orchestrator.mjs` | Decision reasons now go through `src/governance/phi-scan.mjs`; artifact digest is computed over a canonical serialization covering nested content and excluding the digest field itself |
| `src/orchestration/input-builder.mjs` | Revision instructions now go through `src/governance/phi-scan.mjs` before `revisionInstructionsSanitized` is set |
| `src/orchestration/shift-closeout-runner.mjs` | A bounded revision may continue under the correlation identifier it was minted with; supplying one outside a revision fails closed |
| `src/view/time-back-view.mjs` | New: builds, contract-validates, and renders the ILLUSTRATIVE time-back view; refuses an unlabelled metric |
| `src/view/draft-view.mjs` | New: draft, source-reference, and correlated evidence surfaces; refuses an artifact that lost its draft label and audit events carrying narrative |
| `scripts/run-local-journey.mjs` | New: the executable local journey, M1 to M6, with `--json` run evidence |
| `scripts/scan-secrets.mjs` | Exported the rule table, `scanLine`, and `scanRepository`; the command-line scan now runs only when the file is executed directly; one narrow carve-out for credential assignments whose value is a template interpolation |
| `tests/security/secret-exposure.test.mjs` | Added adversarial cases assembled at run time, so no credential-shaped literal sits on disk |
| `tests/integration/nurse-journey.test.mjs` | New: end-to-end journey test plus presentation-surface refusal tests |
| `package.json` | Corrected the stale description; added `test:unit`, `test:fail-closed`, `test:governance`, `evaluate:digest`, `evaluate:grounding`, `demo`, and `verify` |
| `.gitignore` | Ignore `tests/.artifacts/` |
| `docs/plan/p0-execution-plan.md` | Work package statuses, ownership note, milestone acceptance record, expanded validation command table |
| `docs/risks.md` | RISK-006, RISK-010, RISK-011, RISK-012 mitigated with evidence; RISK-009 partially mitigated; RISK-017 and RISK-018 raised; review note |
| `docs/traceability/requirements-matrix.md` | 36 rows moved to `Verified locally` with the command that verified them |
| `docs/governance/illustrative-metrics.md` | Documented the `illustrativeMetrics` configuration contract |
| `docs/workflow/experience-flow.md` | Documented the governance wiring and the correlation continuation rule |
| `contracts/README.md`, `config/README.md` | Documented `illustrativeMetrics` |
| `README.md`, `docs/README.md` | Demonstration command, repository structure, validation commands, blocker statement |
| `docs/architecture/decisions/ADR-*.md` | Validation evidence fields updated to the observed results |

No file under `SQUAD_BOOTSTRAP.md` or `.squad/agents/*/history.md` was modified by
this integration except this owner's own history entry. Nothing was committed.

## Blockers and residual risks

| ID | State after this integration |
|---|---|
| BLOCKER-001 | Open, unchanged. Copilot Studio to Foundry invocation model unverified. |
| BLOCKER-002 | Open, unchanged. Role-claim availability unverified; the authorization code path is real and exercised against a synthetic role. |
| BLOCKER-003 | Open, unchanged. No live Foundry evaluation was run and no external retrieval evidence exists. |
| BLOCKER-004 | Open, unchanged. The charter is truncated; this repository's `docs/risks.md` remains the blocker register. |
| RISK-009 | Partially mitigated. Digest reproducibility proven locally; console drift cannot be excluded until deployment binding is verified. |
| RISK-017 | New. The simulated generation boundary must be stated aloud in every demonstration. |
| RISK-018 | New. The secret-scan carve-out must not be widened; twelve adversarial cases guard it. |

## Next executable task

Answer BLOCKER-003 with the Foundry deployment configuration showing external
retrieval and knowledge augmentation disabled. That single answer unblocks WP-05,
converts `npm run evaluate:grounding` from a local evaluation into a live one, and
is the only remaining gate on demonstrating generated content from a live agent.
