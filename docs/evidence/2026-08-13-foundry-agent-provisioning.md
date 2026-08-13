# Foundry agent provisioning and live-evaluation attempt — 2026-08-13

Owner: Neo — Foundry Agent Engineer. Issue #6, work package WP-05, BLOCKER-003.
Governing charter: `SQUAD_BOOTSTRAP.md` (human-owned, read only).

This file records the commands run to provision an isolated Microsoft Foundry
project, create the Shift Closeout Prompt Agent, and attempt live evaluation,
plus their actual results. All Azure identifiers (subscription, tenant,
resource names, project endpoint, agent ID) are intentionally omitted per the
task's security constraints; only resource **types**, **configuration facts**,
and **counts** are recorded here.

## Verdict

**Isolated Foundry infrastructure and the single Prompt Agent are provisioned
and verified.** The agent has exactly zero tools attached and its instructions
match the versioned, digest-pinned repository file exactly.

**Live behavioral evaluation could not be executed.** Every agent-mediated
invocation attempt returned HTTP 429 `rate_limit_exceeded`. Diagnostic calls
prove the model deployment itself is healthy; the failure is caused by the
requested deployment capacity (`GlobalStandard`, capacity `1`) being too small
to admit even one request that includes this agent's stored system
instructions. **BLOCKER-003 remains open** — see `docs/risks.md` for the
updated evidence and the human decision now required.

## Environment

| Item | Value |
|---|---|
| Project/env name | `second-shift-p0-dev` |
| Region | `eastus2` |
| IaC root | `infra/foundry/` (azd, template `Azure-Samples/azd-ai-starter-basic`) |
| Prompt model | `gpt-4.1-mini`, version `2025-04-14` |
| Deployment SKU / capacity | `GlobalStandard` / `1` |
| Agent name | `shift-closeout-agent` |

## Provisioning commands and actual results

