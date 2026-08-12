# RAI Audit Trail

> Append-only evidence log. Entries are redacted — never contains raw secrets or harmful content.

<!-- Rai appends findings below -->

## 2026-08-12 — WP-09 integration review (local synthetic shift-closeout vertical slice)

**Reviewer:** Rai. **Scope:** Full staged/unstaged working tree (initial commit, nothing yet
committed). **Commands run:** `npm run verify` (full suite, exit 0 — 48/48 contract checks,
18/18 doc checks, secret scan 0 findings/125 files, 38/38 fail-closed checks, 31/31 governance
checks, 7/7 digest checks, 18/18 grounding checks, 120/120 unit tests, 37/37 journey checks).

**Verdict: 🟡 YELLOW.** No 🔴 Critical violation found. Advisory finding below; work proceeds.

### Findings

| Severity | Category | File:Line | Finding | Status |
|---|---|---|---|---|
| 🟡 Advisory | Content/StoryBrand consistency | `docs/demo/talk-track.md:165-176` | Spoken-script illustrative time-back figures (45 min baseline / 12 min assisted / 33 min returned) do not match the actual configured and rendered figures for the Harborlight pack (24 min / 9 min / 15 min, per `config/organizations/harborlight/organization.json` `illustrativeMetrics` and the verified `npm run demo` output). Both sets are correctly labeled `ILLUSTRATIVE`, so this is not a deceptive/measured-outcome claim, but a live presenter reading the talk track would say numbers that contradict what is on screen, undermining the "evidence over claims" and StoryBrand trust principles. | Open — recommend Switch (narrative owner) update the talk track to cite 24/9/15 min or to instruct the presenter to read the on-screen figure rather than a fixed number. |

### Verified controls (no issues found)

- Synthetic-only boundary: `SYN-PAT-`/`SYN-ENC-`/`SYN-` prefix patterns structurally enforced (`src/orchestration/context-guard.mjs`, `contracts/schemas/synthetic-context.schema.json`); `npm run scan:secrets` 0 findings across 125 files.
- No diagnosis/treatment/triage/medication content: `contracts/schemas/shift-closeout-agent-output.schema.json` has no recommendation/assessment/plan property anywhere in the schema (`additionalProperties: false` throughout); `safetyStatus` flags (`noDiagnosis`, `noTreatmentOrMedicationRecommendation`, `noTriage`, `noClinicalRecommendation`) are JSON Schema `const: true` and refused otherwise.
- No autonomous signature/chart write/patient communication/production action: `lifecycleStatus` is `const: "DRAFT"` on agent output; approval events only ever produce `APPROVED-SIMULATED`; no write-path or mock client exists per ADR-20260812-010 (verified: no stub/mock system-of-record client found in `src/`).
- `DRAFT — HUMAN REVIEW REQUIRED`: immutable label enforced by schema `const` and by `src/view/draft-view.mjs:assertDraftLabel`, which refuses to render if absent/altered; unchanged after approval (ADR-20260812-004).
- Patient/encounter confirmation before generation and approval: `src/orchestration/context-guard.mjs` enforces two independent gates (`E-CONTEXT-UNCONFIRMED`, `E-APPROVAL-WITHOUT-CONFIRMATION`) plus a subject-match cross-check.
- Fail-closed identity/context/schema/grounding/approval: `src/orchestration/identity-guard.mjs`, `context-guard.mjs`, `output-validator.mjs`/`src/governance/validate-payload.mjs`, `E-GROUNDING-FAILURE` in `src/view/draft-view.mjs:openSourceReference`; 38/38 `test:fail-closed` checks passed.
- Human authority: no artifact leaves `DRAFT` without a recorded approval event; approval binds to an exact artifact digest (`approval-orchestrator.mjs`).
- Audit minimization: `contracts/schemas/audit-event.schema.json` has `additionalProperties: false` and no narrative/content/payload field exists in the schema; `src/view/draft-view.mjs:assertNoSensitivePayload` is a render-time backstop.
- Illustrative metric labeling: `illustrativeMetrics` schema requires `metricLabel` and a `sampleBasisNote` that itself must carry the label; `docs/conventions/prohibited-claims.json` blocks "proven outcomes"/"measured savings" phrasing; enforced by `npm run validate:docs`.
- No misleading live Microsoft platform claims: `src/orchestration/foundry-adapter.mjs` is an explicitly labeled, commented "SIMULATION BOUNDARY — NOT AN OPERATIONAL INTEGRATION"; `IS_SIMULATION_BOUNDARY` and `SIMULATION_BOUNDARY_LABEL` are printed in every local run; README and `docs/evidence/2026-08-12-integration-run.md` both state live Foundry/Copilot Studio work is **NOT RUN** and name BLOCKER-001/002/003 as open.
- StoryBrand safety/trust: `docs/demo/talk-track.md` "Things not to say" section explicitly bans clinical-decision framing, regulatory-compliance claims, measured-outcome framing, and present-tense description of deferred capability — consistent with `docs/conventions/prohibited-claims.json`.

### Distinguishing local simulation from blocked live behavior

Confirmed accurate throughout: the repository consistently and explicitly states that the local
synthetic vertical slice (contracts, governance, orchestration, fail-closed paths, and the
`npm run demo` journey) is complete and executable, while live Microsoft Foundry/Copilot Studio
binding remains blocked (BLOCKER-001, BLOCKER-002, BLOCKER-003 in `docs/risks.md`) and is never
represented as operational or verified.

