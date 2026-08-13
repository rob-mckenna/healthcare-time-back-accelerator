# Requirements traceability matrix

Governing charter: `SQUAD_BOOTSTRAP.md`. This matrix is the single list of P0
requirement identifiers. Every work item in `docs/plan/p0-execution-plan.md`,
every architecture decision, every contract, and every validation check cites
these identifiers.

Status values: `Baseline accepted` means the contract or decision that unblocks
the work is in place. `Planned` means implementation has not started.
`Verified locally` means the requirement was exercised end to end against the
synthetic dataset on a local run and the output was recorded in
`docs/evidence/2026-08-12-integration-run.md`. No item is marked complete
without executable validation evidence, and no item that depends on a live
Microsoft platform binding is marked verified.

## Scope lock

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-SCOPE-001 | One Copilot Studio care-team experience, no additional workflows | §3 | Tank | `docs/plan/p0-execution-plan.md` WP-04 | `npm run demo` exercises the single workflow locally | Verified locally; Copilot Studio binding blocked by BLOCKER-001 |
| REQ-SCOPE-002 | One Microsoft Foundry Shift Closeout Agent | §3 | Neo | `contracts/schemas/shift-closeout-agent-input.schema.json`, `contracts/schemas/shift-closeout-agent-output.schema.json` | `npm run validate:contracts` | Verified; exactly one Prompt Agent provisioned (no tools) 2026-08-13, and live behavioral verification passed 7/7 2026-08-13 after a human-authorized capacity increase — `docs/evidence/2026-08-13-foundry-agent-provisioning.md`, `docs/evidence/2026-08-13-foundry-live-evaluation.md`; BLOCKER-003 resolved |
| REQ-SCOPE-003 | One synthetic FHIR-shaped dataset | §3, §6 | Morpheus | `contracts/schemas/synthetic-source-bundle.schema.json` | `npm run validate:contracts` | Baseline accepted |
| REQ-SCOPE-004 | One shift-closeout workflow | §3 | Switch | `config/organizations/harborlight/organization.json` locks `primaryWorkflow` | `npm run validate:contracts` | Baseline accepted |
| REQ-SCOPE-005 | One human review and approval path | §3, §6 | Morpheus | `contracts/schemas/approval-event.schema.json` | `npm run demo` M5; `npm run test:governance` | Verified locally |
| REQ-SCOPE-006 | One minimal attributable audit event | §3, §6 | Morpheus | `contracts/schemas/audit-event.schema.json` | `npm run demo` M6; `npm run test:governance` | Verified locally |
| REQ-SCOPE-007 | One simple time-back view | §3, §6 | Morpheus | `contracts/schemas/illustrative-metric.schema.json` | `npm run demo` M6 | Verified locally |
| REQ-SCOPE-008 | Deferred capabilities appear only as `FUTURE` and never as operational | §3 | Trinity | `docs/architecture/decisions/ADR-20260812-010.md` | `npm run validate:docs` | Baseline accepted |

## Reusable configuration and tokens

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-CFG-001 | Machine-readable organization configuration schema | §4 | Trinity | `contracts/schemas/organization-config.schema.json` | `npm run validate:contracts` | Baseline accepted |
| REQ-CFG-002 | Harborlight example configuration | §4 | Trinity | `config/organizations/harborlight/organization.json` | `npm run validate:contracts`; `npm run demo` loads the pack | Verified locally |
| REQ-CFG-003 | Template, configuration, environment, and credential values stay separated | §4 | Trinity | `config/environments/.env.example`, `environmentBindings` block | `contracts/examples/invalid/organization-config-embedded-endpoint.json`, `npm run scan:secrets` | Baseline accepted |
| REQ-CFG-004 | Validation fails when a required configuration value is missing | §4 | Trinity | `contracts/examples/invalid/organization-config-missing-disclaimer.json` | `npm run validate:contracts` | Baseline accepted |
| REQ-CFG-005 | Adding another organization changes no core agent or workflow logic | §4 | Trinity | `config/README.md` | Review at integration | Baseline accepted |

## Synthetic data

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-DATA-001 | Synthetic only, no PHI, PII, or customer data | §5.3 | Morpheus | `syntheticOnly` and `synthetic` structural locks | `contracts/examples/invalid/organization-config-non-synthetic-data.json`, `npm run scan:secrets` | Baseline accepted |
| REQ-DATA-002 | Structural synthetic markers and a direct-identifier denylist | §5.3, §5.9 | Morpheus | `contracts/schemas/synthetic-context.schema.json` | `contracts/examples/invalid/synthetic-context-real-identifier.json`, `contracts/examples/invalid/synthetic-context-unprefixed-patient-id.json` | Baseline accepted |
| REQ-DATA-003 | Minimal FHIR resource set for the shift-closeout scenario | §6 | Morpheus | `contracts/schemas/synthetic-source-bundle.schema.json` | `npm run validate:contracts` | Baseline accepted |
| REQ-DATA-004 | Generation is refused unless the source bundle is approved | §5.4, §5.7 | Morpheus | `approvedForGeneration` gate | `contracts/examples/invalid/agent-input-unapproved-source-bundle.json`; `npm run test:fail-closed` | Verified locally |

