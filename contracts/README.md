# Shared contracts

Machine-readable contracts for the Second Shift accelerator. These are the
integration boundary between the care-team experience, the Shift Closeout Agent,
the synthetic data layer, and the governance layer. Agents implement against
these schemas, not against each other's code.

**Owner: Trinity.** This directory is written only by the integration owner. Raise
a change request rather than editing a schema, so a safety constraint cannot be
relaxed as a side effect of unblocking a task. See
`docs/architecture/decisions/ADR-20260812-001.md`.

## Layout

```
contracts/
  contract-index.json              machine-readable map of every contract
  schemas/
    common/definitions.schema.json shared $defs: identifiers, statuses, enums
    organization-config.schema.json
    synthetic-context.schema.json
    synthetic-source-bundle.schema.json
    source-reference.schema.json
    shift-closeout-agent-input.schema.json
    shift-closeout-agent-output.schema.json
    approval-event.schema.json
    audit-event.schema.json
    illustrative-metric.schema.json
  examples/                        one valid example per contract
    invalid/                       negative fixtures, one per safety gate
```

The organization configuration example is
`config/organizations/harborlight/organization.json`. It is the shipped example
pack and the contract example at once, so the two cannot drift.

## Contracts

| Contract | Schema | Purpose | Requirements |
|---|---|---|---|
| Organization configuration | `organization-config.schema.json` | Reusable naming, personas, safety copy, workflow scope, illustrative baselines, and environment variable *names* | REQ-CFG-001 to 005 |
| Synthetic context | `synthetic-context.schema.json` | The synthetic patient and encounter a run is bound to | REQ-DATA-001, REQ-DATA-002 |
| Synthetic source bundle | `synthetic-source-bundle.schema.json` | The FHIR-shaped source content approved for generation | REQ-DATA-003, REQ-DATA-004 |
| Source reference | `source-reference.schema.json` | A pointer from generated content back into the approved bundle | REQ-AGT-004 |
| Agent input | `shift-closeout-agent-input.schema.json` | Authenticated identity, confirmed context, approved source, scope, versions | REQ-AGT-001, REQ-WF-001, REQ-WF-002 |
| Agent output | `shift-closeout-agent-output.schema.json` | The structured draft, its safety assertions, and its provenance | REQ-AGT-003, REQ-AGT-005, REQ-SAFE-001, REQ-SAFE-002 |
| Approval event | `approval-event.schema.json` | The recorded human decision that moves an artifact out of `DRAFT` | REQ-APPR-001 to 003 |
| Audit event | `audit-event.schema.json` | Minimal attributable evidence carrying no narrative content | REQ-AUD-001 to 003 |
| Illustrative metric | `illustrative-metric.schema.json` | Time-back figures, labelled and disclaimed on the value itself | REQ-MET-001, REQ-MET-002 |

## Conventions

- JSON Schema 2020-12, `$id` base `https://contracts.second-shift-accelerator.example/v1/`.
- Property names are `camelCase` (ADR-20260812-005). Enumerated values are
  uppercase with hyphens. Environment variable names are `SCREAMING_SNAKE_CASE`.
- Every object sets `additionalProperties: false`. This is a safety control, not
  a style choice: it is what stops an audit event absorbing narrative content and
  what stops a recommendation appearing in a draft.
- Shared definitions live in `common/definitions.schema.json` and are referenced
  by relative `$ref`, so an identifier pattern or status enum changes in one
  place.
- Where a value has exactly one safe state, it is pinned with `const`
  (ADR-20260812-009). The unsafe state is unrepresentable rather than caught.

## Identifier shapes

| Prefix | Meaning |
|---|---|
| `CORR-` | Correlation identifier for a run; see `docs/conventions/correlation-id.md` |
| `SYN-PAT-`, `SYN-ENC-`, `SYN-BDL-` | Synthetic patient, encounter, and source bundle |
| `ART-` | A generated artifact |
| `GEN-` | One generation attempt within a run |
| `APR-` | One approval decision |
| `AUD-` | One audit event |
| `USR-`, `AGT-`, `SYS-` | Opaque actor references; only `USR-` may approve |
| `IDK-` | Idempotency key |

## Negative fixtures

`examples/invalid/` holds one fixture per safety gate. Each is registered in
`contract-index.json` with the reason it must be refused, and
`scripts/validate-contracts.mjs` asserts refusal *for that reason*, so a fixture
cannot pass by accident when an unrelated rule breaks.

The fixtures currently prove that the following are impossible: a draft without
its label, a self-approved artifact, a false safety assertion, an ungrounded
section, a recommendation section, an unauthenticated requester, an unapproved
source bundle, a missing context confirmation, a real identifier in synthetic
context, an unprefixed patient identifier, a rejection without a reason, an
approval without re-confirmation, an audit event carrying narrative, a blocked
audit event without a fail-closed code, a mislabelled metric, a metric whose
arithmetic does not hold, an embedded endpoint in configuration, a missing
disclaimer, a configuration pointing at non-synthetic data, and a configuration
describing its illustrative sample figures as measured results.

## Cross-field rules

Some invariants span two documents and cannot be expressed in a single schema.
They are implemented in `scripts/validate-contracts.mjs` and listed in
`contract-index.json`:

`correlation-propagation`, `scope-echo`, `bundle-binding`, `artifact-binding`,
`context-reconfirmation-match`, `source-reference-resolution`,
`metric-arithmetic`, `organization-config-is-example-only`,
`illustrative-metrics-config-arithmetic`,
`illustrative-metrics-config-matches-example`.

The last two tie the `illustrativeMetrics` block in an organization pack to the
`illustrative-metric` example: the label must be `ILLUSTRATIVE`, the assisted
duration may not exceed the baseline, and the pack figures must match the
documented example so the two cannot drift apart.

## Validation

```
npm install
npm run validate:contracts
```

The validator compiles every schema, validates every example, asserts every
negative fixture is refused for its recorded reason, and applies the cross-field
rules. It exits non-zero on any failure.
