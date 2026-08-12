# Approval and Audit Governance

**Owner:** Morpheus (Data, Security, and Quality Engineer)
**Requirement IDs:** REQ-APPR-001 to 003, REQ-AUD-001 to 003, REQ-SAFE-005, REQ-VAL-003
**Work Package:** WP-06

---

## Summary

This document describes the deterministic approval and audit governance layer implemented in `src/governance/`. The layer sits between the Shift Closeout Agent and the care team. It validates every draft before a human sees it and records every terminal outcome as a minimal, correlated audit event.

---

## Module inventory

| Module | Purpose |
|--------|---------|
| `src/governance/phi-scan.mjs` | Scans free text for PHI/PII (`scanText`) and prompt-injection patterns (`scanRevision`). The only implementation behind `decisionReasonScanned` and `revisionInstructionsSanitized` markers. |
| `src/governance/validate-payload.mjs` | Validates agent output in fixed order per ADR-20260812-008. Used on both the generation path and the approval path. |
| `src/governance/approval.mjs` | Creates approval events. Binds decision to `artifactSha256` and a second patient/encounter confirmation. Refuses mismatched context, missing reasons, and PHI-contaminated reasons. |
| `src/governance/audit.mjs` | Builds and emits minimal audit events. Fails closed on write failure with `E-AUDIT-WRITE-FAILURE`. Never logs and swallows. |
| `src/governance/metrics.mjs` | Computes illustrative time-back metrics. Reads baseline from the organization pack. Every value carries `metricLabel: "ILLUSTRATIVE"`. |

---

## Validation order (ADR-20260812-008)

Every agent output passes through four deterministic checks before reaching a human. A failure at any step emits the associated fail-closed code and stops the run.

| Step | Check | Fail-closed code |
|------|-------|-----------------|
| 1 | Output schema validation | `E-OUTPUT-SCHEMA-INVALID` |
| 2 | Safety assertions — all nine `safetyStatus` fields must be `true` | `E-SAFETY-FLAG` |
| 3 | Grounding resolution — every source reference resolves to the approved bundle | `E-GROUNDING-FAILURE` |
| 4 | Correlation echo — output `correlationId` must equal request `correlationId` | `E-OUTPUT-SCHEMA-INVALID` |

---

## Approval event design

An approval event binds a human decision to:

- The exact artifact SHA-256 (`artifactSha256`) — preventing replay against different content.
- A second, independently recorded patient and encounter confirmation (`reconfirmedContext`) — preventing approval of a draft generated for a different patient.
- The correlation identifier from the run — preserving the audit trail.

The approver block carries only `actorRef`, `roleCode`, and `authenticated`. No display name, email address, or user principal name is written to any approval or audit event.

### Lifecycle transitions

| Decision | `lifecycleStatus` | `statusLabel` |
|----------|-------------------|---------------|
| `approved` | `APPROVED-SIMULATED` | `APPROVED — SIMULATED FINALIZATION ONLY` |
| `rejected` | `REJECTED` | `REJECTED — NOT FOR USE` |
| `revision-requested` | `REVISION-REQUESTED` | `REVISION REQUESTED — DRAFT WITHDRAWN` |

`APPROVED-SIMULATED` explicitly marks the simulated nature of the finalization. This is a prototype; no artifact produced by this system constitutes a finalized clinical record.

### PHI scan on decision reasons

`createApprovalEvent` calls `scanText` on every decision reason before recording it. If the scan detects PHI or PII, the approval is refused with `E-SAFETY-FLAG` and the reason is not written. The `decisionReasonScanned: true` marker may only be set when `scanText` returns `passed: true`.

---

## Audit event design

Audit events are minimal. The schema (`contracts/schemas/audit-event.schema.json`) has `additionalProperties: false`, which structurally prevents narrative content, generated text, patient identifiers beyond `syntheticPatientId` and `syntheticEncounterId`, or any resolved identity from appearing.

### Write failure behaviour

A write failure must not be swallowed. `emitAuditEvent` returns `{ success: false, failClosedCode: 'E-AUDIT-WRITE-FAILURE' }` on any sink error. The caller is responsible for stopping the run when `success === false`.

```javascript
const result = await emitAuditEvent(event, sink);
if (!result.success) {
  // Stop the run — do not continue after a write failure.
  throw new Error(result.failClosedCode);
}
```

### Correlation

Every audit event carries the same `correlationId` minted by the experience layer at the start of the run. A single correlation identifier retrieves request, generation, decision, and outcome events for the same run.

---

## Validation

```bash
node scripts/validate-contracts.mjs
node src/governance/test/run-governance-checks.mjs
node scripts/scan-secrets.mjs
node --test tests/integration/wrong-patient.test.mjs
node --test tests/integration/approval-bypass.test.mjs
node --test tests/integration/schema-failures.test.mjs
```
