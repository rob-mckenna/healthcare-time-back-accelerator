#!/usr/bin/env python3
"""Create the single Shift Closeout Prompt Agent (issue #6, BLOCKER-003).

Uses the Azure AI Projects SDK v2 preview (`azure-ai-projects`) with
`DefaultAzureCredential`, per the Microsoft Foundry skill fallback path
documented in
`microsoft-foundry/foundry-agent/create/create-prompt.md` and
`microsoft-foundry/foundry-agent/create/references/sdk-operations.md`
(Foundry MCP tools were not advertised in this session).

Safety invariants enforced by this script, not by the agent itself:

  1. Exactly one Prompt Agent (`kind: "prompt"`), named `shift-closeout-agent`.
  2. Instructions are loaded verbatim from the versioned repository file
     `agent/instructions/shift-closeout/v1.0.0/system.md` and its SHA-256 is
     verified against `agent/instructions/shift-closeout/v1.0.0/manifest.json`
     before creation. A digest mismatch aborts and creates nothing.
  3. No tools are attached (`tools=None`). No web search, Bing grounding,
     file search, Azure AI Search, MCP, memory, or code interpreter.
  4. A low, fixed temperature is used because the agent output is schema-bound
     (structured JSON) and must be as deterministic as the model allows.

This script never prints or persists the project endpoint, agent ID, or any
other Azure identifier to a committed file. Redacted confirmation evidence is
written to `agent/deployment/manifest.created.json` (committed — digest and
counts only). The raw SDK response is written to `agent/deployment/.local/`
(gitignored — local machine only).

Required environment variable:
  PROJECT_ENDPOINT   Foundry project endpoint, e.g. obtained locally via
                      `azd env get-values` in `infra/foundry/`. Never commit
                      this value.

Usage:
  python agent/deployment/create_prompt_agent.py
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
INSTRUCTION_DIR = REPO_ROOT / "agent" / "instructions" / "shift-closeout" / "v1.0.0"
MANIFEST_PATH = INSTRUCTION_DIR / "manifest.json"
SYSTEM_PATH = INSTRUCTION_DIR / "system.md"
DEPLOYMENT_DIR = REPO_ROOT / "agent" / "deployment"
LOCAL_DIR = DEPLOYMENT_DIR / ".local"

AGENT_NAME = "shift-closeout-agent"
MODEL_DEPLOYMENT_NAME = os.environ.get("MODEL_DEPLOYMENT_NAME", "gpt-4.1-mini")
AGENT_TEMPERATURE = 0.0  # Deterministic for schema-bound evaluation.


def fail(message: str) -> None:
    print(f"ABORT: {message}", file=sys.stderr)
    sys.exit(1)


def verify_instruction_digest() -> tuple[str, str, str]:
    """Return (instructions_text, digest, manifest_version); abort on mismatch."""
    if not MANIFEST_PATH.exists():
        fail(f"manifest not found: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if not SYSTEM_PATH.exists():
        fail(f"instruction file not found: {SYSTEM_PATH}")
    raw = SYSTEM_PATH.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    expected = manifest.get("instructionSha256")
    if digest != expected:
        fail(
            "instruction SHA-256 does not match manifest.json — "
            f"manifest={expected}, actual={digest}. Refusing to create the agent."
        )
    if manifest.get("status") != "ACTIVE":
        fail(f"instruction manifest status is {manifest.get('status')!r}, expected ACTIVE")
    return raw.decode("utf-8"), digest, manifest.get("version", "unknown")


def main() -> None:
    instructions, digest, instruction_version = verify_instruction_digest()
    print(f"[ok] instruction digest verified against manifest: {digest[:12]}… (version {instruction_version})")

    endpoint = os.environ.get("PROJECT_ENDPOINT")
    if not endpoint:
        fail(
            "PROJECT_ENDPOINT is not set. Resolve it locally from the azd environment "
            "(infra/foundry/: azd env get-values) and export it for this process only. "
            "Never commit this value."
        )

    try:
        from azure.ai.projects import AIProjectClient
        from azure.ai.projects.models import PromptAgentDefinition
        from azure.identity import DefaultAzureCredential
    except ImportError as exc:  # pragma: no cover - environment guard
        fail(f"required SDK packages are not installed: {exc}")
        return

    client = AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())

    # --- Exactly-one-agent guard ------------------------------------------------
    existing_agents = list(client.agents.list())
    if len(existing_agents) > 0:
        names = sorted({a.name for a in existing_agents})
        if names != [AGENT_NAME]:
            fail(
                "one or more agents already exist in this project and are not the "
                f"expected single agent {AGENT_NAME!r}: {names}. Refusing to create a "
                "second agent. Delete the unexpected agent(s) or confirm intent before retrying."
            )
        print(f"[info] agent {AGENT_NAME!r} already exists — this run adds a new version.")

    definition = PromptAgentDefinition(
        model=MODEL_DEPLOYMENT_NAME,
        instructions=instructions,
        temperature=AGENT_TEMPERATURE,
        tools=None,
        tool_choice=None,
    )

    version = client.agents.create_version(
        AGENT_NAME,
        definition=definition,
        description=(
            "Shift Closeout Agent (Second Shift Reduction Accelerator, P0). "
            "Draft-only, schema-bound, synthetic-data-only nurse handoff drafting agent. "
            "No tools, no external retrieval."
        ),
        metadata={
            "instructionVersion": instruction_version,
            "instructionSha256": digest,
            "outputContractVersion": "1.0.0",
            "scope": "P0-isolated-evaluation",
        },
    )

    version_dict = version.as_dict() if hasattr(version, "as_dict") else dict(version)

    # --- Post-creation verification: no tools, correct kind, correct model ------
    created_definition = version_dict.get("definition", {})
    created_kind = created_definition.get("kind")
    created_tools = created_definition.get("tools")
    created_model = created_definition.get("model")

    problems = []
    if created_kind != "prompt":
        problems.append(f"kind is {created_kind!r}, expected 'prompt'")
    if created_tools not in (None, []):
        problems.append(f"tools is {created_tools!r}, expected none")
    if created_model != MODEL_DEPLOYMENT_NAME:
        problems.append(f"model is {created_model!r}, expected {MODEL_DEPLOYMENT_NAME!r}")
    if problems:
        fail("post-creation verification failed: " + "; ".join(problems))

    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    local_evidence_path = LOCAL_DIR / "agent-version.local.json"
    local_evidence_path.write_text(json.dumps(version_dict, indent=2, default=str), encoding="utf-8")

    redacted = {
        "agentName": AGENT_NAME,
        "kind": created_kind,
        "modelDeploymentName": created_model,
        "toolsAttached": created_tools or [],
        "temperature": AGENT_TEMPERATURE,
        "instructionVersion": instruction_version,
        "instructionSha256": digest,
        "agentVersion": version_dict.get("version"),
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Project endpoint and Agent ID are intentionally omitted. See "
            "agent/deployment/.local/agent-version.local.json (gitignored, local machine only) "
            "for the full raw response."
        ),
    }
    manifest_out_path = DEPLOYMENT_DIR / "manifest.created.json"
    manifest_out_path.write_text(json.dumps(redacted, indent=2), encoding="utf-8")

    print("[ok] agent created and verified:")
    print(json.dumps(redacted, indent=2))


if __name__ == "__main__":
    main()
