/**
 * Illustrative time-back metric computation for the Shift Closeout workflow.
 *
 * IMPORTANT — ALL FIGURES ARE ILLUSTRATIVE.
 * These metrics are derived from synthetic-simulated sample data only.
 * They do not represent measured patient, care-team, or organizational outcomes.
 * Every value emitted by this module carries metricLabel: "ILLUSTRATIVE",
 * illustrative: true, and notForClinicalUse: true, per REQ-MET-001.
 *
 * Baseline figures come from the organization configuration pack, never from
 * this code, per REQ-MET-002 and the illustrative-metric contract.
 */

const DISCLAIMER_TEXT =
  'ILLUSTRATIVE ONLY — simulated sample figures from synthetic data. Not a measured patient, care-team, or organizational outcome.';

/**
 * Fail closed when the organization pack cannot supply the illustrative figures.
 * Annotated with the same two properties as src/orchestration/fail-closed.mjs so
 * the orchestration layer recognises it, without governance depending on the
 * experience layer.
 */
function configMissing(detail) {
  const err = new Error(detail);
  err.failClosedCode = 'E-CONFIG-MISSING';
  err.isFailClosed = true;
  return err;
}

/**
 * Compute an illustrative time-back metric.
 *
 * @param {object} orgConfig - Organization configuration pack
 * @param {string} metricId - Identifier matching pattern ^MET-[A-Z0-9-]{4,24}$
 * @param {object} params
 * @param {string} params.correlationId - Workflow run correlation identifier
 * @param {number} [params.assistedDurationMinutes] - Duration of the assisted run; defaults to the pack figure
 * @param {'accepted-as-drafted'|'revised-before-approval'|'rejected'|'pending'} params.draftOutcomeStatus
 * @param {{ approvedCount: number, totalCount: number }} params.approvalCoverage
 * @param {string} [params.periodLabel]
 * @returns {object} Illustrative metric conforming to illustrative-metric.schema.json
 * @throws {Error} E-CONFIG-MISSING when the pack carries no illustrativeMetrics figures
 */
export function computeIllustrativeMetric(orgConfig, metricId, params) {
  const {
    correlationId,
    assistedDurationMinutes,
    draftOutcomeStatus,
    approvalCoverage,
    periodLabel,
  } = params;

  const packMetrics = orgConfig?.illustrativeMetrics;
  if (!packMetrics || typeof packMetrics.baselineDurationMinutes !== 'number') {
    throw configMissing(
      'illustrativeMetrics.baselineDurationMinutes is missing from the organization pack; ' +
      'baseline figures are never supplied by code (REQ-MET-002)'
    );
  }

  const baselineDurationMinutes = packMetrics.baselineDurationMinutes;
  const assisted = assistedDurationMinutes ?? packMetrics.assistedDurationMinutes;
  if (typeof assisted !== 'number') {
    throw configMissing(
      'assistedDurationMinutes was not supplied and illustrativeMetrics.assistedDurationMinutes is absent'
    );
  }

  const illustrativeTimeReturnedMinutes = baselineDurationMinutes - assisted;
  if (illustrativeTimeReturnedMinutes < 0) {
    throw configMissing(
      'assisted duration exceeds the baseline; the illustrative time-back figure would be negative'
    );
  }

  const coveragePercent =
    approvalCoverage.totalCount > 0
      ? (approvalCoverage.approvedCount / approvalCoverage.totalCount) * 100
      : 0;

  const metric = {
    contractVersion: '1.0.0',
    metricLabel: 'ILLUSTRATIVE',
    illustrative: true,
    notForClinicalUse: true,
    dataProvenance: 'synthetic-simulated',
    disclaimerText: DISCLAIMER_TEXT,
    metricId,
    metricName:
      orgConfig?.terminology?.timeBackMetricLabel ?? 'Time returned to care',
    baselineDurationMinutes,
    assistedDurationMinutes: assisted,
    illustrativeTimeReturnedMinutes,
    draftOutcomeStatus,
    approvalCoverage: {
      approvedCount: approvalCoverage.approvedCount,
      totalCount: approvalCoverage.totalCount,
      coveragePercent,
    },
  };

  if (orgConfig?.organizationId) metric.organizationId = orgConfig.organizationId;
  if (correlationId) metric.correlationId = correlationId;
  const resolvedPeriodLabel = periodLabel ?? packMetrics.periodLabel;
  if (resolvedPeriodLabel) metric.periodLabel = resolvedPeriodLabel;

  return metric;
}

/**
 * The human-readable basis statement for the figures in this pack.
 * Rendered alongside the numbers so the ILLUSTRATIVE basis travels with the view.
 *
 * @param {object} orgConfig
 * @returns {string}
 */
export function sampleBasisNote(orgConfig) {
  const note = orgConfig?.illustrativeMetrics?.sampleBasisNote;
  if (!note) {
    throw configMissing('illustrativeMetrics.sampleBasisNote is missing from the organization pack');
  }
  return note;
}
