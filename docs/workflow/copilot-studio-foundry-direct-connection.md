# Direct Copilot Studio → Microsoft Foundry connection specification

**Owner:** Trinity — revision owner
**REQ IDs:** REQ-WF-001 through REQ-WF-007, REQ-SCOPE-001,
REQ-SCOPE-002, REQ-SAFE-001 through REQ-SAFE-006
**WP:** WP-04
**Status:** Target binding selected. Direct connected-agent validation
**NOT RUN**.

## Decision boundary

[ADR-20260813-011](../architecture/decisions/ADR-20260813-011.md) selects
Copilot Studio's preview **Agents → Add an agent → Connect to an external
agent → Microsoft Foundry** path for the single Shift Closeout Agent. Power
Automate is not part of the target invocation path.

Issue #6 is resolved: the isolated Foundry agent was provisioned and its
bounded live evaluation passed. That evidence does not show that a Copilot
Studio connection has been created or tested. Direct connected-agent
validation remains **NOT RUN**.

## Official product claims

Official source:
[Connect to a Microsoft Foundry agent (preview)](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-foundry-agent)
(`ms.date: 2026-02-13`, reviewed 2026-08-13).

The source supports only the following claims used by this specification:

- A Copilot Studio custom agent can connect to a Microsoft Foundry agent so
  the main agent can call it to respond to a user or trigger.
- The feature is preview and powered by the standard harness.
- Setup starts from **Agents → Add an agent**, then **Connect to an external
  agent → Microsoft Foundry**.
- A new connection requires the Foundry project endpoint URL.
- Setup asks for Name, Description, and Agent Id.
- Only agents created in the new Microsoft Foundry portal can be connected;
  an agent from the previous portal produces a `404 - Version not found`
  error.
- The connected agent can be tested after it is added.
- The implementer remains responsible for data handling, quality, permissions,
  boundaries, approvals, observability, identity, traceability, and human
  oversight.

The source does **not** define:

- how the repository's JSON input contract is supplied to the connected agent;
- how a structured JSON response is returned to or parsed by the topic;
- connector timeout, retry, or error-to-code semantics;
- end-user Entra identity or role-claim propagation; or
- enforcement of this accelerator's safety, grounding, approval, or audit
  controls.

Those items below are accelerator requirements and test objectives, not
Microsoft product claims.

## Supported setup sequence

1. In the Copilot Studio main agent, open **Agents** and select
   **Add an agent**.
2. Under **Connect to an external agent**, select **Microsoft Foundry**.
3. Select an existing connection or create one with the environment-supplied
   `{{FOUNDRY_PROJECT_ENDPOINT}}`.
4. Select **Next**.
5. Enter a specific Name and Description for the Shift Closeout Agent.
6. Enter the environment-supplied `{{FOUNDRY_AGENT_ID}}`.
7. Adjust the description if needed and select **Add Agent**.
8. Test the connected agent in the target tenant.

Both environment values remain uncommitted. The Foundry agent must be the
single agent created in the new Foundry portal.

## Accelerator request and response boundary

The repository already defines
`contracts/schemas/shift-closeout-agent-input.schema.json` and
`contracts/schemas/shift-closeout-agent-output.schema.json`. The direct
connection does not by itself prove that Copilot Studio can transport these
envelopes unchanged.

Before the live binding is accepted:

1. The topic must authenticate and authorize the requester independently.
2. The topic must confirm the synthetic patient and encounter.
3. An authored adaptation must supply only the validated, minimum-necessary
   input required by the deployed agent.
4. The returned content must be adapted into the output contract.
5. The deterministic validator must run schema, safety, grounding, and
   correlation checks before any draft is rendered.
6. If the authoring surface cannot preserve the required contract, the run
   must fail closed; the contract must not be weakened to fit unverified
   connector behavior.

The exact adaptation mechanism and observed request/response shape are
deliberately left open until the direct connected-agent test runs.

## Identity and authorization boundary

No cited documentation states that requester identity, role claims, or
authorization context propagate through the Foundry connection.

Therefore:

- `System.AuthenticateUser` and the `roleCode` authorization gate remain
  prerequisites to invocation.
- `actorRef` is produced by the accelerator's identity guard and never inferred
  from the connection.
- A missing or unauthorized requester ends the topic with
  `E-IDENTITY-MISSING`.
- BLOCKER-002 remains independent of this connection decision.

## Preserved invariants

- `DRAFT — HUMAN REVIEW REQUIRED` appears on every rendered artifact.
- Patient and encounter are confirmed before generation and before approval.
- No diagnosis, treatment, triage, medication recommendation, chart write,
  communication, or production action is introduced.
- Human approval is the only path to `APPROVED-SIMULATED`.
- Output that fails schema, safety, grounding, or correlation validation is
  refused in full.
- Audit evidence remains minimal and attributable.

## Fail-closed handling requirements

The following are accelerator handling requirements. They are not assertions
about the connector's native error taxonomy.

| Observed condition | Accelerator result |
|---|---|
| Connection cannot be used or Agent Id cannot be resolved | `E-AGENT-ERROR` |
| Invocation exceeds the configured experience timeout | `E-AGENT-TIMEOUT` |
| Returned content cannot be adapted to the output schema | `E-OUTPUT-SCHEMA-INVALID` |
| Safety assertions fail | `E-SAFETY-FLAG` |
| Source references do not resolve | `E-GROUNDING-FAILURE` |
| Correlation value is absent or mismatched | `E-OUTPUT-SCHEMA-INVALID` |
| Authorization context is absent before invocation | `E-IDENTITY-MISSING` |

No partial draft is rendered after any failure.

## Direct connected-agent validation plan — NOT RUN

1. Confirm the existing new-portal Foundry agent and instruction version.
2. Create the Microsoft Foundry connection in the target Copilot Studio tenant.
3. Add the agent with the project endpoint, Name, Description, and Agent Id.
4. Record the actual authoring mechanism used to provide the validated synthetic
   request.
5. Record the actual response shape and adaptation into the output contract.
6. Exercise authorized and unauthorized roles; the unauthorized path must not
   invoke the connected agent.
7. Exercise valid output and each applicable fail-closed path.
8. Record redacted evidence without endpoint, tenant, subscription, Agent Id,
   credentials, or payload content.

Until this sequence runs, the direct Copilot Studio connected-agent status is
**NOT RUN**.

## Related artifacts

- [Direct connected-agent architecture](../architecture/copilot-studio-foundry-direct-connection.md)
- [ADR-20260813-011](../architecture/decisions/ADR-20260813-011.md)
- `workflow/copilot-studio/shift-closeout-topic.md`
- `workflow/copilot-studio/shift-closeout-topic.yaml`
- `docs/risks.md`
- `docs/assumptions.md`
- `docs/evidence/2026-08-13-foundry-live-evaluation.md`
