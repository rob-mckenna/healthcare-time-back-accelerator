# Squad Decisions

## Active Decisions

### 2026-08-12: Human-owned charter authority and Option A scope lock
**By:** Rob McKenna (via Squad)
**What:** `SQUAD_BOOTSTRAP.md` governs generated state and delivery. P0 is limited to one Copilot Studio workflow, one Foundry Shift Closeout Agent, synthetic FHIR-shaped data, one human approval path, one minimal audit event, and one simple illustrative time-back view.
**Why:** Preserve the approved lightweight prototype boundary and prevent deferred enterprise or clinical capabilities from appearing operational.

### 2026-08-12: Synthetic-only draft workflow with fail-closed human authority
**By:** Rob McKenna (via Squad)
**What:** Use no PHI or PII; provide no diagnosis, treatment, triage, or medication recommendation; perform no autonomous signature, chart write, communication, or production action. Every generated artifact must say `DRAFT — HUMAN REVIEW REQUIRED`. Confirm patient and encounter context before generation and approval, and fail closed when identity, context, schema validation, grounding, or approval is missing.
**Why:** The repository is a reusable prototype, not a production clinical system, and human authority is non-negotiable.

### 2026-08-12: Configuration and token contract over organization forks
**By:** Rob McKenna (via Squad)
**What:** Harborlight Children's Hospital is an example configuration only. Organization, persona, workflow, care setting, terminology, branding, and environment values must change without editing core logic. Secrets and environment values remain separate and uncommitted.
**Why:** The accelerator must be reusable across healthcare organizations without hardcoded organization logic.

### 2026-08-12: Contract-first implementation and single integration owner
**By:** Rob McKenna (via Squad)
**What:** Shared schemas and conventions are accepted before parallel implementation. Trinity is the named integration owner; independent agents receive non-overlapping file ownership.
**Why:** Prevent incompatible interfaces and concurrent edits while retaining parallel delivery.

### 2026-08-12: StoryBrand and evidence conventions
**By:** Rob McKenna (via Squad)
**What:** The care team is the hero, the Second Shift is the problem, Microsoft capabilities are the guide, and the outcome is time back with trust. Sample and composite metrics must be labeled `ILLUSTRATIVE` and never presented as measured outcomes. Completion requires executable evidence, not scaffolding.
**Why:** Keep the demonstration outcome-led, bounded, trustworthy, and reviewable.

## Governance

- Authority order: explicit human instruction, `SQUAD_BOOTSTRAP.md`, accepted ADRs, this ledger, agent charters/routing, then plans and notes.
- Human approval is required for priorities, scope changes, clinical-risk acceptance, security-risk acceptance, and release.
- Scope changes require a human-approved ADR.
- `BLOCKER-*` uncertainty stops only affected work and records code, impact, evidence, safe options, recommendation, and exact decision required.
- Keep history focused on work and this ledger focused on accepted shared direction.
