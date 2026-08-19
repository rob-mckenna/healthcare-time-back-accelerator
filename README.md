# Second Shift Reduction Accelerator

**DRAFT — HUMAN REVIEW REQUIRED**

This is a reusable prototype and solution pattern. It is not a production
clinical system and must not be represented as one.

---

## What this is

A reusable accelerator that demonstrates one complete, governed, synthetic
shift-closeout workflow for healthcare care teams. It shows how Microsoft
Copilot Studio and Microsoft Foundry can organize documented synthetic
entries into a structured draft, present that draft to a nurse for review,
and record an attributable human decision — all without writing to a real
system of record, handling real patient data, or taking any clinical action.

The example configuration is **Harborlight Children's Hospital**. Harborlight
is a fictional pediatric example organization created for this demonstration.
No real organization, patient, staff member, or clinical record is involved.

## What this deliberately is not

- **Not a production clinical system.** Nothing in this accelerator writes
  to an EHR, communicates with a patient or family, or constitutes a
  clinical record.
- **Not a diagnostic or clinical decision tool.** The Shift Closeout Agent
  organizes documented synthetic entries. It produces no diagnosis, no
  treatment recommendation, no triage call, and no clinical assessment.
- **Not designed around real patient data.** All data is synthetic and was
  created solely for this demonstration. No PHI or PII is involved.
- **Not a measured outcome.** Any time-back figures shown in demonstrations
  are derived from a synthetic example scenario and are labeled ILLUSTRATIVE
  on every value. They are not measured results from any deployed system.

## Safety boundaries

These boundaries are enforced by contract and are not configurable:

1. Every generated artifact carries `DRAFT — HUMAN REVIEW REQUIRED`.
2. Nothing leaves `DRAFT` status without an authenticated, authorized human
   decision recorded as an approval event.
3. The Shift Closeout Agent produces no diagnosis, treatment recommendation,
   triage call, medication recommendation, or clinical assessment. There is
   no recommendation section in the output.
4. The patient and encounter are confirmed by the nurse before generation
   and again before approval. A mismatch stops the run.
5. Every generated section must trace to an approved synthetic source
   reference. Ungrounded output is refused, not annotated.
6. Every failure condition produces an audit event and a configured
   user-safe message. Raw exceptions, stack traces, and payload fragments
   are never shown to the user.
7. Time-back figures are labeled ILLUSTRATIVE on every value and are never
   presented as measured results.
8. Deferred capabilities are documented as `FUTURE` and are not implemented,
   even as stubs.

---

## Architecture overview

![Shift closeout architecture diagram: an authenticated nurse uses a Copilot Studio care-team experience on the left; past a labeled invocation boundary, a solid working P0 local deterministic simulation path and a dashed not-connected direct Copilot Studio to Foundry target path lead to exactly one Microsoft Foundry Shift Closeout Agent; BLOCKER-001 path selection is resolved; BLOCKER-002 repository identity and authorization controls are resolved and verified locally, while connected-tenant request, response, identity, and role validation remains not run under RISK-020; BLOCKER-003 is resolved with 7 of 7 bounded live Foundry evaluation cases passing; a synthetic FHIR-shaped source grounds the agent; deterministic controls sit outside generation and fail closed; a human approval path produces a minimal attributable audit event with no chart write; a time-back view is labeled illustrative only; a correlation ID trace spans request, generation, decision, and audit; and a configuration and token contract cuts across the whole diagram.](docs/architecture/diagrams/shift-closeout-architecture.svg)

The diagram above follows the same StoryBrand frame as this README: the care
team is the hero, Microsoft Copilot Studio and Microsoft Foundry are the
guide, and the bounded, human-reviewed workflow is the plan that returns
time without asking anyone to trust an unreviewed draft.

**Legend.**

- **Solid boxes and arrows** trace the path that is implemented and
  exercised today: the nurse's request moves through the Copilot Studio
  care-team experience, into the **P0 local deterministic simulation**
  (`src/orchestration/foundry-adapter.mjs`, exercised by `npm run demo`),
  which returns a contract-valid draft with no network call and no platform
  dependency.
