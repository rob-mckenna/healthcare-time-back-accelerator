# Draft and safety status convention

Requirements: `REQ-SAFE-001`, `REQ-SAFE-002`, `REQ-SAFE-003`, `REQ-SAFE-005`,
`REQ-APPR-001`. Decisions: `docs/architecture/decisions/ADR-20260812-003.md`,
`docs/architecture/decisions/ADR-20260812-004.md`,
`docs/architecture/decisions/ADR-20260812-009.md`.

Three separate fields carry three separate meanings. Collapsing them into one
status is how a review gate quietly disappears, so they stay separate.

## 1. `draftStatus` — the immutable label on the artifact

```json
"draftStatus": "DRAFT — HUMAN REVIEW REQUIRED"
```

Defined as a `const` in
`contracts/schemas/common/definitions.schema.json#/$defs/draftStatus`. The
separator is an em dash (U+2014). There is no other permitted value, no empty
value, and no configuration override. An organization pack can add a longer
disclaimer body around it, but cannot replace or suppress the label
(`safetyCopy.mandatoryDraftPrefix` is itself a `const`).

Every generated artifact carries this label, in the payload and in every surface
that renders the artifact: the conversational canvas, any exported text, and any
copied block. If a surface cannot render the label, that surface does not render
the artifact.

The label never changes, including after approval. An approved artifact is a
draft that a human accepted; it is not a signed clinical document. The record of
acceptance lives in the approval event, not by mutating the label.

## 2. `lifecycleStatus` — where the artifact sits in the human review path

| Value | Meaning | Who may set it |
|---|---|---|
| `DRAFT` | Generated and awaiting a human decision | The agent, as a `const`; it can emit nothing else |
| `APPROVED-SIMULATED` | An authorized human accepted the draft in this prototype | Only an approval event |
| `REJECTED` | An authorized human rejected the draft with a reason | Only an approval event |
| `REVISION-REQUESTED` | An authorized human asked for a bounded revision | Only an approval event |

`APPROVED-SIMULATED` is deliberately not called `APPROVED`. Nothing is signed,
nothing is written to a system of record, and nothing leaves the prototype. The
suffix keeps that visible in evidence, in code, and in demonstrations.

The agent output schema pins `lifecycleStatus` to `DRAFT` with a `const`. The
negative fixture `contracts/examples/invalid/agent-output-self-approved-lifecycle.json`
proves an agent cannot emit an approved artifact. A transition therefore cannot
happen without an approval event carrying an authenticated actor, an authorized
role, the artifact digest, and a re-confirmed patient and encounter.

## 3. `safetyStatus` — machine-checkable assertions about the generated content

All nine fields are required on every agent output. Eight are booleans pinned to
`true`; a `false` value is not merely a warning, it is unrepresentable and the
payload is refused.

| Field | Assertion |
|---|---|
| `noDiagnosis` | The draft states no diagnosis |
| `noTreatmentOrMedicationRecommendation` | The draft recommends no treatment or medication |
| `noTriage` | The draft performs no triage or acuity assignment |
| `noClinicalRecommendation` | The draft contains no clinical recommendation of any kind |
| `noPatientOrFamilyCommunication` | Nothing is addressed to a patient or family member |
| `syntheticSourceOnly` | Every source was synthetic example data |
| `groundingComplete` | Every generated section resolves to approved source references |
| `groundingCoverageRatio` | Fixed at `1`; partial grounding is not an acceptable state |
| `externalRetrievalDisabled` | No external knowledge augmentation contributed to the draft |

The output contract has no `recommendation`, `assessment`, or `plan` property and
sets `additionalProperties: false`, so there is structurally nowhere to place a
recommendation even if the model produced one. See
`contracts/examples/invalid/agent-output-recommendation-section.json`.

`externalRetrievalDisabled` is an assertion made by the payload. It is only
trustworthy once the deployment configuration has been verified, which is tracked
as an open risk in `docs/risks.md`.

## Fail-closed codes

When any gate fails, the run stops and emits one of the codes in
`contracts/schemas/common/definitions.schema.json#/$defs/failClosedCode`:

`E-IDENTITY-MISSING`, `E-CONFIG-MISSING`, `E-CONTEXT-UNCONFIRMED`,
`E-INPUT-SCHEMA-INVALID`, `E-OUTPUT-SCHEMA-INVALID`, `E-GROUNDING-FAILURE`,
`E-SAFETY-FLAG`, `E-AGENT-TIMEOUT`, `E-AGENT-ERROR`,
`E-APPROVAL-WITHOUT-CONFIRMATION`, `E-REVISION-LIMIT-REACHED`,
`E-AUDIT-WRITE-FAILURE`.

Rules that apply to every code:

- The run stops. Nothing partial is shown as if it were a complete draft.
- An audit event is emitted carrying the code. An audit event of outcome
  `FAILED` or `BLOCKED` without a `failClosedCode` is refused; see
  `contracts/examples/invalid/audit-event-blocked-without-code.json`.
- The user sees the message configured in `safetyCopy.errorMessageOverrides`,
  never a raw exception, stack trace, endpoint, or payload fragment.
- `E-AUDIT-WRITE-FAILURE` is included deliberately: if evidence cannot be
  recorded, the run is not permitted to continue on the assumption that it went
  well.

## Confirmation gates

Patient and encounter are confirmed twice, and the two confirmations must match.

| Gate | Field | Failure code |
|---|---|---|
| Before generation | `context.preGenerationConfirmedAt` | `E-CONTEXT-UNCONFIRMED` |
| Before approval | `reconfirmedContext.preApprovalConfirmedAt` | `E-APPROVAL-WITHOUT-CONFIRMATION` |

The cross-field rule `context-reconfirmation-match` asserts that the patient and
encounter identifiers in the approval event equal those in the agent input, so a
user cannot approve a draft for a different subject than the one they requested.
