# StoryBrand narrative frame

**DRAFT — HUMAN REVIEW REQUIRED**

Requirement IDs: REQ-STORY-001, REQ-STORY-002, REQ-STORY-003, REQ-SCOPE-008

Owner: Switch

This document records the StoryBrand frame that governs all demonstration
narrative, talk tracks, and external communication for the Second Shift
Reduction Accelerator. Every demonstration asset must be traceable to and
consistent with this frame. No demonstration may contradict it by centering
a product, a technology, or a metric rather than the care team's outcome.

---

## The five StoryBrand elements — REQ-STORY-001

The following elements must be explicit and present in every demonstration of
this accelerator. They are not marketing copy; they are structural constraints.

### 1. Character — the hero

The care team is the hero.

The nurse ending a shift carries the weight of the Second Shift: the
administrative work that follows the clinical work and displaces time from
patients, colleagues, and rest. The nursing leader — represented in the
Harborlight example by the Chief Nursing Officer — carries the strategic
burden: how do we return time to care without sacrificing the accuracy and
accountability that patient safety requires?

The nurse and the leader want the same thing: time back, with trust intact.

Neither Microsoft nor any AI system is the hero of this story.

### 2. Problem — the Second Shift

The Second Shift is the problem.

At the end of every shift, a nurse who has spent hours delivering direct
patient care faces a second task: assembling, composing, and transmitting
the information a colleague needs to carry the care forward. This work is
necessary. It is also largely manual, repetitive, and performed under
fatigue.

The problem is not that nurses lack skill. The problem is that the current
tools require skilled people to spend skilled time on tasks a governed
assistive draft could organise.

The Second Shift is the antagonist. Not a rival technology, not the
incumbent system, and not the clinician's judgment. The administrative
burden is the thing to be reduced.

### 3. Guide — Microsoft capabilities

Microsoft capabilities are the guide.

A guide has a tool, a plan, and a record of earning trust in comparable
situations. Microsoft Copilot Studio provides the governed care-team
interaction. Microsoft Foundry provides the versioned, grounded, auditable
agent that organises documented synthetic entries into a structured draft.
The combination provides a path — not a destination.

The guide does not decide. The guide drafts. The nurse decides. That
boundary is not a limitation; it is the condition under which any care team
can trust the tool.

### 4. Plan — bounded, measured, scalable only through trust

The plan is to start with one bounded workflow, measure it against a
synthetic example scenario, and scale only what earns trust through human
review.

The plan has three explicit steps:

1. Run the shift-closeout workflow on one synthetic pilot unit.
2. Measure illustrative time-back figures against baseline.
3. Extend the workflow to additional settings only when the quality,
   accuracy, and review outcomes justify it.

Nothing in this plan operates on real patient data, writes to a system of
record, or takes a clinical action. The plan earns trust by being small
enough to verify fully.

### 5. Call to action — the Time-Back Pilot

Run a controlled Time-Back Pilot.

This accelerator is a reusable prototype and solution pattern built to
support that decision. It is not a commitment to a production system.
It is evidence that the workflow is bounded, auditable, and safe enough
to pilot.

---

## Failure and success — the stakes

**Failure:** Administrative burden continues to consume care-team time.
Nurses leave every shift carrying documentation work that should have taken
half the time. The Second Shift stays. The talent stays burnt out.

**Success:** Care teams recover measurable time — illustrated in this
prototype as an ILLUSTRATIVE figure derived from a synthetic example scenario
— while retaining full human authority over every generated draft. Nothing
is signed, nothing is filed, and nothing is communicated to a patient
without a recorded human decision.

---

## What this is not

The following must never appear in a demonstration or a document derived
from this frame:

- A claim that the AI makes clinical decisions.
- A figure presented as a measured outcome rather than an ILLUSTRATIVE
  estimate from a synthetic example.
- A suggestion that this accelerator is a replacement for the clinical
  system of record.
- A promise that outcomes will replicate in any given production environment.
- A reference to a deferred capability that implies it is operational.
  Every deferred item is marked `FUTURE` with an explicit statement that
  it is not implemented.

See `docs/conventions/prohibited-claims.json` for the enforced claim list.

---

## Relationship to Harborlight Children's Hospital

Harborlight Children's Hospital is the **example configuration** for this
accelerator. It provides a concrete, named scenario so that a demonstration
feels real rather than abstract. It does not represent a real organization.
All patient and encounter data used in demonstrations is synthetic and was
created solely for this purpose.

Every organization-specific value — name, persona, unit, terminology, and
brand — comes from a configuration pack. Replacing the Harborlight pack with
another organization's pack changes the names without changing the workflow,
the safety rules, or the agent logic.

---

## Version

Document created: 2026-08-12. Charter source: `SQUAD_BOOTSTRAP.md` §2.
This document is owned by Switch and must not be modified by other agents
without a Trinity-approved change request.
