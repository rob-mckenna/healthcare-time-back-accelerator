#!/usr/bin/env python3
"""Reusable helper to invoke the `shift-closeout-agent` Prompt Agent.

Uses the `azure-ai-projects` SDK v2 preview fallback path (Foundry MCP tools
are not advertised in this session), per
`microsoft-foundry/foundry-agent/invoke/invoke.md` and
`microsoft-foundry/foundry-agent/create/references/sdk-operations.md`:

    client.get_openai_client().responses.create(
        model=<deployment>,
        input=<text>,
        extra_body={"agent": {"name": agent_name, "type": "agent_reference"}},
    )

This module never prints or persists the project endpoint or agent/response
identifiers. It returns plain text; callers are responsible for structured,
redacted handling of the result.

Required environment variable: PROJECT_ENDPOINT (never committed; resolved
locally from `azd env get-values` in `infra/foundry/`).
"""

from __future__ import annotations

import os
from typing import Any

AGENT_NAME = "shift-closeout-agent"
MODEL_DEPLOYMENT_NAME = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4.1-mini")


def get_client():
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential

    endpoint = os.environ.get("PROJECT_ENDPOINT")
    if not endpoint:
        raise RuntimeError(
            "PROJECT_ENDPOINT is not set. Resolve it locally via `azd env get-values` "
            "in infra/foundry/ and export it for this process only."
        )
    return AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())


def invoke(input_text: str, *, agent_name: str = AGENT_NAME) -> dict[str, Any]:
    """Invoke the named Prompt Agent with a single text input and return a dict with:

    - "output_text": the assistant's raw text output (may be `None` on failure)
    - "status": the response object's status, if available
    - "model": the model deployment name actually used to serve the response
    - "usage": token usage dict (input/output/total), if available
    - "error": exception message, only present on failure
    """
    client = get_client()
    openai_client = client.get_openai_client()
    try:
        response = openai_client.responses.create(
            model=MODEL_DEPLOYMENT_NAME,
            input=input_text,
            extra_body={"agent_reference": {"name": agent_name, "type": "agent_reference"}},
        )
    except Exception as exc:  # noqa: BLE001 - surfaced to caller, not swallowed
        return {"output_text": None, "status": "error", "model": None, "usage": None, "error": str(exc)}

    output_text = getattr(response, "output_text", None)
    usage = getattr(response, "usage", None)
    usage_dict = usage.model_dump() if hasattr(usage, "model_dump") else usage

    return {
        "output_text": output_text,
        "status": getattr(response, "status", None),
        "model": getattr(response, "model", None),
        "usage": usage_dict,
    }