- **Dashed boxes and arrows** trace the **live Copilot Studio → Foundry
  binding**. ADR-20260813-011 resolves `BLOCKER-001` path selection by choosing
  the preview direct connected-agent path, but the binding is **NOT CONNECTED**
  and connected-tenant validation remains **NOT RUN** under `RISK-020`.
  `BLOCKER-002` is resolved for the repository: explicit identity handoff,
  authorization, stale-context, wrong-confirmer, human-only approval, and audit
  redaction controls are implemented and exercised. That repository evidence
  does **not** verify live identity or role propagation in a connected tenant.
  The dashed path does not represent deployed connectivity or an end-to-end
  Copilot Studio run. Separately, the isolated live Foundry agent passed all 7
  bounded evaluation cases, resolving `BLOCKER-003`.
- Regardless of which path produced it, every draft is grounded only in the
  **synthetic FHIR-shaped source**, passes through **deterministic controls**
  (identity, context, schema, safety, grounding, and correlation checks that
  sit outside the probabilistic generation step and fail closed on any gap),
  and must clear the **human approval path** before a minimal, attributable
  **audit event** is recorded. No step writes to a chart or takes a
  production action.
- A single **correlation ID** (see
  [`docs/conventions/correlation-id.md`](docs/conventions/correlation-id.md))
  is minted per run and echoed unchanged across request, generation,
  decision, and audit, so any run can be traced end to end.
- The **time-back view** is illustrative only, and the
  **configuration and token contract** (organization, persona, workflow,
  care setting, terminology, and branding) is a cross-cutting concern
  resolved from configuration, not hardcoded logic — Harborlight Children's
  Hospital is the example-only configuration used throughout this repository,
  and secrets and endpoints are always kept in separate, uncommitted
  environment bindings.

The editable source for this diagram is
[`docs/architecture/diagrams/shift-closeout-architecture.excalidraw`](docs/architecture/diagrams/shift-closeout-architecture.excalidraw).
When updating it, edit the Excalidraw source first, bring the SVG into line,
and keep the SVG title/description and README alt text synchronized with the
source. The reproducible edit → sync → validate process, the invariants the
diagram must always hold, and the narrow/mobile legibility approach are
documented in
[`docs/architecture/diagrams/README.md`](docs/architecture/diagrams/README.md).
`npm run validate:diagram` enforces source-to-SVG parity, self-containment,
accessibility, and the Option A scope invariants on every run of
`npm run verify`.

---

## Getting started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Install dependencies

```bash
npm install
```

### Run the local synthetic nurse journey

```bash
npm run demo
```

This executes the complete shift-closeout journey against the synthetic dataset
on your machine — request, patient and encounter confirmation, one simulated
agent generation, source-reference inspection, all three decision paths,
correlated audit evidence, and the ILLUSTRATIVE time-back view — with no network
call and no platform dependency. Generation runs through a documented simulation
boundary, not a live Foundry agent; see the blockers below.

Add `--json docs/evidence/my-run.json` to write a machine-readable record of the
run.

### Run all validation

```bash
npm run verify
```

This runs every command in the table below in sequence. It exits non-zero on any
failure.

---

## Validation commands

| Command | Purpose |
|---|---|
| `npm run validate:contracts` | Compiles all JSON Schema 2020-12 contracts, validates every positive example against its schema, asserts that every negative fixture is refused for its recorded reason, and applies the cross-field rules. The gate for contract conformance. |
| `npm run validate:docs` | Asserts required documents exist and are non-trivial, resolves all relative Markdown links, scans all Markdown prose for prohibited claim phrases, checks that documents presenting time-back figures carry the `ILLUSTRATIVE` label, verifies ADR field completeness, checks the ADR index, and validates requirement-ID hygiene. The gate for documentation conformance. |
| `npm run validate:diagram` | Asserts the architecture diagram's Excalidraw source and committed SVG communicate the same architecture (label parity), the SVG is self-contained and accessible (role, `aria-labelledby`, non-trivial title and description, no external resources), the Option A scope invariants hold (exactly one Copilot Studio workflow and one Foundry Shift Closeout Agent), and the README embeds the SVG with non-trivial alt text. The gate for diagram conformance. |
| `npm run scan:secrets` | Scans every file eligible for commit (via `git ls-files --cached --others --exclude-standard`, so it always follows the live `.gitignore` — including `.squad/`, `.github/`, and `.copilot/`) for credential, connection string, and direct-identifier patterns. The gate for secret hygiene. |
| `npm run validate` | The four commands above in sequence. |
| `npm run test:fail-closed` | Exercises every one of the twelve fail-closed codes through the orchestration layer, including the user-safe message mapping. |
| `npm run test:governance` | Exercises validation order, the PHI scan, approval binding, audit minimality, and illustrative metric labelling. |
| `npm run evaluate:digest` | Recomputes the agent instruction digest and asserts it matches the shipped manifest and the provenance examples. |
| `npm run evaluate:grounding` | Runs the local deterministic grounding evaluation set. The separate bounded live Foundry evaluation passed 7/7 on 2026-08-13; see `docs/evidence/2026-08-13-foundry-live-evaluation.md`. |
| `npm run test:unit` | Runs every test under `tests/`, including wrong-patient, malformed-output, prompt-injection, unsupported-fact, approval-bypass, secret-exposure, and the end-to-end journey test. |
| `npm run demo` | Executes the local synthetic nurse journey, M1 to M6. |
| `npm run verify` | Every command above in sequence. This is the integration gate. No work package is accepted without a recorded zero-exit run of this command. |

