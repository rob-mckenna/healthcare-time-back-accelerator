# Demonstration script — Second Shift Reduction Accelerator

**DRAFT — HUMAN REVIEW REQUIRED**

Requirement IDs: REQ-STORY-001, REQ-STORY-002, REQ-STORY-003, REQ-WF-001,
REQ-WF-002, REQ-WF-003, REQ-WF-004, REQ-WF-005, REQ-WF-006, REQ-SAFE-001,
REQ-SAFE-002, REQ-SAFE-004, REQ-SAFE-005, REQ-AUD-001, REQ-AUD-002,
REQ-AUD-003, REQ-MET-001, REQ-MET-002, REQ-SCOPE-008

Owner: Switch

---

## Purpose and governance

This script governs what is shown and said in every demonstration of the
Second Shift Reduction Accelerator. It is an outcome narrative, not a
product-feature tour. Demonstrations must follow this script; deviation
from it — particularly any deviation that asserts a deferred capability as
operational, presents ILLUSTRATIVE figures as measured, or removes a
fail-closed moment — is a scope violation.

**Synthetic data notice.** Every patient name, encounter identifier,
observation, and care-plan entry visible in this demonstration is synthetic.
It was created solely for this demonstration and does not represent any
real patient, staff member, or organization.

**Not a production system.** This is a reusable prototype and solution
pattern. Nothing in this demonstration writes to a system of record,
communicates with a patient or family, or constitutes a clinical record.

---

## Setting and persona

- **Organization:** Harborlight Children's Hospital (example configuration)
- **Unit:** Synthetic pediatric pilot unit
- **End user:** A Registered Nurse ending a 12-hour day shift
- **Leadership observer:** Chief Nursing Officer (approves the pilot)
- **Context:** End of shift, roughly 18:45. The nurse needs to complete a
  shift closeout before handing off to the night team.

---

## The six-step demonstration journey

The journey maps to the six milestones defined in the P0 execution plan:
M1 → M6. Each step shows an outcome, not a feature.

---

### Step 1 — The nurse requests a shift-closeout draft (M1)

**What happens on screen.**
The nurse opens the Harborlight Time Back to Care experience in Microsoft
Copilot Studio. She is already authenticated through her organization's
identity provider. She asks for a shift closeout.

The system mints exactly one correlation identifier for this run. The
nurse sees a short human-readable reference — for example `Ref b4c6` —
displayed at the top of the interaction.

**What the presenter says.**
> This is the moment the Second Shift starts. The nurse has finished twelve
> hours of direct patient care. Without this tool, she would now spend
> another 24 minutes or more composing the handoff from memory and
> from records she has to open individually. With this tool, she starts
> from a governed, organized draft that took seconds to generate.
>
> Notice the reference code in the corner. That code links every event in
> this run — request, draft, decision, and audit record — into a single
> retrievable thread.

**What this step proves.**
An unauthenticated request is refused at this step with `E-IDENTITY-MISSING`
and an audit event is recorded. That is shown in the fail-closed sequence
below, not elided.

---

### Step 2 — The nurse confirms the synthetic patient and encounter (M2)

**What happens on screen.**
Before the agent is invoked, the nurse is shown the synthetic patient and
encounter that will be used. She confirms both.

The identifiers shown carry `SYN-PAT-` and `SYN-ENC-` prefixes. A synthetic
data notice is displayed beneath the confirmation: "All patient and encounter
data shown here is synthetic and was created for demonstration purposes."

The system records a `preGenerationConfirmedAt` timestamp.

**What the presenter says.**
> Before anything is generated, the nurse confirms exactly who this draft is
> for. This step cannot be skipped. If the nurse skips it or if the context
> is missing, the run stops with a clear message. The draft is never produced
> for an unconfirmed subject.
>
> Notice the `SYN-` prefixes on every identifier. This is a structural
> reminder that the data is synthetic, not a cosmetic choice.

**What this step proves.**
Skipping the confirmation is refused with `E-CONTEXT-UNCONFIRMED` and
recorded as an audit event. That path is shown in the fail-closed sequence.

---

### Step 3 — The nurse receives a structured Foundry draft (M3)

**What happens on screen.**
The Microsoft Foundry Shift Closeout Agent reads the approved synthetic
source bundle and produces a structured draft containing:

- **Shift summary** — an organised account of the documented synthetic
  entries for the shift period, formatted using the Harborlight SBAR
  structure.
- **Handoff summary** — a handoff-ready organised summary, ending with the
  notice `PENDING HUMAN DECISION — no recommendation is generated`.
- **Open items** — a list of outstanding items transcribed from the
  synthetic source, each with a source reference.
- **Follow-up items** — items that need follow-up, transcribed from the
  synthetic source, each with a source reference.

