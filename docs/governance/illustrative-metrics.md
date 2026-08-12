# Illustrative Time-Back Metrics

**Owner:** Morpheus (Data, Security, and Quality Engineer)
**Requirement IDs:** REQ-MET-001, REQ-MET-002, REQ-SCOPE-007
**Work Package:** WP-07

---

> **ILLUSTRATIVE ONLY.** All figures produced by this module are simulated sample values derived from synthetic data. They are not measured patient, care-team, or organizational outcomes. They must not be presented as evidence of real time savings or used in clinical, operational, or financial decision-making.

---

## Summary

`src/governance/metrics.mjs` computes and returns a metric conforming to `contracts/schemas/illustrative-metric.schema.json`. The schema makes it structurally impossible to publish a figure from this accelerator without the `ILLUSTRATIVE` label, provenance, and disclaimer travelling with the value.

---

## Design constraints

1. **Every value carries the label.** `metricLabel: "ILLUSTRATIVE"`, `illustrative: true`, `notForClinicalUse: true`, and `disclaimerText` are all required fields. The schema enforces them as constants.

2. **Baseline comes from the organization pack.** `baselineDurationMinutes` is read from `orgConfig.illustrativeMetrics.baselineDurationMinutes`. It is never hardcoded in the metrics module. This keeps the figure under human configuration control and lets it change per-organization without code changes.

3. **Arithmetic is enforced.** `illustrativeTimeReturnedMinutes` must equal `baselineDurationMinutes - assistedDurationMinutes`. This is checked by `scripts/validate-contracts.mjs` via the `metric-arithmetic` cross-field rule.

4. **Data provenance is explicit.** `dataProvenance` is an enumeration with no value for a measured or observed outcome (`"synthetic-simulated"`, `"sample-composite"`, `"manually-authored"`, `"test-fixture"`).

---

## Metric fields

| Field | Type | Description |
|-------|------|-------------|
| `metricLabel` | `"ILLUSTRATIVE"` | Constant label. Schema enforces the constant value. |
| `illustrative` | `true` | Machine-readable flag. Survives extraction of the raw number. |
| `notForClinicalUse` | `true` | Constant safety flag. |
| `dataProvenance` | enum | Source characterisation. No value denotes a measured outcome. |
| `disclaimerText` | string (const) | Mandatory disclaimer text. Schema enforces the exact value. |
| `baselineDurationMinutes` | number | Duration before the assisted workflow. From the organization pack. |
| `assistedDurationMinutes` | number | Duration with the Shift Closeout Agent. Supplied by the caller. |
| `illustrativeTimeReturnedMinutes` | number | Derived: `baseline - assisted`. |
| `draftOutcomeStatus` | enum | Whether the draft was accepted, revised, rejected, or pending. |
| `approvalCoverage` | object | `{ approvedCount, totalCount, coveragePercent }` |

---

## Usage

```javascript
import { computeIllustrativeMetric } from './src/governance/metrics.mjs';

const metric = computeIllustrativeMetric(orgConfig, 'MET-TIMEBACK-01', {
  correlationId: 'CORR-20260812-...',
  assistedDurationMinutes: 9,
  draftOutcomeStatus: 'accepted-as-drafted',
  approvalCoverage: { approvedCount: 8, totalCount: 10 },
  periodLabel: 'Synthetic pilot week 1',
});
// metric.metricLabel === 'ILLUSTRATIVE'
// metric.illustrativeTimeReturnedMinutes === metric.baselineDurationMinutes - 9
```

---

## Configuration contract

`illustrativeMetrics` is a required block in
`contracts/schemas/organization-config.schema.json`. It carries the sample
figures and the note describing what they are, and nothing else. Environment
values and credentials never appear here; those stay in `environmentBindings` as
variable names.

| Field | Required | Rule |
|---|---|---|
| `metricLabel` | yes | Pinned to `ILLUSTRATIVE`. A pack cannot describe its figures as anything else. |
| `baselineDurationMinutes` | yes | 0 to 480 minutes. |
| `assistedDurationMinutes` | yes | 0 to 480 minutes, and never greater than the baseline. |
| `sampleBasisNote` | yes | 40 to 256 characters and must itself contain `ILLUSTRATIVE`, so the note cannot claim a measured outcome. |
| `metricIdPrefix` | no | `MET-` prefixed identifier stem for generated metric identifiers. |
| `periodLabel` | no | Human-readable period for the sample. |

Two cross-field rules in `scripts/validate-contracts.mjs` enforce the block:

- `illustrative-metrics-config-arithmetic` — the label is `ILLUSTRATIVE` and the
  assisted duration does not exceed the baseline.
- `illustrative-metrics-config-matches-example` — the pack figures match
  `contracts/examples/illustrative-metric.example.json`, so the documented example
  and the shipped pack cannot drift apart.

`contracts/examples/invalid/organization-config-illustrative-metrics-unlabelled.json`
proves the refusal: a pack whose `sampleBasisNote` claims measured results is
rejected at `/illustrativeMetrics/sampleBasisNote`.

If the block is absent, `computeIllustrativeMetric` fails closed with
`E-CONFIG-MISSING` rather than substituting a default figure.

---

## Rendering guidance

When rendering the metric in a dashboard or demonstration view, the following elements must be visible:

1. The word **ILLUSTRATIVE** adjacent to every figure.
2. The full `disclaimerText` value on the same screen or slide as the numbers.
3. A label that makes clear the figures are derived from synthetic data, not real care-team observation.

The view must not present these figures as evidence of a particular organization's time savings or as a projection of expected outcomes in a future deployment.

`src/view/time-back-view.mjs` is the implementation of that guidance. It validates
the metric against the contract, refuses to render anything that is not labelled,
prints `[ILLUSTRATIVE]` on the same line as every figure, and closes with the
disclaimer and the pack's `sampleBasisNote`.

---

## Validation

```bash
# Validates the illustrative-metric example and cross-field arithmetic rule
node scripts/validate-contracts.mjs

# Runs the governance check suite, including metric labelling assertions
node src/governance/test/run-governance-checks.mjs

# Validates documentation passes prohibited-claims check
node scripts/validate-docs.mjs

# Renders the view inside the complete local journey (milestone M6)
node scripts/run-local-journey.mjs
```