---

## Repository structure

| Path | Purpose |
|---|---|
| `contracts/` | Shared JSON Schema 2020-12 contracts, valid examples, negative fixtures, and cross-field rules. Trinity-owned. Read by every agent. |
| `config/` | Organization configuration packs and environment separation. Trinity-owned. |
| `config/organizations/harborlight/` | Harborlight example pack. Modify or replace to add another organization. |
| `config/environments/` | Environment binding templates. Never commit real values. |
| `data/synthetic/` | Synthetic FHIR-shaped dataset. Morpheus-owned. No real patient data. |
| `agent/` | Foundry agent instructions, evaluation assets, and versioned manifests. Neo-owned. |
| `workflow/` | Copilot Studio experience definition. Tank-owned. |
| `src/orchestration/` | The shift-closeout workflow: identity and context gates, input building, the simulated agent boundary, output validation, approval, and audit. Tank-owned. |
| `src/governance/` | Shared validation utility, PHI scan, approval logic, audit emission, and illustrative metric computation. Morpheus-owned. |
| `src/view/` | Presentation surfaces: the draft, source references, correlated evidence, and the ILLUSTRATIVE time-back view. Trinity-owned. |
| `tests/` | Unit, integration, and security tests, including the end-to-end nurse journey test. |
| `docs/` | All documentation. See `docs/README.md` for the index. |
| `docs/narrative/` | StoryBrand frame and outcome narrative. Switch-owned. |
| `docs/demo/` | Demonstration script and talk track. Switch-owned. |
| `docs/evidence/` | Recorded validation output from integration runs. Trinity-owned. |
| `scripts/` | Validation, secret scan, and the local journey entry point. Trinity-owned. |

---

## Adding another organization

Adding a second organization requires no changes to agent instructions,
workflow logic, schemas, or validation scripts.

1. Copy the Harborlight example pack:
   ```
   config/organizations/harborlight/
   ```
   to a new directory named for the target organization ID, for example:
   ```
   config/organizations/my-health-system/
   ```

2. Edit `organization.json` in the new directory to supply the
   organization's values. Every configurable value — name, persona,
   terminology, branding, care setting, error messages, illustrative
   sample figures, and baseline figures — is in this file. Environment
   values and credentials are never placed here; only the names of
   environment variables appear, under `environmentBindings`.

3. Create a corresponding `.env` file (or set environment variables in
   your deployment environment) for the environment-binding values listed
   under `environmentBindings` in the configuration. These values are never
   committed to the repository.

4. Run `npm run validate:contracts` to confirm the new pack validates
   against the organization configuration schema.

The Harborlight example demonstrates a pediatric inpatient terminology pack.
Another organization may supply a different terminology pack by changing
`terminologyPack` and the relevant label fields in the configuration.

---

## Deferred capabilities — FUTURE

The following capabilities are planned for future phases and are **not
implemented** in this P0 prototype. They must not be implied as operational.

| Capability | Status |
|---|---|
| Live EHR or production FHIR API integration | `FUTURE` |
| Write-back to any system of record | `FUTURE` |
| Production identity and role-claim enforcement | `FUTURE` — repository controls are implemented; connected-tenant validation is NOT RUN under RISK-020 |
| Multiple agents or additional workflows | `FUTURE` |
| Medication reconciliation | `FUTURE` |
| Discharge coordination | `FUTURE` |
| Referral coordination | `FUTURE` |
| Family or patient communication | Out of scope for this prototype |
| Microsoft Fabric production pipeline | `FUTURE` |
| Azure API Management production configuration | `FUTURE` |
| Microsoft Purview, Defender, or Sentinel | `FUTURE` |
| Enterprise-scale infrastructure automation | `FUTURE` |
| Multi-organization onboarding tooling | `FUTURE` |

