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
import time
from typing import Any

AGENT_NAME = "shift-closeout-agent"
MODEL_DEPLOYMENT_NAME = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4.1-mini")

_cached_client = None


class _StaticTokenCredential:
    """Wraps a pre-fetched AAD access token (never logged or persisted by
    this class). Used to avoid repeatedly shelling out to `az` for a fresh
    token on every SDK call — subprocess-based credential resolution
    (AzureCliCredential / DefaultAzureCredential) was observed to
    intermittently fail mid-suite in this environment. The token itself is
    supplied by the caller via an environment variable that is set for this
    process only and is never committed or printed.
    """

    def __init__(self, token: str, expires_on: int):
        self._token = token
        self._expires_on = expires_on

    def get_token(self, *scopes, **kwargs):
        from azure.core.credentials import AccessToken

        return AccessToken(self._token, self._expires_on)


def get_client():
    from azure.ai.projects import AIProjectClient
    from azure.identity import AzureCliCredential, DefaultAzureCredential

    global _cached_client
    if _cached_client is not None:
        return _cached_client

    endpoint = os.environ.get("PROJECT_ENDPOINT")
    if not endpoint:
        raise RuntimeError(
            "PROJECT_ENDPOINT is not set. Resolve it locally via `azd env get-values` "
            "in infra/foundry/ and export it for this process only."
        )

    static_token = os.environ.get("AZURE_STATIC_ACCESS_TOKEN")
    if static_token:
        expires_on = int(os.environ.get("AZURE_STATIC_ACCESS_TOKEN_EXPIRES_ON", str(int(time.time()) + 3000)))
        credential = _StaticTokenCredential(static_token, expires_on)
    else:
        # Prefer AzureCliCredential directly: this process is authenticated
        # via `az login` in this session, and probing the full
        # DefaultAzureCredential fallback chain (environment/managed-identity/
        # workload-identity/shared token cache/etc.) adds subprocess overhead
        # and has intermittently failed mid-suite in this environment. Fall
        # back to DefaultAzureCredential only if AzureCliCredential itself
        # cannot be constructed (not merely if a token request fails later).
        try:
            credential = AzureCliCredential()
        except Exception:  # noqa: BLE001 - fall back to the broader chain
            credential = DefaultAzureCredential()

    # Cache the client (and therefore the resolved credential) at module
    # scope: constructing it fresh on every invoke() call was the other half
    # of the observed subprocess-credential flakiness in a long-running,
    # multi-call suite.
    _cached_client = AIProjectClient(endpoint=endpoint, credential=credential)
    return _cached_client


def invoke(
    input_text: str,
    *,
    agent_name: str = AGENT_NAME,
    max_output_tokens: int | None = None,
) -> dict[str, Any]:
    """Invoke the named Prompt Agent with a single text input and return a dict with:

    - "output_text": the assistant's raw text output (may be `None` on failure)
    - "status": the response object's status, if available
    - "model": the model deployment name actually used to serve the response
    - "usage": token usage dict (input/output/total), if available
    - "rate_limit": a dict of x-ratelimit-* response headers, if the SDK
      exposed raw headers for this call (never includes identifiers)
    - "error": exception message, only present on failure

    `max_output_tokens`, when given, bounds the response's generated token
    count. This is used both for cost-conscious pacing and to deliberately
    induce a truncated/malformed response in the malformed-output-handling
    evaluation case.
    """
    client = get_client()
    openai_client = client.get_openai_client()
    create_kwargs: dict[str, Any] = {
        "model": MODEL_DEPLOYMENT_NAME,
        "input": input_text,
        "extra_body": {"agent_reference": {"name": agent_name, "type": "agent_reference"}},
    }
    if max_output_tokens is not None:
        create_kwargs["max_output_tokens"] = max_output_tokens

    rate_limit_headers: dict[str, str] = {}
    try:
        # Prefer the raw-response path so we can read rate-limit headers
        # (never identifiers) for conservative pacing between live calls.
        raw = openai_client.responses.with_raw_response.create(**create_kwargs)
        for key in (
            "x-ratelimit-remaining-requests",
            "x-ratelimit-remaining-tokens",
            "x-ratelimit-limit-requests",
            "x-ratelimit-limit-tokens",
            "retry-after",
        ):
            value = raw.headers.get(key)
            if value is not None:
                rate_limit_headers[key] = value
        response = raw.parse()
    except AttributeError:
        # Older SDK path without with_raw_response support.
        response = openai_client.responses.create(**create_kwargs)
    except Exception as exc:  # noqa: BLE001 - surfaced to caller, not swallowed
        return {
            "output_text": None,
            "status": "error",
            "model": None,
            "usage": None,
            "rate_limit": rate_limit_headers,
            "error": str(exc),
        }

    output_text = getattr(response, "output_text", None)
    usage = getattr(response, "usage", None)
    usage_dict = usage.model_dump() if hasattr(usage, "model_dump") else usage

    return {
        "output_text": output_text,
        "status": getattr(response, "status", None),
        "model": getattr(response, "model", None),
        "usage": usage_dict,
        "rate_limit": rate_limit_headers,
    }
