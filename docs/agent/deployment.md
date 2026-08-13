# Agent Deployment Guide

**Owner:** Neo — Foundry Agent Engineer
**Status:** Agent provisioned and verified (no tools attached). Live behavioral
evaluation ran 7/7 passing on 2026-08-13 after a human-authorized capacity
increase. BLOCKER-003 resolved.

---

> **BLOCKER-003 — Foundry external retrieval default must be verified and disabled.**
>
> **Resolved.** The tool/retrieval-configuration half was verified 2026-08-13
> (no tools attached, no hosted agents/capability host/ACR). The live
> behavioral-evaluation half ran after a human-authorized capacity increase
> (`GlobalStandard` capacity `1` → `10`) and all 7 bounded evaluation cases
> passed. See `docs/evidence/2026-08-13-foundry-agent-provisioning.md` and
> `docs/evidence/2026-08-13-foundry-live-evaluation.md`.

---

## Purpose

This document records the binding between the versioned Shift Closeout Agent
instruction set and a Microsoft Foundry agent deployment, and captures the
deployment configuration evidence required by ADR-20260812-008 and BLOCKER-003.

---

## P0 deployment target

| Item | Value |
|---|---|
| Agent name | `shift-closeout-agent` |
| Project/environment | `second-shift-p0-dev`, `eastus2` (isolated, non-production) |
| Model deployment | `gpt-4.1-mini`, version `2025-04-14`, SKU `GlobalStandard`, capacity `10` |
| Instruction version | 1.0.0 |
| Instruction SHA-256 | `f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96` (matches live agent definition, verified 2026-08-13) |
| Output contract version | 1.0.0 |
| Endpoint | environment value, never committed — resolved locally via `azd env get-values` in `infra/foundry/` |
| Agent ID | environment value, never committed |
| Tools attached | **None** — verified via SDK: the `tools` key is absent from the live agent definition (reverified after the 2026-08-13 capacity change) |
| Model config ref | `shift-closeout-agent-config-v1` — echoed by the model in every 2026-08-13 live-evaluation response, supplied to the model as a runtime-provenance constant (the model has no tool to look this value up itself) |

---

## Pre-deployment checklist (BLOCKER-003 gating)

The following items must be evidenced before any generated content is
demonstrated. Each item requires a screenshot or configuration export attached
to this document or its linked decision record.

- [x] External retrieval is disabled in the agent deployment configuration. —
  Verified 2026-08-13: no `tools` key on the live agent definition.
- [x] Knowledge augmentation / web search is disabled. — Same verification;
  no tool of any kind is attached.
- [x] No knowledge base or grounding data source other than the approved
  synthetic source bundle is connected. — Same verification.
- [x] The agent deployment endpoint and agent ID have been recorded in the
  environment bindings (not in this file or any committed file). — Recorded
  only in the local, gitignored azd environment state.
- [x] A test invocation with the example input returns output that validates
  against `shift-closeout-agent-output.schema.json` with a non-zero exit code
  from `node scripts/validate-contracts.mjs`. — **Done 2026-08-13.** After a
  human-authorized capacity increase (`1` → `10`), the `valid-structured-draft`
  live evaluation case produced a fully schema-valid output (25/25 validator
  checks). See `docs/evidence/2026-08-13-foundry-live-evaluation.md`.
- [x] `node agent/evaluation/run-grounding-evaluation.mjs` passes against the
  live invocation result (not the example set placeholder). — **Done
  2026-08-13** via the equivalent live-output validator,
  `agent/evaluation/validate-live-output.mjs` (same deterministic-check
  philosophy), for all 7 bounded live evaluation cases. See
  `agent/deployment/live-evaluation-results.json` and
  `docs/agent/grounding-evaluation.md`.

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

### Option C — SDK-driven load (used for this deployment, 2026-08-13)

`agent/deployment/create_prompt_agent.py` reads `system.md` directly from the
repository at creation time, verifies its SHA-256 against `manifest.json`
first (aborting on mismatch), and passes the file content verbatim as the
`instructions` field of a `PromptAgentDefinition` via the `azure-ai-projects`
SDK. This avoids any console paste step. The script also re-reads the created
agent's stored `instructions` value and recomputes its SHA-256, confirming an
exact match to the manifest digest before reporting success. See
`docs/evidence/2026-08-13-foundry-agent-provisioning.md` for the result.

---

## Environment bindings required

The following environment variable names are required. Values must be supplied at
runtime and must never be committed to the repository. See
`config/environments/.env.example` for the full checklist.

| Variable name | Purpose |
|---|---|
| `PROJECT_ENDPOINT` | Foundry project endpoint, consumed by `agent/deployment/create_prompt_agent.py` and `agent/deployment/invoke_agent.py`. Resolve locally via `azd env get-value AZURE_AI_PROJECT_ENDPOINT` in `infra/foundry/`; export for the current process only; never commit. |
| `MODEL_DEPLOYMENT_NAME` | Deployed model name, default `gpt-4.1-mini` |
| `FOUNDRY_PROJECT_ENDPOINT` | Legacy/general name for the same value, used by other tooling in this repository |
| `FOUNDRY_AGENT_ID` | Deployed agent identifier, if a caller needs to pin a specific agent (not required by `invoke_agent.py`, which resolves the agent by name) |
| `AZURE_REGION` | Azure region for the deployment (`eastus2` for this P0 instance) |

---

## Post-deployment evidence record

| Item | Evidence |
|---|---|
| External retrieval disabled | **Verified 2026-08-13.** No `tools` key present on the live agent definition (SDK query); reverified unchanged after the capacity increase. See `docs/evidence/2026-08-13-foundry-agent-provisioning.md`. |
| Knowledge augmentation disabled | **Verified 2026-08-13.** Same evidence — no tool of any kind attached. |
| Test invocation result | **Passed 2026-08-13.** After a human-authorized capacity increase (`GlobalStandard` `1` → `10`), all 7 bounded live evaluation cases produced schema-checkable output and passed through the deterministic validator. See `docs/evidence/2026-08-13-foundry-live-evaluation.md`. |
| Digest verification | **Verified 2026-08-13.** Live agent `definition.instructions`, recomputed, hashes to `f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96` — matches `manifest.json` exactly, both at creation and again after the capacity change. Every live-evaluation response also echoed this digest correctly. |
| Model config ref | **Recorded 2026-08-13.** `shift-closeout-agent-config-v1`, echoed correctly by the model in every live-evaluation response as a runtime-supplied provenance constant. |

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
- `docs/risks.md` §BLOCKER-003 (resolved), §RISK-019 (resolved)
- `docs/evidence/2026-08-13-foundry-agent-provisioning.md`
- `docs/evidence/2026-08-13-foundry-live-evaluation.md`
- `agent/instructions/shift-closeout/v1.0.0/manifest.json`
- `agent/deployment/create_prompt_agent.py`, `agent/deployment/invoke_agent.py`,
  `agent/deployment/verify_agent.py`, `agent/deployment/run_live_evaluation.py`
- `agent/evaluation/run-grounding-evaluation.mjs`,
  `agent/evaluation/validate-live-output.mjs`
- `docs/agent/grounding-evaluation.md`
