# Documentation

Architecture baseline for the Second Shift accelerator, accepted at the Design
Review on 2026-08-12. Governing charter: `SQUAD_BOOTSTRAP.md` (human-owned, read
only).

This baseline is the hard dependency for P0 implementation. It defines the
contracts, decisions, requirements, and validation that implementation work is
built against. The vertical slice built against it — orchestration, governance,
agent instructions, presentation surfaces, and the local demonstration entry
point — is described in the [P0 execution plan](plan/p0-execution-plan.md) and
recorded in [`evidence/`](evidence/2026-08-12-integration-run.md).

## Start here

| Document | Purpose |
|---|---|
| [P0 execution plan](plan/p0-execution-plan.md) | Work packages, owners, dependencies, file ownership, acceptance criteria, validation commands, and milestone acceptance for the nurse journey |
| [Requirements matrix](traceability/requirements-matrix.md) | Every `REQ-*` identifier, its charter source, owner, contract, and validation command |
| [Architecture decisions](architecture/decisions/README.md) | Ten accepted ADRs with the reasoning behind the baseline |
| [Risks](risks.md) | Open blockers requiring a human decision, plus the risk register |
| [Assumptions](assumptions.md) | What the baseline depends on that has not been verified |
| [Run evidence](evidence/2026-08-12-integration-run.md) | Every validation command and its actual output from the integration run |

## Conventions

| Document | Purpose |
|---|---|
| [Correlation identifier](conventions/correlation-id.md) | Format, single minting authority, lifetime, and the user-visible short reference |
| [Draft and safety status](conventions/draft-and-safety-status.md) | The three status fields, the twelve fail-closed codes, and the two confirmation gates |
| [Prohibited claims](conventions/prohibited-claims.json) | Claims that must never appear in content, configuration, or documentation |

## Contracts and configuration

| Location | Purpose |
|---|---|
| [`contracts/README.md`](../contracts/README.md) | The shared contracts, identifier shapes, negative fixtures, and cross-field rules |
| [`config/README.md`](../config/README.md) | Organization packs, environment separation, and adding another organization |

## Safety boundaries

These are not negotiable and are enforced by contract wherever a contract can
enforce them:

- Synthetic example data only. No real patient, staff, or customer information.
- No diagnosis, treatment, triage, medication, or other clinical recommendation.
- Every generated artifact carries `DRAFT — HUMAN REVIEW REQUIRED`.
- Nothing leaves `DRAFT` without an authenticated, authorized human decision.
- No autonomous signature, chart write, patient or family communication, or
  production action.
- Missing identity, context, schema validity, grounding, or approval fails
  closed.
- Time-back figures are labelled `ILLUSTRATIVE` and are never measured results.
- Deferred capability is documented as `FUTURE` and never implemented as a stub.

## Validation

```
npm install
npm run verify
```

`npm run verify` runs contract validation, documentation validation, the secret
scan, the fail-closed catalog, the governance checks, the instruction digest
check, the local grounding evaluation, every test under `tests/`, and the local
synthetic nurse journey. Individual commands are `npm run validate:contracts`,
`npm run validate:docs`, `npm run scan:secrets`, `npm run test:fail-closed`,
`npm run test:governance`, `npm run evaluate:digest`,
`npm run evaluate:grounding`, `npm run test:unit`, and `npm run demo`. Each
exits non-zero on failure.

Live Microsoft Foundry evaluation is not part of any of these commands. It is
blocked by BLOCKER-003 in [risks](risks.md) and is reported as `NOT RUN`.
