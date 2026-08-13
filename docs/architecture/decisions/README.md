# Architecture decision records

Durable architecture decisions for the Second Shift accelerator, in the format
defined by `SQUAD_BOOTSTRAP.md` section 9. Concise shared memory lives in
`.squad/decisions.md`; these records carry the reasoning.

The baseline records were accepted at the Design Review on 2026-08-12 with
participants Switch, Tank, Neo, and Morpheus. Later records name their own
decision date and evidence. Trinity integrates and owns the ADR set.

| ID | Title | Status | Owner | Primary requirement IDs |
|---|---|---|---|---|
| [ADR-20260812-001](ADR-20260812-001.md) | Contract-first baseline gates all implementation | Accepted | Trinity | REQ-VAL-001, REQ-VAL-004 |
| [ADR-20260812-002](ADR-20260812-002.md) | Correlation identifier format and single minting authority | Accepted | Trinity | REQ-AUD-001, REQ-AGT-005 |
| [ADR-20260812-003](ADR-20260812-003.md) | The P0 output contract has no recommendation surface | Accepted | Trinity | REQ-SAFE-002, REQ-AGT-003 |
| [ADR-20260812-004](ADR-20260812-004.md) | Draft label, lifecycle status, and safety status stay separate | Accepted | Trinity | REQ-SAFE-001, REQ-APPR-001 |
| [ADR-20260812-005](ADR-20260812-005.md) | camelCase field naming across all shared contracts | Accepted | Trinity | REQ-VAL-001 |
| [ADR-20260812-006](ADR-20260812-006.md) | Configuration and environment values are separated by schema | Accepted | Trinity | REQ-CFG-001 through REQ-CFG-005 |
| [ADR-20260812-007](ADR-20260812-007.md) | Approval attribution uses opaque actor references | Accepted | Trinity | REQ-APPR-002, REQ-AUD-002 |
| [ADR-20260812-008](ADR-20260812-008.md) | Deterministic validation runs outside the agent | Accepted | Trinity | REQ-SAFE-005, REQ-AGT-002 |
| [ADR-20260812-009](ADR-20260812-009.md) | Fail-closed markers are structural constants | Accepted | Trinity | REQ-SAFE-005, REQ-AUD-003 |
| [ADR-20260812-010](ADR-20260812-010.md) | Deferred capabilities appear only as FUTURE | Accepted | Trinity | REQ-SCOPE-008, REQ-SAFE-006 |
| [ADR-20260813-011](ADR-20260813-011.md) | Use the direct Copilot Studio connected-agent path | Accepted | Trinity | REQ-SCOPE-001, REQ-SCOPE-002, REQ-WF-003, REQ-SAFE-006 |

## Raising a new decision

1. Confirm the decision is durable and cross-cutting. A choice local to one
   component belongs in that component's notes, not here.
2. Draft the record with the next sequential number for the date, status
   `Proposed`, and the requirement IDs it affects.
3. Trinity accepts, rejects, or supersedes as integration owner. A record that
   relaxes a safety invariant in `SQUAD_BOOTSTRAP.md` cannot be accepted by
   Trinity and is escalated as a blocker with an exact human decision.
4. A superseding record names the record it replaces under `Supersedes:`, and the
   superseded record's status changes to `Superseded`.

## Related conventions

- `docs/conventions/correlation-id.md`
- `docs/conventions/draft-and-safety-status.md`
- `docs/conventions/prohibited-claims.json`
- `docs/traceability/requirements-matrix.md`
