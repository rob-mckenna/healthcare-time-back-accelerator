# Talk track — Second Shift Reduction Accelerator

**DRAFT — HUMAN REVIEW REQUIRED**

Requirement IDs: REQ-STORY-001, REQ-STORY-002, REQ-STORY-003, REQ-SCOPE-008

Owner: Switch

---

## How to use this document

This is the spoken word for a live demonstration of the Second Shift
Reduction Accelerator. It is a companion to `demonstration-script.md`,
which governs what appears on screen at each step.

The talk track is written as spoken language, in a conversational register.
Use it as a guide, not a verbatim script — but do not deviate from the
outcome framing, the ILLUSTRATIVE labels on any time-back figure, the
fail-closed demonstrations, or the synthetic data disclosures.

**Audience.** Nursing leadership, healthcare operations leaders, and
executive sponsors who are evaluating whether to run a Time-Back Pilot.
They are not Microsoft customers evaluating a feature. They are clinicians
and operators asking whether their care team can get time back without
trading safety for efficiency.

---

## Opening — before the first screen (2 minutes)

> At the end of every shift, a nurse who has spent twelve hours at the
> bedside faces a second task. She has to assemble and transmit everything
> her colleague needs to carry the care forward. Not because she lacks
> skill. Because the tools available to her require a skilled person to spend
> skilled time on a task that is largely organisational. That second shift —
> the documentation burden at the end of the clinical shift — is what we
> are here to talk about.
>
> What you are about to see is a reusable prototype, not a production
> clinical system. Every patient and encounter in this demonstration is
> synthetic. No real patient data is involved, and nothing in this
> demonstration writes to a record, sends a message, or takes any clinical
> action.
>
> What we want you to leave with is one question: if a governed assistive
> draft could return even part of that second shift to your nurses, is that
> worth a controlled pilot to measure?

---

## Step 1 — The nurse requests a draft (M1)

> Here is the nurse, at the end of her shift. She opens the Harborlight Time
> Back to Care experience — this is a Microsoft Copilot Studio experience
> configured for Harborlight Children's Hospital. She is already
> authenticated through her organization's identity provider.
>
> She asks for a shift closeout. Notice the reference code in the corner of
> the experience. That code — four characters, in this case "b4c6" — ties
> every event in this run to a single retrievable thread. Request, draft,
> decision, audit record — all of them share that identifier.
>
> If the nurse had not been authenticated, or if her role was not in the
> authorized list, the system would have stopped here and shown a configured
> message. We will demonstrate that in a moment.

---

## Step 2 — The nurse confirms the patient and encounter (M2)

> Before anything is generated, the nurse is shown the synthetic patient
> and encounter this draft will be for. She confirms both.
>
> Notice the identifiers: they start with SYN-PAT and SYN-ENC. Those prefixes
> are structural. They are not cosmetic. They signal that every identifier in
> this system was created for this demonstration.
>
> The confirmation is also contractual. The system records the moment she
> confirmed. If she tries to approve a draft without re-confirming, the
> system will stop her. The subject of the draft and the subject of the
> approval must match.
>
> If she had tried to skip this step entirely, the system would have stopped
> with a clear message. We will show that too.

---

## Step 3 — The draft arrives (M3)

> This is what we are demonstrating. The Microsoft Foundry Shift Closeout
> Agent has read the approved synthetic source bundle and organised its
> entries into a structured draft.
>
> Look at the four sections: shift summary, handoff summary, open items,
> follow-up items. These are organised entries from the documented synthetic
> record. The agent did not add anything that is not in the source. It
> organised what was there.
>
> Notice what is absent. There is no assessment section. There is no
> recommendation. The handoff summary ends with the words "PENDING HUMAN
> DECISION — no recommendation is generated." That is not a placeholder
> waiting to be filled in. That is the system's permanent statement of what
> it does not do.
>
> Notice the header: "DRAFT — HUMAN REVIEW REQUIRED." That label will not
> change, even after the nurse approves. The approval lives in the audit
> trail. The label stays honest.
>
> Before this draft was shown to the nurse, it was validated against a
> contract. If it had failed that check, it would not have appeared here.

---

## Step 4 — The nurse checks the sources (M4)

> The nurse can see the source behind every statement. She taps a reference
> in the shift summary and sees the synthetic observation entry that was
> documented for this patient.
>
> This is the primary quality control for a governed draft. The nurse does
> not have to trust that the agent got it right. She can verify it. If any
> statement in the draft could not be traced to an approved source, the
> draft would not have appeared. The system stops on an ungrounded draft —
> it does not flag it, it refuses it.

---

## Step 5 — The nurse makes her decision (M5)

