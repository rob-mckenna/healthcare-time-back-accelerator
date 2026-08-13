#!/usr/bin/env python3
"""Read-only post-change verification for the `shift-closeout-agent` Prompt Agent.

Used after any Azure-side change (e.g. a model deployment capacity update) to
confirm, without mutating anything, that:

  1. Exactly one agent exists in the project, named `shift-closeout-agent`.
  2. Its latest version is still `kind: "prompt"`.
  3. It still has **no tools attached** (no `tools` key, or an empty list).
  4. It still targets the expected model deployment.

This script performs no writes to Azure. It only reads and prints a redacted
summary (no project endpoint, no agent/version IDs). Required environment
variable: PROJECT_ENDPOINT (never committed; resolved locally via
`azd env get-values` in `infra/foundry/`).

Usage:
  python agent/deployment/verify_agent.py
"""

from __future__ import annotations

import json
import os
import sys

AGENT_NAME = "shift-closeout-agent"
MODEL_DEPLOYMENT_NAME = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4.1-mini")


def fail(message: str) -> None:
    print(f"ABORT: {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    endpoint = os.environ.get("PROJECT_ENDPOINT")
    if not endpoint:
        fail("PROJECT_ENDPOINT is not set. Resolve it locally and export it for this process only.")

    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential

    client = AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())

    agents = list(client.agents.list())
    names = sorted({a.name for a in agents})
    if names != [AGENT_NAME]:
        fail(f"expected exactly one agent named {AGENT_NAME!r}, found: {names}")

    # Read-only: list versions (newest first) and inspect the latest one.
    # Does not create a new version and does not mutate the agent.
    versions = list(client.agents.list_versions(AGENT_NAME, order="desc"))
    if not versions:
        fail(f"agent {AGENT_NAME!r} has no versions")
    version = versions[0]
    version_dict = version.as_dict() if hasattr(version, "as_dict") else dict(version)
    definition = version_dict.get("definition", {})

    kind = definition.get("kind")
    tools = definition.get("tools")
    model = definition.get("model")
    agent_version = version_dict.get("version")

    problems = []
    if kind != "prompt":
        problems.append(f"kind is {kind!r}, expected 'prompt'")
    if tools not in (None, []):
        problems.append(f"tools is {tools!r}, expected none")
    if model != MODEL_DEPLOYMENT_NAME:
        problems.append(f"model is {model!r}, expected {MODEL_DEPLOYMENT_NAME!r}")
    if problems:
        fail("post-change verification failed: " + "; ".join(problems))

    redacted = {
        "agentCount": len(agents),
        "agentName": AGENT_NAME,
        "kind": kind,
        "modelDeploymentName": model,
        "toolsAttached": tools or [],
        "agentVersion": agent_version,
        "verified": True,
    }
    print("[ok] agent verified after Azure-side change (no tools, correct kind/model):")
    print(json.dumps(redacted, indent=2))


if __name__ == "__main__":
    main()