| # | Command | Result |
|---|---|---|
| 1 | `azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic . -e second-shift-p0-dev --subscription <redacted> -l eastus2 --no-prompt` (run inside `infra/foundry`) | Scaffolded `azure.yaml` and `infra/**` from the template. No nested `.git` created. |
| 2 | `azd env set` (×5) for `AI_PROJECT_DEPLOYMENTS`, `ENABLE_HOSTED_AGENTS=false`, `ENABLE_CAPABILITY_HOST=false`, `AZD_AGENT_SKIP_ACR=true`, `ENABLE_MONITORING=true` | Environment configured for the exact model/version/SKU/capacity and for hosted agents, capability host, and ACR to be disabled |
| 3 | `az cognitiveservices usage list` (region quota check) | `OpenAI.GlobalStandard.gpt4.1-mini`: 5000 TPM limit, 0 used at the time — ample headroom for the requested capacity of 1 |
| 4 | `AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd provision --preview --no-prompt` | What-if plan showed exactly: resource group, Foundry account, model deployment, Foundry project, Foundry project→App Insights connection, Application Insights, Log Analytics. No ACR, no capability host, no hosted-agent resources. |
| 5 | `AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd provision --no-prompt` | Succeeded after 4 attempts. A recurring ARM deployment-tracking issue (see below) required 3 `az deployment group cancel` + retry cycles before the 4th attempt completed cleanly in 2m38s. |
| 6 | Direct `az`/`az rest` verification of every resource (bypassing azd's own tracking) | Resource group, Foundry account (`AIServices`/`S0`), Foundry project, model deployment (`gpt-4.1-mini`/`2025-04-14`/`GlobalStandard`/capacity `1`), Log Analytics, Application Insights, and the project↔App Insights connection all show `Succeeded`/no error |
| 7 | `az acr list` (scoped to the resource group) | Empty — confirms no Azure Container Registry |
| 8 | Capability host check via `az rest` on the project resource | Empty array — confirms no capability host |

### Operational note — ARM deployment-tracking flakiness (not a resource defect)

The nested `ai-project` deployment's connection sub-resource
(`Microsoft.CognitiveServices/accounts/projects/connections`, API version
`2025-10-01-preview`) was created successfully within about a minute every
time (`az rest` GET showed `error: null`), but the **wrapping ARM deployment
operation** repeatedly reported `provisioningState: Running` indefinitely,
causing `azd provision` to hang. This is a cosmetic ARM tracking issue, not a
functional resource problem: direct resource queries were authoritative and
confirmed the resource was healthy at every attempt. Workaround used:
`az deployment group cancel` followed by a retry, 2–3 cycles, succeeding
cleanly on the final attempt. Recorded here as an operational risk for anyone
re-running this provisioning in the future — not a blocker.

## Prompt Agent creation

Created with `agent/deployment/create_prompt_agent.py` using the
`azure-ai-projects` SDK v2 preview and `DefaultAzureCredential` (Foundry MCP
tools were not advertised in this session; used the documented SDK fallback
path).

Pre-creation guard: the script recomputes the SHA-256 of
`agent/instructions/shift-closeout/v1.0.0/system.md` and aborts before calling
the service if it does not equal `manifest.json#instructionSha256`. Digest
matched: `f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96`.

Redacted post-creation verification (from `agent/deployment/manifest.created.json`,
committed; the raw SDK response with any identifiers stays in
`agent/deployment/.local/`, gitignored, local machine only):

```json
{
  "agentName": "shift-closeout-agent",
  "kind": "prompt",
  "modelDeploymentName": "gpt-4.1-mini",
  "toolsAttached": [],
  "temperature": 0.0,
  "instructionVersion": "1.0.0",
  "instructionSha256": "f9020da9288314426d3481c281233442e7359a2f893608aa5fb87fc85b401f96",
  "agentVersion": "1"
}
```

Additional verification performed directly against the raw local SDK response
(values only, never identifiers):

| Check | Result |
|---|---|
| Exactly one agent exists in the project | Pass — `client.agents.list()` returned exactly one agent before creation (zero), and the created agent is the only one afterward |
| `status` | `active` |
| `draft` | `false` |
| `definition.kind` | `prompt` |
| `definition.model` | `gpt-4.1-mini` (exact match to the requested deployment) |
| `definition.temperature` | `0` |
| `tools` key present on `definition` | **No** — the key itself is absent, not merely an empty array |
| Live instructions SHA-256, recomputed from the stored `definition.instructions` string | Matches manifest digest exactly |

This directly answers the tool/retrieval portion of BLOCKER-003: no web
search, Bing grounding, file search, Azure AI Search, MCP, memory, or code
interpreter tool is attached to this agent.

## Live invocation attempts and diagnosis

| # | Call | Result |
|---|---|---|
| 1 | Agent-mediated, `extra_body={"agent": {...}}` | HTTP 400 `invalid_payload` — the `agent` key is deprecated by the service; corrected to `agent_reference` |
| 2 | Agent-mediated, `extra_body={"agent_reference": {...}}`, full example input + synthetic bundle as input text (~3,400 chars) | HTTP 429 `rate_limit_exceeded` |
| 3 | Same, after a 65s wait | HTTP 429 `rate_limit_exceeded` (unchanged) |
| 4 | Same, minimal `"ping"` input text, after a further 60s wait | HTTP 429 `rate_limit_exceeded` (confirms the failure is independent of my payload size) |
| 5 | Direct model call, **no** agent reference, `input="ping"`, `max_output_tokens=16` | **Succeeded.** `usage: input_tokens=8, output_tokens=2, total_tokens=10`, `output_text: "pong"` — proves the model deployment and credentials are healthy |
| 6 | Agent-mediated, minimal `"ping"` input, `max_output_tokens=16` explicitly capped | HTTP 429 `rate_limit_exceeded` — proves the bottleneck is the ~4,000-token stored system instructions loaded server-side for every agent-mediated call, not my input or the requested output length |

Deployment rate-limit configuration, read directly from
`az cognitiveservices account deployment show` (values only):

| Key | Count | Renewal period |
|---|---|---|
| `request` | 1 | 60 seconds |
| `token` | 1000 | 60 seconds |

**Root cause.** The Shift Closeout Agent's stored system instructions are
approximately 4,000 tokens. Every agent-mediated call must process at least
that many input tokens before considering the caller's own input. At capacity
`1` (`GlobalStandard`), the deployment admits at most 1,000 tokens per 60
seconds — below the instruction size alone. No amount of waiting resolves
this: it is a structural mismatch between the authorized capacity and this
agent's instruction length, not a transient burst limit. This was confirmed by
issuing a direct (non-agent) call that succeeds trivially, isolating the
problem to the agent-mediated code path specifically.

**Conclusion.** Live evaluation (the smoke invocation and the bounded live
suite covering valid structured draft, source grounding, unsupported-fact
refusal, prompt-injection refusal, prohibited-clinical-recommendation
refusal, draft/safety constants, and malformed/schema output handling) could
not be run. No live output was produced, so none was validated, and none is
reported as passing. Per the task's explicit instruction, capacity was not
increased and the model/region/SKU were not substituted without human
approval — this is recorded as an open blocker requiring a human decision
instead.

## Files changed for this work

See the pull request description for the full file list. Summary: `infra/foundry/**`
(new azd scaffold, excluding gitignored `.azure/`), `agent/deployment/**`
(creation/invocation scripts and the redacted `manifest.created.json`),
`.gitignore` updates, and the documentation/evidence/traceability updates
listed in `docs/risks.md` and `docs/traceability/requirements-matrix.md`.

## Next executable task

A human must decide between:

1. Approve a capacity increase for the `gpt-4.1-mini` `GlobalStandard`
   deployment (a capacity supporting roughly 6,000–8,000+ TPM would
   comfortably cover the ~4,000-token instructions plus a typical input
   bundle and output) so live evaluation can run, or
2. Accept the current capacity for cost control and treat BLOCKER-003 as
   answered only for the tool/retrieval-configuration question (fully
   verified, evidenced above), leaving the live behavioral-evaluation portion
   of WP-05 open indefinitely, or
3. Approve a shorter/condensed instruction variant for a future instruction
   version (out of scope for this issue: the shipped instruction text is a
   governed, digest-pinned asset and was not modified here).

This decision is not made unilaterally here. Live resources remain running
and billable; see `docs/risks.md` BLOCKER-003 for the cost/cleanup note.
