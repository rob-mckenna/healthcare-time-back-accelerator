# Agent Deployment Guide

**Owner:** Neo — Foundry Agent Engineer
**Status:** DRAFT — blocked pending BLOCKER-003 resolution

---

> **BLOCKER-003 — Foundry external retrieval default must be verified and disabled.**
>
> No demonstration of generated content proceeds until the Foundry agent
> deployment configuration is verified and the required evidence is attached here.
> See `docs/risks.md` §BLOCKER-003 for the required human decision.

---

## Purpose

This document records the binding between the versioned Shift Closeout Agent
instruction set and a Microsoft Foundry agent deployment, and captures the
deployment configuration evidence required by ADR-20260812-008 and BLOCKER-003.

---

## P0 deployment target

| Item | Value |
|---|---|
| Agent name | Shift Closeout Agent |
| Instruction version | 1.0.0 |
| Instruction SHA-256 | `f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96` |
| Output contract version | 1.0.0 |
| Endpoint | `{{FOUNDRY_PROJECT_ENDPOINT}}` — environment value, never committed |
| Agent ID | `{{FOUNDRY_AGENT_ID}}` — environment value, never committed |
| Model config ref | To be recorded after deployment, format `^[A-Za-z0-9._-]{3,128}$` |

---

## Pre-deployment checklist (BLOCKER-003 gating)

The following items must be evidenced before any generated content is
demonstrated. Each item requires a screenshot or configuration export attached
to this document or its linked decision record.

- [ ] External retrieval is disabled in the agent deployment configuration.
- [ ] Knowledge augmentation / web search is disabled.
- [ ] No knowledge base or grounding data source other than the approved
  synthetic source bundle is connected.
- [ ] The agent deployment endpoint and agent ID have been recorded in the
  environment bindings (not in this file or any committed file).
- [ ] A test invocation with the example input returns output that validates
  against `shift-closeout-agent-output.schema.json` with a non-zero exit code
  from `node scripts/validate-contracts.mjs`.
- [ ] `node agent/evaluation/run-grounding-evaluation.mjs` passes against the
  live invocation result (not the example set placeholder).

---

## Instruction loading

The versioned instruction file must be loaded verbatim by the Foundry agent.

### Option A — direct file reference (preferred)

If the Foundry deployment platform supports loading a system instruction from a
repository file reference, point it to:

```
agent/instructions/shift-closeout/v1.0.0/system.md
```

Verify that the platform loads the file without modification. Confirm by
checking that `provenance.agentInstructionSha256` in the output matches the
digest in `manifest.json`.

### Option B — verbatim copy

If the platform requires the instruction content to be pasted into a console
field:

1. Copy the full content of
   `agent/instructions/shift-closeout/v1.0.0/system.md` verbatim.
2. Paste into the system instruction field.
3. After deployment, verify that the digest of the pasted content matches
   `manifest.json#instructionSha256`.
4. Record the verification result below.

**Warning:** A console-only instruction load breaks reproducibility for any draft
produced before the evidence is recorded. This option is acceptable only if
Option A is not supported by the platform, and the verification must be
completed before any output is demonstrated.

---

## Environment bindings required

The following environment variable names are required. Values must be supplied at
runtime and must never be committed to the repository. See
`config/environments/.env.example` for the full checklist.

| Variable name | Purpose |
|---|---|
| `FOUNDRY_PROJECT_ENDPOINT` | Foundry project endpoint for agent invocation |
| `FOUNDRY_AGENT_ID` | Deployed agent identifier |
| `AZURE_REGION` | Azure region for the deployment |

---

## Post-deployment evidence record

_To be completed after BLOCKER-003 is resolved._

| Item | Evidence |
|---|---|
| External retrieval disabled | PENDING — attach screenshot or config export |
| Knowledge augmentation disabled | PENDING — attach screenshot or config export |
| Test invocation result | PENDING — attach validated output JSON |
| Digest verification | PENDING — record actual provenance.agentInstructionSha256 |
| Model config ref | PENDING — record after deployment |

---

## Versioning a new instruction release

1. Create a new version directory:
   `agent/instructions/shift-closeout/vX.Y.Z/`
2. Copy and modify `system.md`.
3. Recompute the SHA-256 and update `manifest.json`.
4. Update the previous version's `manifest.json` to `status: SUPERSEDED`.
5. Update this document's instruction version and SHA-256 fields.
6. Redeploy and re-run the pre-deployment checklist.

See `docs/agent/instruction-versioning.md` for the full versioning protocol.

---

## References

- ADR-20260812-008 — Deterministic validation runs outside the agent
- ADR-20260812-009 — Fail-closed markers are structural constants
- `docs/risks.md` §BLOCKER-003
- `agent/instructions/shift-closeout/v1.0.0/manifest.json`
- `agent/evaluation/run-grounding-evaluation.mjs`
- `docs/agent/grounding-evaluation.md`
