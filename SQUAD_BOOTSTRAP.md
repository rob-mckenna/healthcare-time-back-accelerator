---
bootstrap_schema_version: "1.0"
project_id: "healthcare-time-back-accelerator"
project_name: "Second Shift Reduction Accelerator"
implementation_profile: "option-a-lightweight-prototype"
example_organization: "harborlight-childrens-hospital"
status: "governing-project-charter"
---

# Second Shift Reduction Accelerator — Squad Bootstrap

## 1. Charter authority

This file is the human-owned governing charter for this repository.

Squad must read this file in full before planning or changing the repository.
Generated Squad state, routing, decisions, agent charters, plans, code, tests,
and documentation must conform to it.

If another repository artifact conflicts with this charter, use this authority
order:

1. Explicit instruction from the human project owner.
2. `SQUAD_BOOTSTRAP.md`.
3. Accepted architecture decision records.
4. `.squad/decisions.md`.
5. Squad agent charters and routing rules.
6. Plans, issues, and implementation notes.

Squad must not silently modify or relax the mission, scope lock, healthcare
safety constraints, human-approval requirements, or definition of done.

This repository is intended to be production-quality as a reusable prototype
and solution pattern. It is not a production clinical system and must not be
represented as one.

## 2. Mission

Build a reusable healthcare solution accelerator that reduces the
administrative work described as the **Second Shift** and returns measurable
time to care teams.

The example implementation uses Harborlight Children's Hospital, but the
solution must remain reusable across healthcare organizations, personas,
workflows, care settings, terminology packs, and brands.

The lightweight implementation must demonstrate one complete workflow:

1. An authenticated nurse requests a shift-closeout draft.
2. The nurse confirms the synthetic patient and encounter.
3. A Microsoft Foundry Shift Closeout Agent reads approved synthetic data.
4. The agent creates a structured shift summary and handoff draft.
5. The output is marked `DRAFT — HUMAN REVIEW REQUIRED`.
6. The nurse approves, rejects, or requests revision.
7. The system records an attributable approval event.
8. A simple dashboard communicates illustrative time-back measures.

### StoryBrand alignment

- **Character:** The care team and healthcare leader are the heroes.
- **Problem:** The Second Shift displaces time from patient care.
- **Guide:** Microsoft capabilities provide a governed path forward.
- **Plan:** Start with one bounded workflow, measure it, and scale only what
  earns trust.
- **Call to action:** Run a controlled Time-Back Pilot.
- **Failure:** Administrative burden continues to consume care-team time.
- **Success:** Care teams recover time while retaining human authority.

All demonstrations must emphasize the human and operational outcome rather
than presenting a product-feature tour.

## 3. Option A scope lock

### Required P0 scope

Build only:

- One Copilot Studio care-team experience.
- One Microsoft Foundry Shift Closeout Agent.
- One synthetic FHIR-shaped healthcare dataset.
- One shift-closeout workflow.
- One human review and approval path.
- One minimal attributable audit event.
- One simple time-back dashboard or dashboard view.
- Supporting documentation, configuration, tests, and evaluation assets.

### Required generated artifacts

The Shift Closeout Agent must produce:

- Shift summary.
- Handoff summary.
- Open items.
- Follow-up items.
- Source references to the approved synthetic input.
- Safety and draft status.
- Generation and correlation identifiers.

### Explicitly deferred

Do not implement these in P0:

- Additional agents.
- Referral coordination.
- Family communication.
- Medication reconciliation.
- Discharge coordination.
- Production EHR integration.
- Real patient data or PHI.
- Autonomous clinical actions.
- Microsoft Fabric production pipelines.
- Azure API Management production configuration.
- Microsoft Purview implementation.
- Microsoft Defender implementation.
- Microsoft Sentinel implementation.
- Enterprise-scale infrastructure automation.
- Multiple organizations or care settings beyond configuration examples.

Deferred capabilities may appear in architecture documentation and extension
interfaces, but they must be clearly labeled `FUTURE` and must not appear to
be operational.

Scope may expand only through a human-approved decision recorded in an ADR.

## 4. Reusable token contract

Organization-specific values must come from configuration. Do not hardcode
Harborlight values in core agent instructions, workflow logic, schemas,
evaluations, or shared user-interface components.

| Token | Harborlight example |
|---|---|
| `{{SOLUTION_NAME}}` | Second Shift Reduction Accelerator |
| `{{ORGANIZATION_NAME}}` | Harborlight Children's Hospital |
| `{{ORGANIZATION_ID}}` | harborlight |
| `{{PRIMARY_PERSONA_NAME}}` | Maria Delgado |
| `{{PRIMARY_PERSONA_ROLE}}` | Chief Nursing Officer |
| `{{END_USER_ROLE}}` | Registered Nurse |
| `{{CARE_SETTING}}` | Pediatric inpatient unit |
| `{{PILOT_UNIT}}` | Synthetic pediatric pilot unit |
| `{{PRIMARY_WORKFLOW}}` | Shift closeout |
| `{{TERMINOLOGY_PACK}}` | harborlight-pediatrics |
| `{{BRAND_NAME}}` | Harborlight Time Back to Care |
| `{{BRAND_ASSET_PATH}}` | config/organizations/harborlight/brand |
| `{{EHR_SYSTEM}}` | Synthetic FHIR simulator |
| `{{FHIR_DATA_PATH}}` | data/synthetic-fhir |
| `{{AZURE_REGION}}` | Environment-specific value |
| `{{FOUNDRY_PROJECT_ENDPOINT}}` | Environment-specific value |
| `{{FOUNDRY_AGENT_ID}}` | Environment-specific value |
| `{{COPILOT_ENVIRONMENT_ID}}` | Environment-specific value |

