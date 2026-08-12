# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture and integration | Trinity | Contracts, ADRs, dependency order, integration, final technical review |
| Healthcare workflow and story | Switch | Nursing authenticity, terminology, StoryBrand narrative, demo flow |
| Copilot Studio workflow | Tank | Conversation flow, context confirmation, approval UX, exceptions, packaging |
| Foundry Shift Closeout Agent | Neo | Instructions, structured output, grounding, versions, evaluations, tracing |
| Data, security, quality, and metrics | Morpheus | Synthetic FHIR, privacy, schemas, audit, threat tests, dashboard data |
| Code and contract review | Trinity | Cross-component review, scope-lock enforcement, integration acceptance |
| Safety and responsible AI review | Rai | Clinical-safety boundaries, content safety, privacy and harm checks |
| Claim and assumption verification | Fact Checker | External claims, unsupported facts, counter-hypotheses, pre-mortems |
| Testing | Morpheus | Unit, integration, wrong-patient, malformed-output, injection, approval-bypass tests |
| Scope and priorities | Trinity | Option A trade-offs, blocker escalation, ADR proposals |
| Session logging | Scribe | Automatic — never needs routing |
| RAI review | Rai | Content safety, bias checks, credential detection, ethical review |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.
8. **Bootstrap authority** — `SQUAD_BOOTSTRAP.md` overrides generated Squad state and agent guidance.
9. **Contract-first gate** — Trinity accepts shared contracts before implementation fans out.
10. **Single-writer integration** — Trinity owns shared integration files; agents receive non-overlapping file scopes.
11. **Affected-work blockers only** — `BLOCKER-*` conditions stop only impacted work and require evidence, safe options, recommendation, and an exact human decision.
