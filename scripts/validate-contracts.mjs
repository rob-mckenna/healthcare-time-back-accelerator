/**
 * Validates the accepted shared contracts of the Second Shift Reduction Accelerator.
 *
 * 1. Compiles every JSON Schema under contracts/schemas.
 * 2. Validates every example against its contract.
 * 3. Asserts every negative fixture is refused for the expected reason.
 * 4. Applies cross-field rules a JSON Schema cannot express.
 *
 * Exit code 1 on any failure. See docs/plan/p0-execution-plan.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = process.cwd();
const SCHEMA_DIR = join(ROOT, 'contracts', 'schemas');
const EXAMPLE_DIR = join(ROOT, 'contracts', 'examples');
const INDEX_PATH = join(ROOT, 'contracts', 'contract-index.json');

const failures = [];
const checks = [];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

function record(name, ok, detail) {
  checks.push({ name, ok });
  if (!ok) failures.push(`${name}: ${detail}`);
}

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: false });
addFormats(ajv);

// --- 1. compile every schema -------------------------------------------------
const schemaFiles = walk(SCHEMA_DIR);
if (schemaFiles.length === 0) {
  failures.push('no schemas found under contracts/schemas');
}
for (const file of schemaFiles) {
  const rel = relative(ROOT, file).split(sep).join('/');
  try {
    ajv.addSchema(readJson(file));
    record(`compile ${rel}`, true);
  } catch (err) {
    record(`compile ${rel}`, false, err.message);
  }
}

const index = readJson(INDEX_PATH);
const schemaIdFor = (schemaFile) => {
  const doc = readJson(join(SCHEMA_DIR, schemaFile));
  return doc.$id;
};

function validatorFor(schemaFile) {
  const id = schemaIdFor(schemaFile);
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`schema not registered: ${id}`);
  return validate;
}

// --- 2. every example must satisfy its contract ------------------------------
for (const contract of index.contracts) {
  const name = `example ${contract.example} -> ${contract.schema}`;
  try {
    const validate = validatorFor(contract.schema);
    const data = readJson(join(EXAMPLE_DIR, contract.example));
    const ok = validate(data);
    record(name, ok, ok ? '' : JSON.stringify(validate.errors, null, 2));
  } catch (err) {
    record(name, false, err.message);
  }
}

// --- 3. every negative fixture must be refused for the expected reason -------
function errorMatches(errors, expect) {
  return errors.some((e) => {
    if (expect.missingProperty) return e.params?.missingProperty === expect.missingProperty;
    if (expect.additionalProperty) return e.params?.additionalProperty === expect.additionalProperty;
    if (expect.instancePath) return e.instancePath.startsWith(expect.instancePath);
    if (expect.keyword) return e.keyword === expect.keyword;
    return false;
  });
}

for (const fixture of index.negativeFixtures) {
  const name = `refuses ${fixture.fixture}`;
  try {
    const validate = validatorFor(fixture.schema);
    const data = readJson(join(EXAMPLE_DIR, fixture.fixture));
    const ok = validate(data);
    if (ok) {
      record(name, false, `fixture validated but must be refused (${fixture.reason})`);
    } else if (!errorMatches(validate.errors, fixture.expect)) {
      record(
        name,
        false,
        `refused for an unexpected reason. expected ${JSON.stringify(fixture.expect)}, got ${JSON.stringify(
          validate.errors.map((e) => ({ instancePath: e.instancePath, keyword: e.keyword, params: e.params }))
        )}`
      );
    } else {
      record(name, true);
    }
  } catch (err) {
    record(name, false, err.message);
  }
}

// --- 4. cross-field rules ----------------------------------------------------
const orgConfig = readJson(join(ROOT, 'config', 'organizations', 'harborlight', 'organization.json'));
const context = readJson(join(EXAMPLE_DIR, 'synthetic-context.example.json'));
const bundle = readJson(join(EXAMPLE_DIR, 'synthetic-source-bundle.example.json'));
const input = readJson(join(EXAMPLE_DIR, 'shift-closeout-agent-input.example.json'));
const output = readJson(join(EXAMPLE_DIR, 'shift-closeout-agent-output.example.json'));
const approval = readJson(join(EXAMPLE_DIR, 'approval-event.example.json'));
const audit = readJson(join(EXAMPLE_DIR, 'audit-event.example.json'));
const metric = readJson(join(EXAMPLE_DIR, 'illustrative-metric.example.json'));

const correlationIds = new Set([
  context.confirmation.correlationId,
  input.correlationId,
  output.correlationId,
  approval.correlationId,
  audit.correlationId,
  metric.correlationId
]);
record(
  'rule correlation-propagation',
  correlationIds.size === 1,
  `one correlation identifier must span the run, found ${[...correlationIds].join(', ')}`
);

record(
  'rule scope-echo',
  JSON.stringify(input.requestedScope) === JSON.stringify(output.requestedScope),
  'the agent output must echo the requested scope exactly'
);

record(
  'rule bundle-binding',
  input.sourceBundle.bundleId === bundle.bundleId &&
    input.sourceBundle.bundleSha256 === bundle.bundleSha256 &&
    output.provenance.sourceBundleId === bundle.bundleId &&
    output.provenance.sourceBundleSha256 === bundle.bundleSha256 &&
    approval.reconfirmedContext.sourceBundleSha256 === bundle.bundleSha256,
  'the request, the draft, and the decision must all bind to the same synthetic bundle digest'
);

record(
  'rule artifact-binding',
  approval.artifact.artifactId === output.artifactId &&
    approval.artifact.artifactSha256 === output.artifactSha256 &&
    approval.artifact.generationId === output.generationId,
  'an approval must bind to the exact artifact digest it decided on'
);

record(
  'rule context-reconfirmation-match',
  context.patient.syntheticPatientId === input.context.syntheticPatientId &&
    input.context.syntheticPatientId === output.context.syntheticPatientId &&
    output.context.syntheticPatientId === approval.reconfirmedContext.syntheticPatientId &&
    context.encounter.syntheticEncounterId === input.context.syntheticEncounterId &&
    input.context.syntheticEncounterId === output.context.syntheticEncounterId &&
    output.context.syntheticEncounterId === approval.reconfirmedContext.syntheticEncounterId,
  'the confirmed patient and encounter must be identical at confirmation, generation, and decision'
);

const bundleResourceIds = new Set(bundle.entries.map((e) => e.resourceId));
const referenced = [];
const collectRefs = (node) => {
  if (Array.isArray(node)) node.forEach(collectRefs);
  else if (node && typeof node === 'object') {
    if (Array.isArray(node.sourceReferences)) referenced.push(...node.sourceReferences);
    Object.values(node).forEach(collectRefs);
  }
};
collectRefs(output);
referenced.push(...output.sourceReferences);
const unresolved = referenced.filter((r) => !bundleResourceIds.has(r.resourceId));
record(
  'rule source-reference-resolution',
  referenced.length > 0 && unresolved.length === 0,
  `every source reference must resolve to the approved bundle, unresolved: ${JSON.stringify(
    unresolved.map((r) => r.resourceId)
  )}`
);

const metricArithmeticOk = (m) =>
  Math.abs(m.baselineDurationMinutes - m.assistedDurationMinutes - m.illustrativeTimeReturnedMinutes) < 1e-9 &&
  Math.abs((m.approvalCoverage.approvedCount / m.approvalCoverage.totalCount) * 100 - m.approvalCoverage.coveragePercent) <
    1e-9;

record('rule metric-arithmetic', metricArithmeticOk(metric), 'illustrative figures must be internally consistent');

for (const fixture of index.crossFieldFixtures) {
  const name = `rule ${fixture.rule} refuses ${fixture.fixture}`;
  const data = readJson(join(EXAMPLE_DIR, fixture.fixture));
  record(name, !metricArithmeticOk(data), `fixture passed the rule but must be refused (${fixture.reason})`);
}

record(
  'rule organization-config-is-example-only',
  orgConfig.organizationId === 'harborlight' && orgConfig.data.syntheticOnly === true,
  'the shipped organization pack must be the synthetic Harborlight example'
);

// The view derives illustrativeTimeReturnedMinutes from the pack, so the pack itself
// must not be able to declare a negative or impossible time-back figure.
const cfgMetrics = orgConfig.illustrativeMetrics ?? {};
record(
  'rule illustrative-metrics-config-arithmetic',
  typeof cfgMetrics.baselineDurationMinutes === 'number' &&
    typeof cfgMetrics.assistedDurationMinutes === 'number' &&
    cfgMetrics.assistedDurationMinutes <= cfgMetrics.baselineDurationMinutes &&
    cfgMetrics.metricLabel === 'ILLUSTRATIVE',
  'illustrativeMetrics must carry the ILLUSTRATIVE label and an assisted duration no greater than the baseline'
);

record(
  'rule illustrative-metrics-config-matches-example',
  cfgMetrics.baselineDurationMinutes === metric.baselineDurationMinutes &&
    cfgMetrics.assistedDurationMinutes === metric.assistedDurationMinutes,
  'the shipped organization pack and the illustrative metric example must quote the same sample figures'
);

// --- report ------------------------------------------------------------------
for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}`);
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} contract checks passed`);

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
