/**
 * Simple illustrative time-back view.
 *
 * REQ-MET-001  REQ-MET-002  REQ-SCOPE-007  ADR-20260812-004
 *
 * The one demonstration view required by SQUAD_BOOTSTRAP.md section 6. It renders
 * baseline duration, assisted duration, illustrative time returned, draft outcome,
 * and approval coverage.
 *
 * Every figure is produced by src/governance/metrics.mjs from the organization
 * pack, validated against contracts/schemas/illustrative-metric.schema.json before
 * it is rendered, and printed with the `ILLUSTRATIVE` label on the same line as the
 * number. A metric that does not carry the label, the flags, and the disclaimer is
 * refused rather than rendered.
 *
 * There is no measured-outcome surface in this module. It cannot render a figure
 * that is not labelled.
 */

import { computeIllustrativeMetric, sampleBasisNote } from '../governance/metrics.mjs';
import { validateAgainstSchema } from '../governance/validate-payload.mjs';

const METRIC_SCHEMA_ID =
  'https://contracts.second-shift-accelerator.example/v1/illustrative-metric.schema.json';

const LABEL = 'ILLUSTRATIVE';

function refuse(detail) {
  const err = new Error(detail);
  err.failClosedCode = 'E-OUTPUT-SCHEMA-INVALID';
  err.isFailClosed = true;
  return err;
}

/**
 * Build the illustrative time-back metric for a completed run and validate it.
 *
 * @param {object} params
 * @param {object} params.orgConfig — loaded organization pack
 * @param {string} params.correlationId
 * @param {'accepted-as-drafted'|'revised-before-approval'|'rejected'|'pending'} params.draftOutcomeStatus
 * @param {{ approvedCount: number, totalCount: number }} params.approvalCoverage
 * @param {number} [params.assistedDurationMinutes] — defaults to the pack figure
 * @param {string} [params.metricId] — defaults to the pack prefix
 * @returns {object} validated illustrative metric
 * @throws {Error} E-CONFIG-MISSING | E-OUTPUT-SCHEMA-INVALID
 */
export function buildTimeBackMetric(params) {
  const {
    orgConfig, correlationId, draftOutcomeStatus,
    approvalCoverage, assistedDurationMinutes, metricId,
  } = params;

  const prefix = orgConfig?.illustrativeMetrics?.metricIdPrefix ?? 'MET-TIMEBACK';
  const resolvedMetricId = metricId ?? `${prefix}-01`;

  const metric = computeIllustrativeMetric(orgConfig, resolvedMetricId, {
    correlationId,
    assistedDurationMinutes,
    draftOutcomeStatus,
    approvalCoverage,
  });

  const { valid, errors } = validateAgainstSchema(metric, METRIC_SCHEMA_ID);
  if (!valid) {
    throw refuse(
      `illustrative metric failed contract validation: ${
        (errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ')
      }`
    );
  }

  assertIllustrative(metric);
  return metric;
}

/**
 * Refuse to render anything that is not labelled as an illustrative sample.
 *
 * @param {object} metric
 * @throws {Error} E-OUTPUT-SCHEMA-INVALID
 */
export function assertIllustrative(metric) {
  if (metric?.metricLabel !== LABEL) throw refuse('metric is not labelled ILLUSTRATIVE');
  if (metric.illustrative !== true) throw refuse('metric.illustrative is not true');
  if (metric.notForClinicalUse !== true) throw refuse('metric.notForClinicalUse is not true');
  if (!metric.disclaimerText?.startsWith(LABEL)) throw refuse('metric carries no illustrative disclaimer');
}

/**
 * Render the view as plain text. Every numeric line carries the label.
 *
 * @param {object} metric — validated illustrative metric
 * @param {object} orgConfig
 * @returns {string}
 */
export function renderTimeBackView(metric, orgConfig) {
  assertIllustrative(metric);

  const coverage = metric.approvalCoverage;
  const rows = [
    ['Baseline workflow duration', `${metric.baselineDurationMinutes} min`],
    ['Assisted workflow duration', `${metric.assistedDurationMinutes} min`],
    ['Time returned', `${metric.illustrativeTimeReturnedMinutes} min`],
    ['Draft outcome', metric.draftOutcomeStatus],
    ['Approval coverage', `${coverage.approvedCount}/${coverage.totalCount} (${coverage.coveragePercent}%)`],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = [];

  lines.push(`${metric.metricName} — ${LABEL}`);
  lines.push(`Organization: ${orgConfig?.organizationName ?? metric.organizationId}`);
  if (metric.periodLabel) lines.push(`Period: ${metric.periodLabel}`);
  lines.push(`Correlation: ${metric.correlationId ?? '(none)'}`);
  lines.push('');
  for (const [label, value] of rows) {
    lines.push(`  ${label.padEnd(width)}  ${value}  [${LABEL}]`);
  }
  lines.push('');
  lines.push(`  ${metric.disclaimerText}`);
  lines.push(`  ${sampleBasisNote(orgConfig)}`);

  return lines.join('\n');
}