> The nurse has three choices: Approve, Reject, or Request revision. She is
> in control. The agent does not advance its own status.
>
> If she approves — watch what happens — she is asked to confirm the patient
> and encounter one more time. The approval binds to the exact text she is
> approving and to the confirmed subject. The system records a decision
> event.
>
> Notice the status: "APPROVED-SIMULATED." Not "APPROVED." The "-SIMULATED"
> suffix is deliberate. In this prototype, nothing is written to a system of
> record. We are demonstrating the approval boundary. When a production
> integration is in place, this is where the write would be bound — with the
> same human decision event, the same audit record, and the same traceability.
>
> If she rejects, she must provide a reason. The system will not record a
> rejection without one.
>
> If she asks for a revision, the loop is bounded. Three cycles, as
> configured for this organization. After the third request without an
> approval, the run stops rather than running indefinitely.

---

## Step 6 — The audit evidence and the time-back view (M6)

> Using the same reference code from the start — "b4c6" — the nurse can
> retrieve every event in this run. Request, generation, decision, outcome.
> Each event records what happened without recording the clinical content.
> The correlation holds the thread together.
>
> And here is the illustrative time-back view.

*[Show the view. Read the figures aloud from the screen, pausing on the label.
The figures below match the Harborlight example configuration; always read the
live on-screen values — they are the authoritative source for the organization
pack in use.]*

> Baseline shift-closeout duration: **24 minutes**. ILLUSTRATIVE.
> Assisted shift-closeout duration: **9 minutes**. ILLUSTRATIVE.
> Time returned to care: **15 minutes**. ILLUSTRATIVE.
>
> I want to be precise about what ILLUSTRATIVE means. These figures come from
> a synthetic example scenario. They are not measured outcomes from Harborlight
> or from any other organization. They are not a promise. They are the
> question.
>
> If a governed assistive draft can reduce the shift-closeout task to something
> in the range of 9 minutes — which is the question the pilot is designed to
> answer — then the 15 minutes returned to care is worth measuring. The pilot
> measures it. This accelerator gives you the governed tool to run the pilot.

---

## Fail-closed demonstrations

> Before we close, I want to show you the moments where the system says no.
> A demonstration that only shows the happy path is not an honest
> demonstration of a safety-sensitive tool.

*[Show FC-1: unauthenticated request.]*

> An unauthenticated session tries to start a shift closeout. The system
> stops. The nurse sees a plain message from the organization's configured
> copy. No raw error, no technical detail. The run stops and the evidence is
> recorded.

*[Show FC-2: skipped context confirmation.]*

> A nurse attempts generation without confirming the patient. The system
> stops. This is not a warning. It is a boundary.

*[Show FC-3: grounding failure.]*

> The validation layer finds a statement in the draft that cannot be traced
> to an approved source. The draft is refused. The nurse never sees it.

*[Show FC-4: revision limit.]*

> The nurse has used all three revision cycles. The system stops the run and
> presents a configured message. The audit record shows the outcome.

> Every one of these failure paths produces an audit event. The system does
> not silently swallow failures. They are all traceable to the same
> correlation reference.

---

## Closing — what you are being asked to consider (2 minutes)

> The Second Shift is the problem. The care team is who we are building for.
> The outcome we are pursuing is time back, with trust intact.
>
> This accelerator demonstrates one bounded workflow: shift closeout. One
> synthetic dataset. One human approval path. One audit trail. We have
> deliberately not built anything beyond that boundary, because the boundary
> is the point. A tool that is bounded, auditable, and honest about what it
> does not do is the tool that can earn a care team's trust.
>
> What we are asking you to consider is whether this bounded workflow is
> worth a controlled Time-Back Pilot. Not a production rollout. Not a
> commitment. A pilot, with real measurements, real staff, and the human
> review path you have just seen.
>
> Every system integation, every production connector, every organizational
> expansion is `FUTURE`. They are documented and planned, but they are not
> here yet. What is here is the governed core. It is enough to pilot.

---

## Things not to say

The following categories of statement must not appear in any demonstration,
Q&A, or follow-up communication:

- Any phrase that implies the agent makes clinical decisions.
- Any regulatory-compliance assertion — this prototype has no certified
  regulatory status and must not be represented as having one.
- Any suggestion that time-back figures are observed or measured rather
  than ILLUSTRATIVE figures from a synthetic example scenario.
- Any phrase that positions the draft agent as the decision-maker rather
  than the nurse.
- Any characterization of this accelerator as a finished or
  deployable system rather than a reusable prototype and solution pattern.
- Any suggestion that this tool displaces or replaces the clinical system
  of record.
- Any suggestion that an artifact can be approved without a recorded human
  decision event.
- Any deferred capability described in the present tense as if it operates.

The full list of banned exact phrases and their approved alternatives is in
`docs/conventions/prohibited-claims.json`. That file is enforced by
`npm run validate:docs` and is the authoritative source.

If an audience member asks about a capability that is deferred, the answer
is: "That is planned for a future phase. What we are showing today is the
governed core that you can pilot now."

---

## Version

Document created: 2026-08-12. Charter source: `SQUAD_BOOTSTRAP.md` §2.
StoryBrand frame: `docs/narrative/storybrand.md`.
Full script: `docs/demo/demonstration-script.md`.
This document is owned by Switch and must not be modified by other agents
without a Trinity-approved change request.