Scope expansions require a human-approved ADR. See
`docs/architecture/decisions/ADR-20260812-010.md` for the deferred
capabilities rule.

---

## Documentation

| Document | Purpose |
|---|---|
| [`docs/README.md`](docs/README.md) | Documentation index |
| [`docs/plan/p0-execution-plan.md`](docs/plan/p0-execution-plan.md) | Work packages, owners, dependencies, acceptance criteria, and milestone definitions |
| [`docs/traceability/requirements-matrix.md`](docs/traceability/requirements-matrix.md) | Every requirement identifier with charter source, owner, contract, and validation |
| [`docs/narrative/storybrand.md`](docs/narrative/storybrand.md) | StoryBrand frame governing all demonstration narrative |
| [`docs/demo/demonstration-script.md`](docs/demo/demonstration-script.md) | What appears on screen and what is said at each step |
| [`docs/demo/talk-track.md`](docs/demo/talk-track.md) | Spoken words for live demonstration delivery |
| [`docs/architecture/decisions/`](docs/architecture/decisions/README.md) | Eleven accepted ADRs |
| [`docs/architecture/diagrams/`](docs/architecture/diagrams/README.md) | Architecture diagram artifacts and the reproducible update/export process |
| [`docs/architecture/copilot-studio-foundry-direct-connection.md`](docs/architecture/copilot-studio-foundry-direct-connection.md) | Direct connected-agent architecture and validation boundary |
| [`docs/risks.md`](docs/risks.md) | Blocker status, open validation risks, and the risk register |
| [`docs/evidence/2026-08-12-integration-run.md`](docs/evidence/2026-08-12-integration-run.md) | Every validation command and its actual output from the integration run |
| [`docs/assumptions.md`](docs/assumptions.md) | Verified-or-open assumptions the baseline depends on |
| [`docs/conventions/draft-and-safety-status.md`](docs/conventions/draft-and-safety-status.md) | The three status fields, the twelve fail-closed codes, and the two confirmation gates |
| [`docs/conventions/correlation-id.md`](docs/conventions/correlation-id.md) | Correlation identifier format, lifetime, and ownership |
| [`contracts/README.md`](contracts/README.md) | Contract index, identifier shapes, and cross-field rules |
| [`config/README.md`](config/README.md) | Organization pack structure, environment separation, and adding an organization |

---

## Governing charter

`SQUAD_BOOTSTRAP.md` is the human-owned governing charter for this
repository. All generated state, agent charters, plans, contracts, and
documentation conform to it. If any artifact conflicts with the charter,
the charter takes precedence. The charter may only be modified by the
human project owner.

---

## Platform decision and remaining blockers

The direct target binding is selected, but the local demonstration remains
honest about which platform steps have run:

- **BLOCKER-001** — Resolved by ADR-20260813-011: use Copilot Studio's preview
  direct Microsoft Foundry connected-agent path. Power Automate is not the
  target intermediary.
- **BLOCKER-002** — Resolved for repository identity and authorization controls:
  explicit handoff validation, authorized-role enforcement, stale-context and
  wrong-confirmer rejection, human-only approval, and audit redaction are
  implemented and tested. Live identity and role propagation in the target
  Copilot Studio tenant remains **NOT RUN** under `RISK-020`.
- **BLOCKER-003** — Resolved by issue #6: the isolated Foundry agent was
  verified with zero tools and passed all 7 bounded live evaluation cases.
- **RISK-020** — Direct Copilot Studio connected-agent validation, including
  request/response contract adaptation and live identity/role handoff, is
  **NOT RUN**.

Contracts, synthetic data, governance utilities, orchestration, presentation,
narrative, and this documentation are unblocked and complete for the local
synthetic slice. The generation step in `npm run demo` runs through a documented
simulation boundary in `src/orchestration/foundry-adapter.mjs`, which returns a
contract-valid draft for the synthetic dataset. No live Foundry agent is called,
and no live Copilot Studio topic is bound. The separate live Foundry agent
evaluation under issue #6 does not validate the direct Copilot Studio
connection.

---

> **DRAFT — HUMAN REVIEW REQUIRED.** This accelerator uses synthetic example
> data only. It has no clinical or legal standing. All generated content
> must be reviewed by a qualified Registered Nurse before use in any context.
> Time-back figures shown in demonstrations are ILLUSTRATIVE, derived from a
> synthetic example scenario, and do not represent measured outcomes.