The draft is displayed with the header `DRAFT — HUMAN REVIEW REQUIRED`
prominently visible. The full disclaimer body from the organization pack
is shown beneath the header.

The draft carries a `lifecycleStatus` of `DRAFT`. It cannot advance to
any other status without a recorded human decision.

**What the presenter says.**
> This is what we are demonstrating. In about the time it takes the nurse to
> sit down, the agent has organised the documented entries for the shift into
> a structured draft. Notice what is not in the draft: no diagnosis, no
> medication recommendation, no triage call, no assessment. Those sections
> do not exist in this system. The agent organises documented entries. It
> does not make clinical judgements.
>
> Notice the `DRAFT — HUMAN REVIEW REQUIRED` header. That label is fixed. It
> does not change if the nurse approves the draft. The record of approval
> lives in the audit trail, not in the label.
>
> Notice also the handoff section ends with: "PENDING HUMAN DECISION — no
> recommendation is generated." That is not a placeholder. That is the
> system's explicit statement of what it does not do.

**What this step proves.**
The draft validates against the output contract before rendering. A draft
that fails validation is refused with `E-OUTPUT-SCHEMA-INVALID` before the
nurse sees it.

---

### Step 4 — The nurse inspects the source references (M4)

**What happens on screen.**
Every section of the draft shows source references. The nurse taps a
reference and the underlying synthetic resource is shown: for example, the
synthetic Observation entry that documented the finding referenced in the
shift summary.

Every statement in the draft resolves to at least one reference in the
approved synthetic bundle. No statement appears without a traceable source.

**What the presenter says.**
> Every statement in this draft is traceable. The nurse does not have to
> trust that the agent got it right; she can open the source and verify it.
> This is not an accountability feature added for compliance. It is the
> primary quality control for a governed draft in a healthcare setting.
>
> If any section of a draft cannot be resolved to an approved source, the
> run stops with `E-GROUNDING-FAILURE` and that draft is never shown. We
> will see that in the fail-closed sequence.

---

### Step 5 — The nurse approves, rejects, or requests a revision (M5)

**What happens on screen.**
The nurse has three choices: Approve, Reject, or Request revision.

**5a — Approve path.**
Before approval, the system asks the nurse to confirm the synthetic patient
and encounter a second time. This `preApprovalConfirmedAt` confirmation
must match the original. The approval event binds to the exact artifact
digest and to the re-confirmed context.

The system records an approval event carrying the nurse's role code and
actor reference, the artifact digest, and the correlation identifier. No
display name or free-text identity value is written to the audit record.

`lifecycleStatus` moves to `APPROVED-SIMULATED`. Nothing is written to any
external system. Nothing is communicated to a patient or family. The suffix
`-SIMULATED` is visible and deliberate: this is a prototype approval record,
not a signed clinical document.

**5b — Reject path.**
The nurse selects Reject. The system requires a reason. Without a reason, the
rejection is refused. The nurse provides a reason; it is scanned before
recording. An audit event is produced carrying the correlation identifier and
fail-closed outcome.

**5c — Request revision path.**
The nurse selects Request revision and provides specific instructions. The
system allows up to three revision cycles, as configured in the Harborlight
organization pack. On the third refusal with no acceptance, the system
enforces `E-REVISION-LIMIT-REACHED` and stops the run.

**What the presenter says.**
> The nurse is in control at every point. The agent never advances its own
> status. The nurse approves, rejects, or asks for a revision. All three
> paths produce audit evidence.
>
> Notice that the approval does not say `APPROVED`. It says
> `APPROVED-SIMULATED`. In this prototype, nothing is written to a system of
> record. We are demonstrating the approval boundary, not claiming a
> production integration.
>
> Notice also that the revision loop is bounded. The organization pack sets
> a maximum of three revision cycles. When that limit is reached, the run
> stops rather than running indefinitely.

---

### Step 6 — The nurse inspects correlated approval and audit evidence (M6)

**What happens on screen.**
Using the short reference from Step 1 — for example `Ref b4c6` — the nurse
opens the correlated evidence view. A single query returns all events for
this run: the request, the generation, the approval decision, and the
outcome, in order.

Each event validates against the audit contract and carries the correlation
identifier. No event carries the draft narrative, patient name, or any
free-text clinical content. The evidence records what happened, not what was
said.

The illustrative time-back view shows:

| Metric | Value | Label |
|---|---|---|
| Baseline shift-closeout duration | 24 minutes | ILLUSTRATIVE |
| Assisted shift-closeout duration | 9 minutes | ILLUSTRATIVE |
| Time returned to care | 15 minutes | ILLUSTRATIVE |
| Draft outcome | Approved-Simulated | — |
| Approval coverage | 1 of 1 runs | — |

**These figures are ILLUSTRATIVE.** They are derived from a synthetic
example scenario and do not represent measured outcomes from any
organization. They are labeled on every value in the system.

