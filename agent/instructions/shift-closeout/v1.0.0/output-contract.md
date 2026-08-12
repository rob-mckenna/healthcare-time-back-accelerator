# Shift Closeout Agent — Output Contract Reference v1.0.0

This document is a human-readable companion to
`contracts/schemas/shift-closeout-agent-output.schema.json`. It is scoped to what
the agent must know to produce valid output. It is not the authoritative contract;
the JSON Schema is. In a conflict the JSON Schema governs.

---

## Required top-level structure

```jsonc
{
  "contractVersion": "1.0.0",
  "generationId":    "GEN-…",               // echo of input.requestId
  "correlationId":   "CORR-YYYYMMDD-…",     // echo unchanged
  "idempotencyKey":  "IDK-…",               // echo of input.idempotencyKey
  "generatedAt":     "2026-…Z",             // UTC timestamp of this generation
  "organizationId":  "harborlight",          // echo of input.organizationId
  "artifactId":      "ART-…",               // new, unique per artifact
  "artifactVersion": "1.0.0",
  "artifactSha256":  "<64 hex chars>",       // set by the validation layer, not the agent
  "draftStatus":     "DRAFT — HUMAN REVIEW REQUIRED",   // CONST
  "lifecycleStatus": "DRAFT",                            // CONST
  "safetyStatus":    { … },                 // see §Safety status
  "provenance":      { … },                 // see §Provenance
  "context":         { … },                 // see §Context
  "requestedScope":  […],                   // echo of input.requestedScope
  "sourceReferences": […],                  // master deduplicated list
  "disclaimer":      { … },                 // see §Disclaimer
  // sections: shiftSummary, handoffSummary, openItems, followUpItems
  //   — present only when listed in requestedScope
}
```

---

## Safety status (all fields required, all values constant)

```jsonc
"safetyStatus": {
  "noDiagnosis":                         true,  // CONST
  "noTreatmentOrMedicationRecommendation": true, // CONST
  "noTriage":                            true,  // CONST
  "noClinicalRecommendation":            true,  // CONST
  "noPatientOrFamilyCommunication":      true,  // CONST
  "syntheticSourceOnly":                 true,  // CONST
  "groundingComplete":                   true,  // CONST
  "groundingCoverageRatio":              1      // CONST
  // externalRetrievalDisabled: set by deployment config, not the agent
}
```

If any assertion would be `false`, stop generation and return `E-SAFETY-FLAG`.

---

## Provenance

```jsonc
"provenance": {
  "agentInstructionVersion": "1.0.0",
  "agentInstructionSha256":  "<sha256 from manifest.json>",
  "outputContractVersion":   "1.0.0",
  "modelConfigRef":          "<opaque deployment ref — no URL, key, or secret>",
  "sourceBundleId":          "<echo of input.sourceBundle.bundleId>",
  "sourceBundleSha256":      "<echo of input.sourceBundle.bundleSha256>"
}
```

`modelConfigRef` must match `^[A-Za-z0-9._-]{3,128}$`. Never embed an endpoint,
connection string, or credential here.

---

## Context

```jsonc
"context": {
  "syntheticPatientId":  "<echo of input.context.syntheticPatientId>",
  "syntheticEncounterId": "<echo of input.context.syntheticEncounterId>",
  "shiftPeriodLabel":    "<echo of input.shiftPeriod.label if present>",
  "careSettingLabel":    "<from org config — not hardcoded>"
}
```

---

## Sections (present only if in requestedScope)

### shiftSummary

```jsonc
"shiftSummary": {
  "structureLabel":   "<org config handoff structure name — optional>",
  "narrative":        "<1–2000 chars — organised documented facts, no recommendation>",
  "sourceReferences": [ /* ≥1 entries, each resolving to the approved bundle */ ]
}
```

### handoffSummary

```jsonc
"handoffSummary": {
  "narrative":        "<1–2000 chars — documented entries for receiving team, no recommendation>",
  "receivingRoleLabel": "<org config — optional>",
  "pendingHumanDecisionNotice": "PENDING HUMAN DECISION — no recommendation is generated",  // CONST
  "sourceReferences": [ /* ≥1 entries */ ]
}
```

### openItems (array of objects)

```jsonc
{
  "itemId":                 "ITM-OPEN01",
  "description":            "<1–512 chars — transcribed from source, no advisory language>",
  "sourceResourceType":     "Task",               // optional FHIR resource type
  "documentedPriorityLabel": "<from source only>", // optional — agent never assigns
  "sourceReferences":       [ /* ≥1 */ ]
}
```

### followUpItems (array of objects)

```jsonc
{
  "itemId":                    "ITM-FUP001",
  "description":               "<1–512 chars — transcribed from source>",
  "documentedAssignedRoleLabel": "<from source — optional>",
  "documentedDueLabel":         "<from source — optional>",
  "sourceReferences":           [ /* ≥1 */ ]
}
```

---

## Source reference object

```jsonc
{
  "resourceType":    "Task",               // one of the 9 permitted FHIR types
  "resourceId":      "SYN-TSK-TSK00001",  // must exist in the approved bundle
  "resourceVersion": "1.0.0",             // optional
  "fieldPath":       "/description",      // RFC 6901 JSON Pointer
  "fieldLabel":      "Task description",  // 1–128 chars
  "statementExcerpt": "…"                 // optional ≤256 chars
}
```

---

## Disclaimer

```jsonc
"disclaimer": {
  "mandatoryPrefix": "DRAFT — HUMAN REVIEW REQUIRED",  // CONST
  "body":            "<40–512 chars — states synthetic origin, no clinical standing, review required>",
  "syntheticDataNotice": "<20–256 chars — optional>"
}
```

---

## Schema constraints to respect

- `additionalProperties: false` at every level. An unknown property name is an
  immediate schema failure.
- `lifecycleStatus` is pinned to `"DRAFT"` by `const`. The agent cannot emit an
  approved artifact.
- `groundingCoverageRatio` is pinned to `1` by `minimum: 1` and `maximum: 1`.
  Partial grounding produces no output, not a lower-ratio output.
- Every `openItems` and `followUpItems` entry must have at least one
  `sourceReference`. An item without a reference is an ungrounded statement.

---

## Fail-closed code reference

| Code | When |
|---|---|
| `E-IDENTITY-MISSING` | Requester not authenticated |
| `E-CONTEXT-UNCONFIRMED` | `preGenerationConfirmedAt` absent |
| `E-INPUT-SCHEMA-INVALID` | Input fails the input contract |
| `E-OUTPUT-SCHEMA-INVALID` | Generated output fails the output contract |
| `E-GROUNDING-FAILURE` | A statement cannot be sourced or a reference does not resolve |
| `E-SAFETY-FLAG` | Any `safetyStatus` assertion would be `false` |
| `E-AGENT-TIMEOUT` | Agent did not return within the configured deadline |
| `E-AGENT-ERROR` | Agent returned a non-parsable or structurally invalid response |