## Shift Closeout Agent

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-AGT-001 | Agent input carries authenticated identity, confirmed context, approved source, scope, and versions | §6 | Neo | `contracts/schemas/shift-closeout-agent-input.schema.json` | `npm run validate:contracts` | Baseline accepted |
| REQ-AGT-002 | Agent instructions are versioned and pinned by digest so a draft is reproducible | §5.9, §6 | Neo | `provenance.agentInstructionVersion`, `provenance.agentInstructionSha256` | `npm run evaluate:digest`; `npm run demo` M3 digest match | Verified locally |
| REQ-AGT-003 | Structured output carries shift summary, handoff summary, open items, and follow-up items | §3 | Neo | `contracts/schemas/shift-closeout-agent-output.schema.json` | `rule scope-echo`; `npm run demo` M3 | Verified locally |
| REQ-AGT-004 | Every generated section carries source references that resolve to approved synthetic input | §3, §5.6 | Neo | `contracts/schemas/source-reference.schema.json` | `rule source-reference-resolution`; `npm run demo` M4; `npm run evaluate:grounding` | Verified locally (example set) and live: 7/7 bounded live evaluation cases passed 2026-08-13, including `source-grounding` (24/24 checks) — see `docs/agent/grounding-evaluation.md`, `docs/evidence/2026-08-13-foundry-live-evaluation.md`; BLOCKER-003 / RISK-019 resolved |
| REQ-AGT-005 | Output carries generation, correlation, and provenance identifiers | §3 | Neo | `provenance` block | `rule bundle-binding`; `npm run demo` M3 | Verified locally |

## Care-team experience

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-WF-001 | An authenticated user with an authorized role requests a shift-closeout draft | §2, §6 | Tank | `requester` block, `personas.authorizedRoleCodes` | `npm run demo` M1; `npm run test:fail-closed` | Verified locally |
| REQ-WF-002 | The user confirms the synthetic patient and encounter before generation | §5.8 | Tank | `context.preGenerationConfirmedAt` | `npm run demo` M2; `npm run test:fail-closed` | Verified locally |
| REQ-WF-003 | The draft is presented with the mandatory draft status and disclaimer visible | §3, §6 | Tank | `draftStatus`, `disclaimer` | `npm run demo` M3; `tests/integration/nurse-journey.test.mjs` | Verified locally |
| REQ-WF-004 | The user can inspect the source references behind the draft | §3, §6 | Tank | `sourceReferences` master list | `npm run demo` M4 | Verified locally |
| REQ-WF-005 | The user can approve, reject, or request a revision | §3, §6 | Tank | `decision` enum | `npm run demo` M5, all three decisions | Verified locally |
| REQ-WF-006 | The revision loop is bounded by configuration and fails closed at the limit | §6 | Tank | `operations.maxRevisions`, `E-REVISION-LIMIT-REACHED` | `npm run demo` M5 revision limit | Verified locally |
| REQ-WF-007 | Every exception fails closed with a user-safe message and no sensitive detail | §5.6, §6 | Tank | `failClosedCode` enum, `safetyCopy.errorMessageOverrides` | `npm run demo` M1; `npm run test:fail-closed` 38 checks | Verified locally |

## Human approval

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-APPR-001 | No artifact leaves `DRAFT` without an authenticated, authorized human event | §6 | Morpheus | `lifecycleStatus` const on agent output | `npm run demo` M5; `tests/integration/approval-bypass.test.mjs` | Verified locally |
| REQ-APPR-002 | Decision, reason handling, and revision chaining are attributable | §6 | Morpheus | `contracts/schemas/approval-event.schema.json` | `npm run demo` M5; `npm run test:governance` | Verified locally |
| REQ-APPR-003 | An approval binds to the exact artifact digest and re-confirmed context | §5.8, §5.9 | Morpheus | `artifact.artifactSha256`, `reconfirmedContext` | `npm run demo` M5; `tests/integration/wrong-patient.test.mjs` | Verified locally |

## Audit and traceability

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-AUD-001 | One correlation identifier spans request, generation, decision, and evidence | §6 | Trinity | `docs/conventions/correlation-id.md` | `rule correlation-propagation`; `npm run demo` M6 | Verified locally |
| REQ-AUD-002 | Audit evidence records identities, versions, sources, decisions, and outcomes without sensitive payloads | §5.9 | Morpheus | `contracts/schemas/audit-event.schema.json` | `npm run demo` M6; `npm run test:governance` | Verified locally |
| REQ-AUD-003 | Every fail-closed condition produces audit evidence naming the condition | §5.6 | Morpheus | `failClosedCode` conditional requirement | `npm run demo` M6; `npm run test:fail-closed` | Verified locally |
| REQ-AUD-004 | The user can inspect correlated approval and audit evidence for their run | §2 | Tank | Milestone M6 in the P0 plan | `npm run demo` M6 checks; `tests/integration/nurse-journey.test.mjs` | Verified locally |