**What the presenter says.**
> This is the evidence view. Every event in this run is retrievable by the
> same correlation reference the nurse saw at the start. The audit trail
> covers the request, the generation, the decision, and the outcome.
>
> The time-back figures — 24 minutes baseline, 9 minutes assisted, 15
> minutes returned — are ILLUSTRATIVE. They come from a synthetic example
> scenario, not from a measured deployment. Our claim is not "you will save
> 15 minutes." Our claim is "if a structured draft can be produced and
> reviewed in roughly 9 minutes, then a pilot that measures the actual
> duration is worth running." The pilot produces the number. This
> accelerator provides the governed tool to run the pilot.

---

## Fail-closed demonstration sequence

**This sequence must be shown in every full demonstration.** Showing only
the happy path misrepresents the safety posture of the system.

The fail-closed sequence may be shown before or after the main journey, but
it must be shown.

### FC-1 — Unauthenticated request

An unauthenticated session attempts to start a shift closeout. The system
stops with `E-IDENTITY-MISSING`. A configured user-safe message is shown.
No draft is produced. An audit event is recorded.

**What the presenter says.**
> This is the system refusing to proceed without identity. The nurse sees a
> configured message from the organization pack — not a raw error, not a
> stack trace. The run stops. Evidence is recorded.

### FC-2 — Skipped context confirmation

An authenticated nurse attempts to request generation without confirming the
patient and encounter. The system stops with `E-CONTEXT-UNCONFIRMED`. A
configured user-safe message is shown. No draft is produced.

**What the presenter says.**
> The system cannot be asked to generate a draft for an unconfirmed subject.
> This is not a validation warning. It is a stop condition.

### FC-3 — Grounding failure

The validation layer detects that a section of a draft cannot be resolved
to an approved synthetic source reference. The system stops with
`E-GROUNDING-FAILURE`. The draft is not shown. An audit event is recorded.

**What the presenter says.**
> The system will not show a draft it cannot trace. If the agent produced a
> statement that does not resolve to an approved synthetic source, the draft
> is refused — not flagged, not annotated, refused. The nurse never sees
> ungrounded content.

### FC-4 — Revision limit reached

The nurse has requested three revisions. The system enforces
`E-REVISION-LIMIT-REACHED`. The experience presents a configured user-safe
message and stops the run.

**What the presenter says.**
> The revision loop is bounded by configuration. When the limit is reached,
> the run does not continue. This is a deliberate design choice: an unbounded
> revision loop is an audit risk and a human-authority risk.

---

## Deferred capabilities — FUTURE

The following capabilities are explicitly deferred from P0 and are **not
implemented**. They must not be implied as operational in any demonstration.

| Capability | Status |
|---|---|
| Live EHR or FHIR API integration | `FUTURE` — not implemented |
| Production identity and role-claim enforcement | `FUTURE` — repository controls implemented; connected-tenant validation NOT RUN under RISK-020 |
| Write-back to any system of record | `FUTURE` — not implemented |
| Real patient data or PHI | Permanently out of scope for this prototype |
| Family or patient communication | Permanently out of scope |
| Medication reconciliation agent | `FUTURE` — not implemented |
| Discharge coordination agent | `FUTURE` — not implemented |
| Referral coordination agent | `FUTURE` — not implemented |
| Microsoft Fabric production pipeline | `FUTURE` — not implemented |
| Azure API Management production configuration | `FUTURE` — not implemented |
| Enterprise-scale infrastructure automation | `FUTURE` — not implemented |

The direct experience-to-agent path is selected by ADR-20260813-011, but direct
connected-agent validation is **NOT RUN** under RISK-020. Role-claim
authorization and identity-handoff controls are implemented and tested in the
repository, resolving BLOCKER-002 locally, but live tenant propagation is not
validated. The demonstration must distinguish these evidence boundaries
whenever a live binding is discussed.

---

## Roles and who may deliver this demonstration

This demonstration may be delivered by any team member who has read this
script in full. The following commitments apply to every delivery:

1. The ILLUSTRATIVE label is stated aloud wherever a time-back figure appears.
2. The fail-closed sequence is shown.
3. No deferred capability is implied as operational.
4. The synthetic nature of every patient and encounter is stated at the
   opening and whenever the data is referenced.
5. If a question cannot be answered without inventing a behaviour of a
   Microsoft product, the question is recorded and answered later with
   evidence rather than answered speculatively in the moment.

---

## Version

Document created: 2026-08-12. Charter source: `SQUAD_BOOTSTRAP.md` §2 and §3.
StoryBrand frame: `docs/narrative/storybrand.md`.
Conventions: `docs/conventions/draft-and-safety-status.md`,
`docs/conventions/correlation-id.md`.
This document is owned by Switch and must not be modified by other agents
without a Trinity-approved change request.
