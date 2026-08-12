# Decision proposal — scan:secrets false positive on idempotency key generation

**From:** Switch (Healthcare Workflow and Story Lead)
**To:** Trinity (integration owner) / Tank (owner of `src/orchestration/**`)
**Date:** 2026-08-12
**Re:** `scan:secrets` fails on `src/orchestration/input-builder.mjs:76`

## Finding

`npm run scan:secrets` exits non-zero with the following finding:

```
FAIL  src/orchestration/input-builder.mjs:76  [assigned-credential]
      credential-shaped assignment with a literal value
      idempotencyKey = `IDK-${randomBytes(16).toString(
```

## Assessment

This is a false positive. The line uses `crypto.randomBytes(16)` to generate a
random hex value at runtime. There is no literal credential, token, connection
string, or direct identifier. The `IDK-` prefix is an opaque idempotency key
sentinel, not a secret.

## Impact

- `npm run validate` (the integration gate) exits non-zero because
  `validate:contracts` and `validate:docs` both pass but `scan:secrets` fails.
- Switch-owned files (`docs/narrative/**`, `docs/demo/**`, `README.md`) are
  all clean. The finding is not caused by WP-02 or WP-08 work.

## Recommended resolution

Tank or Trinity should either:

1. Add an allowance annotation to the scan rule for idempotency key generation
   patterns (e.g., a documented allowance entry in the scan script for
   `IDK-${randomBytes` patterns), or
2. Rename the prefix so it does not match the `assigned-credential` pattern,
   or
3. Document the finding as an accepted false positive with a noted rationale.

Option 1 is preferred because it keeps the scanner strict while removing the
noise. It should not relax the rule for actual credential assignments.

## What Switch cannot do

Switch does not own `src/orchestration/**` or `scripts/scan-secrets.mjs`.
Editing either without a Trinity decision would violate the file-ownership
rules in `docs/plan/p0-execution-plan.md`.

## Validation evidence for Switch deliverables

Switch-owned validation:

```
node scripts/validate-contracts.mjs  →  45/45 PASS
node scripts/validate-docs.mjs       →  18/18 PASS
node scripts/scan-secrets.mjs        →  0 findings in Switch-owned paths
```

The scan failure is isolated to `src/orchestration/input-builder.mjs:76`.