## Illustrative measurement

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-MET-001 | Sample and composite figures carry the `ILLUSTRATIVE` label, provenance, and disclaimer on the value itself | §6 | Morpheus | `contracts/schemas/illustrative-metric.schema.json` | `npm run demo` M6; `npm run validate:contracts` | Verified locally |
| REQ-MET-002 | The simple view carries baseline duration, assisted duration, time returned, draft outcome, and approval coverage | §6 | Morpheus | `contracts/schemas/illustrative-metric.schema.json` | `rule metric-arithmetic`; `npm run demo` M6 | Verified locally |

## Safety invariants

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-SAFE-001 | Every generated artifact carries `DRAFT — HUMAN REVIEW REQUIRED` | §3 | Trinity | `common/definitions.schema.json#/$defs/draftStatus` | `npm run demo` M3 and M5; `npm run test:fail-closed` | Verified locally |
| REQ-SAFE-002 | No diagnosis, treatment, triage, medication, or other clinical recommendation is generated | §6 | Neo | `safetyStatus` flags, no recommendation section in the output contract | `npm run demo` M3; `npm run evaluate:grounding` 18 checks | Verified locally (example set) and live: 7/7 bounded live evaluation cases passed 2026-08-13, including `prohibited-clinical-recommendation-refusal` (25/25 checks) and adversarial `immutable-draft-safety-constants` (25/27 checks) — see `docs/agent/grounding-evaluation.md`, `docs/evidence/2026-08-13-foundry-live-evaluation.md`; BLOCKER-003 / RISK-019 resolved |
| REQ-SAFE-003 | No autonomous signature, chart write, patient or family communication, or production action | §3, §6 | Trinity | `lifecycleStatus` values, `docs/architecture/decisions/ADR-20260812-010.md` | Review at integration | Baseline accepted |
| REQ-SAFE-004 | Patient and encounter are confirmed before generation and again before approval | §5.8 | Tank | `preGenerationConfirmedAt`, `preApprovalConfirmedAt` | `rule context-reconfirmation-match`; `npm run demo` M2 and M5 | Verified locally |
| REQ-SAFE-005 | Missing identity, context, schema validity, grounding, or approval fails closed | §5.6 | Trinity | `failClosedCode` enum, fail-closed markers | 20 negative fixtures under `contracts/examples/invalid/`; `npm run test:fail-closed` | Verified locally |
| REQ-SAFE-006 | Unverified platform behavior is never represented as operational | §5.11 | Trinity | `docs/assumptions.md`, `docs/risks.md` | `npm run validate:docs` | Baseline accepted |

## Narrative

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-STORY-001 | Care team as hero, the Second Shift as problem, Microsoft capabilities as guide, bounded plan, time back with trust | §2 | Switch | `docs/narrative/storybrand.md` | `npm run validate:docs`; integration review 2026-08-12 | Verified locally |
| REQ-STORY-002 | Demonstrations emphasise the human and operational outcome rather than a product feature tour | §2 | Switch | `docs/demo/demonstration-script.md`, `docs/demo/talk-track.md` | `npm run validate:docs`; integration review 2026-08-12 | Verified locally |
| REQ-STORY-003 | Prohibited claims never appear in generated content or documentation | §2, §5.11 | Switch | `docs/conventions/prohibited-claims.json` | `npm run validate:docs` | Baseline accepted |

## Evidence

| ID | Requirement | Charter source | Owner | Contract or artifact | Validation | Status |
|---|---|---|---|---|---|---|
| REQ-VAL-001 | Contracts, examples, negative fixtures, and cross-field rules are executably validated | §5.12 | Trinity | `scripts/validate-contracts.mjs` | `npm run validate:contracts`, 48 checks | Verified locally |
| REQ-VAL-002 | Required documents exist, internal links resolve, and prohibited claims are absent | §5.11 | Trinity | `scripts/validate-docs.mjs` | `npm run validate:docs`, 18 checks | Verified locally |
| REQ-VAL-003 | No credential, connection string, or direct identifier enters the repository | §4 | Morpheus | `scripts/scan-secrets.mjs` | `npm run scan:secrets`; `tests/security/secret-exposure.test.mjs` | Verified locally |
| REQ-VAL-004 | Completion is reported with commands and actual results, never with scaffolding | §5.12, §8 | Trinity | Agent reports | `docs/evidence/2026-08-12-integration-run.md` | Verified locally |
