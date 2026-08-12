# Configuration

Configuration is the only place organization-specific values live. Core agent
instructions, workflow logic, shared schemas, and shared interface components
must read every organization value from here.

## Layout

| Path | Contents | Committed |
|---|---|---|
| `config/organizations/<organization-id>/organization.json` | An organization pack validated against `contracts/schemas/organization-config.schema.json` | Yes |
| `config/environments/.env.example` | Environment variable names and placeholder shapes | Yes |
| `.env` | Real environment values for one environment | No, git-ignored |

## Separation of template, configuration, and environment values

There are three distinct layers, and they never mix.

1. **Template values.** Tokens defined in `SQUAD_BOOTSTRAP.md` section 4, plus
   the naming conventions accepted in `docs/architecture/decisions/ADR-20260812-005.md`
   and the separation rules in `docs/architecture/decisions/ADR-20260812-006.md`.
   These are placeholders inside copy, instructions, and interface components.
2. **Configuration values.** Concrete values for one organization, held in an
   organization pack. Harborlight Children's Hospital is the shipped example.
3. **Environment values.** Endpoints, region, tenant-scoped identifiers, and
   credentials. These are supplied at run time from the environment.

An organization pack resolves environment values through its
`environmentBindings` block, which carries the **name** of an environment
variable and never its value. The contract enforces this with a pattern that
only matches an environment variable name, so committing an endpoint, an
identifier, or a secret into a pack fails validation rather than passing
review. `contracts/examples/invalid/organization-config-embedded-endpoint.json`
is the executable proof.

## What belongs in a pack

Everything an organization needs to say in its own words: names, personas,
terminology, branding, care setting, safety copy and error messages, operational
limits such as `operations.maxRevisions`, and the `illustrativeMetrics` sample
figures shown in the time-back view.

`illustrativeMetrics` carries `metricLabel` pinned to `ILLUSTRATIVE`, a baseline
and assisted duration, an optional metric identifier prefix and period label, and
a `sampleBasisNote` that must itself contain the word `ILLUSTRATIVE`. A pack that
describes its figures as measured results is refused; see
`contracts/examples/invalid/organization-config-illustrative-metrics-unlabelled.json`
and `docs/governance/illustrative-metrics.md`. Nothing environment-specific and no
credential ever belongs in this block, or anywhere else in a pack.

## Adding another organization

1. Create `config/organizations/<organization-id>/organization.json`.
2. Populate every required token. Validation fails when a required value is
   missing, so an incomplete pack cannot silently fall back to Harborlight.
3. Ask Trinity to register the pack in `contracts/contract-index.json` so it is
   validated alongside the example. `contracts/` is written only by the
   integration owner.
4. Change nothing in agent instructions, workflow logic, or shared schemas.

## Validation

```powershell
npm run validate:contracts
npm run scan:secrets
```