Requirements:

- Define a machine-readable configuration schema.
- Provide a Harborlight example configuration.
- Separate template values from secrets and environment values.
- Never commit credentials, subscription IDs, tenant secrets, tokens, or
  connection strings.
- Validation must fail when required values are missing.
- Adding another organization must not require changes to core agent or
  workflow logic.

## 5. Architecture principles

1. **Outcome first:** Optimize for time returned to care teams.
2. **Human authority:** Agents draft; qualified humans approve.
3. **Synthetic by default:** Use no real PHI, PII, or customer data.
4. **System-of-record boundary:** The synthetic FHIR source remains
   authoritative.
5. **Draft-only generation:** Generated content is never a finalized clinical
   record.
6. **Deterministic controls:** Put schemas, validation, approval, and
   fail-closed logic around probabilistic generation.
7. **Minimum necessary context:** Provide only the data needed for the
   selected workflow.
8. **Explicit patient context:** Confirm patient and encounter before
   generation and again before approval.
9. **Safe traceability:** Record identities, versions, sources, decisions, and
   outcomes without logging sensitive payloads.
10. **Configuration over forks:** Extend through packs and adapters.
11. **Transparent limitations:** Disclose samples, simulations, mocks, preview
    dependencies, and unsupported production assumptions.
12. **Evidence over claims:** Do not report completion without validation.

## 6. Architecture boundaries

### Copilot Studio

Owns:

- Care-team conversation and user experience.
- Shift-closeout intent.
- Synthetic patient and encounter confirmation.
- Invocation of the Shift Closeout Agent.
- Presentation of the generated draft.
- Approve, reject, and revise choices.
- User-facing safety and draft notices.
- Exception and escalation messages.

Copilot Studio must not independently create clinical recommendations or
bypass the approval boundary.

### Microsoft Foundry

Owns:

- The single Shift Closeout Agent.
- Versioned agent instructions.
- Structured output generation.
- Approved synthetic-data grounding.
- Source-reference generation.
- Agent evaluation assets.
- Available tracing and correlation metadata.

The agent may summarize, organize, and identify documented open items. It may
not diagnose, prescribe, triage, or create unsupported clinical facts.

### Synthetic FHIR data

Owns the prototype source context.

Include documented examples of relevant resources such as:

- Patient.
- Encounter.
- Observation.
- Condition.
- CarePlan.
- ServiceRequest.
- Task.
- Communication.
- Practitioner or care-team references.

Only include the minimal synthetic resources needed for the shift-closeout
scenario.

### Human approval workflow

Owns:

- Review status.
- Approver identity.
- Approve, reject, and revise events.
- Timestamp.
- Correlation ID.
- Artifact version.
- Decision reason when supplied.
- Simulated finalization status.

No artifact may transition from `DRAFT` to `APPROVED` without an
authenticated, authorized human event.

### Time-back dashboard

Owns a simple demonstration view containing clearly labeled sample data:

- Baseline workflow duration.
- Assisted workflow duration.
- Illustrative time returned.
- Draft acceptance or revision status.
- Approval coverage.

Sample and composite metrics must be labeled `ILLUSTRATIVE` and must never be
represented as observed customer outcomes.

### Deferred enterprise services

Fabric, APIM, Entra hardening, Purview, Defender, Sentinel, and production
observability belong in the target-state architecture. They are not P0
implementation requirements unless explicitly added by the human owner.

## 7. Squad roster

| Role | Accountability |
|---|---|
| Lead Architect and Integrator | Scope, contracts, ADRs, routing, integration, and final technical review |
| Healthcare Workflow and Story Lead | Nursing workflow, healthcare authenticity, StoryBrand alignment, terminology, and demo narrative |
| Copilot Studio Engineer | Copilot experience, workflow, approval interaction, error handling, and packaging guidance |
| Foundry Agent Engineer | Agent instructions, schemas, grounding, versions, evaluations, and tracing |
| Data, Security, and Quality Engineer | Synthetic FHIR data, privacy, threat model, audit schema, tests, and dashboard data |
| Scribe | Decisions, risks, assumptions, traceability, session evidence, and unresolved items |

One person or agent may cover multiple roles, but accountability must remain
explicit.

The human project owner retains authority over priorities, scope changes,
clinical-risk acceptance, security-risk acceptance, and release.

## 8. Collaboration workflow

1. Read this charter and inspect the existing repository.
2. Initialize or reconcile native Squad artifacts.
3. Create the requirements matrix, risks, assumptions, and P0 plan.
4. Agree on shared contracts before parallel implementation.
5. Assign one integration owner.
6. Fan out only independent work.
7. Avoid simultaneous edits to the same file.
8. Integrate in small, reviewable changes.
9. Run validation after each meaningful slice.
10. End each session with evidence, blockers, risks, and the next task.

Shared contracts required before implementation:

- Organization configuration schema.
- Synthetic patient and encounter schema.
- Shift Closeout Agent input schema.
- Shift Closeout Agent output schema.
- Approval event schema.
- Correlation-ID convention.
- Draft and safety-status convention.
- Illustrative metric schema.

Each agent report must include:

- Role.
- Requirement IDs addressed.
- Files changed.
- Commands executed.
- Tests or evaluations run.
- Actual results.
- Risks or assumptions introduced.
- Remaining work.

## 9. Governance and decision logging

Use `.squad/decisions.md` for concise shared memory and
`docs/architecture/decisions/` for durable ADRs.

ADR format:

```text
ADR-YYYYMMDD-NNN — Title
Status: Proposed | Accepted | Superseded | Rejected
Owner:
Requirement IDs:
Context:
Decision:
Alternatives:
Consequences:
Healthcare, privacy, security, and data impact:
Validation evidence:
Supersedes: