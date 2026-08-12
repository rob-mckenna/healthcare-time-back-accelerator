# Correlation identifier convention

Requirement: `REQ-AUD-001`. Decision: `docs/architecture/decisions/ADR-20260812-002.md`.
Schema definition: `contracts/schemas/common/definitions.schema.json#/$defs/correlationId`.

## Format

```
CORR-YYYYMMDD-<32 lowercase hexadecimal characters>
```

Regular expression: `^CORR-\d{8}-[0-9a-f]{32}$`. Total length is always 46
characters. Example: `CORR-20260812-9f2a4c7d1b6e48a0b3c5d7e9f1a2b4c6`.

The date segment is the UTC date on which the run started. It exists so a human
reading audit evidence can bracket a run without a lookup, and so evidence can be
partitioned by day. The hexadecimal segment carries the uniqueness and must come
from a cryptographically strong random source, never from a counter, a
timestamp, or any value derived from patient, encounter, or user identity.

## Lifetime and ownership

One correlation identifier is minted per shift-closeout run. A run begins when an
authenticated user requests a draft and ends when the run reaches a terminal
outcome: approved, rejected, abandoned, or failed closed.

The care-team experience layer mints the identifier. Every other component
receives it and echoes it unchanged:

| Component | Responsibility |
|---|---|
| Care-team experience | Mints once per run, carries it through every turn, displays the short reference |
| Agent input | Receives `correlationId`, must not alter it |
| Agent output | Echoes `provenance.correlationId` identically |
| Approval event | Carries the same `correlationId` |
| Audit event | Carries the same `correlationId` on every event in the run |
| Illustrative metric | Carries the same `correlationId` for the run it summarises |

A component that receives a correlation identifier and emits a different one is a
fail-closed condition, not a warning. The rule `correlation-propagation` in
`scripts/validate-contracts.mjs` asserts identity across the example set.

## Revisions

A bounded revision loop stays inside one run and keeps the same correlation
identifier. Each generation attempt within the run gets its own
`generationId`, and each approval decision gets its own `approvalId`. This
lets audit evidence answer "how many drafts did this request take" without
fragmenting the run.

## User-visible short reference

Displaying 46 characters to a user at the end of a shift is unhelpful. The
experience layer displays the last eight hexadecimal characters as a short
reference, prefixed for clarity, for example `Ref b4c6` for the identifier above.
The short reference is for human conversation only. It is never used as a lookup
key, never stored as the correlation value, and never treated as unique.

## Prohibited content

The correlation identifier is treated as a low-sensitivity value that may appear
in logs, on screen, and in error messages. That is only safe while it encodes
nothing. It must never embed or derive from a patient identifier, an encounter
identifier, a user identifier, a tenant name, an organization name, or a
free-text field.
