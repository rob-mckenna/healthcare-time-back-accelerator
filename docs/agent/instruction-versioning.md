# Agent Instruction Versioning

**Owner:** Neo — Foundry Agent Engineer
**Status:** Active

---

## Purpose

The Shift Closeout Agent's instructions live as versioned files in this
repository. Version pinning is required by ADR-20260812-008 so that every
generated draft can be reproduced, audited, and attributed to a specific set of
instructions — not to an in-console configuration that may have changed.

---

## Directory structure

```
agent/
  instructions/
    shift-closeout/
      v1.0.0/
        system.md           ← agent system instructions (the versioned content)
        output-contract.md  ← human-readable companion to the output schema
        manifest.json       ← version record with SHA-256 digest of system.md
```

Each semantic version occupies its own directory. Files within a version directory
are immutable once that version is active. A change to instructions requires a
new version directory.

---

## manifest.json fields

| Field | Description |
|---|---|
| `version` | Semantic version of this instruction set, matching the directory name |
| `instructionFile` | File name of the primary instruction document (`system.md`) |
| `instructionSha256` | Lowercase hexadecimal SHA-256 digest of `system.md` as written to disk |
| `outputContractVersion` | Output contract version these instructions are designed to satisfy |
| `outputContractId` | JSON Schema `$id` of the output contract |
| `createdAt` | UTC timestamp when this version was created |
| `status` | `ACTIVE` or `SUPERSEDED` |

---

## How the digest is used

The `instructionSha256` value in `manifest.json` flows into
`provenance.agentInstructionSha256` in every output the agent produces. The
validation layer (ADR-20260812-008) checks that the provenance value matches the
manifest on disk. A mismatch means the agent was not running the expected
instructions, which is a fail-closed condition.

### Computing the digest

```bash
# PowerShell
(Get-FileHash agent/instructions/shift-closeout/v1.0.0/system.md -Algorithm SHA256).Hash.ToLower()

# Node
node -e "const {createHash}=require('crypto');const {readFileSync}=require('fs');console.log(createHash('sha256').update(readFileSync('agent/instructions/shift-closeout/v1.0.0/system.md')).digest('hex'))"
```

### Validating the digest

```bash
node agent/evaluation/check-instruction-digest.mjs
```

This script checks that the manifest parses, all required fields are present, and
the recorded digest matches the current file content. Exit code 0 = pass,
exit code 1 = failure.

---

## Versioning rules

1. **Never modify a version directory once it is active.** Modifying `system.md`
   in an active version invalidates the digest and breaks reproducibility for
   every draft produced under that version.

2. **Create a new version directory for any change.** Copy the directory, make
   the change, recompute the digest, update `manifest.json`, and set the prior
   version's `status` to `SUPERSEDED`.

3. **Update the output contract version reference** in `manifest.json` if the
   target contract version changes.

4. **The active version is the highest semantic version with `status: ACTIVE`.**
   There is exactly one active version at any time.

5. **Superseded versions are kept** for audit reproducibility. Do not delete them.

---

## Version history

| Version | Status | Created | Notes |
|---|---|---|---|
| 1.0.0 | ACTIVE | 2026-08-12 | Initial P0 version, targets output contract 1.0.0 |

---

## Deployment binding

When a Foundry agent deployment loads instructions from a file, the deployment
must reference the exact version directory. If the deployment platform does not
support loading instructions from versioned files, the active version content
must be copied verbatim and the `agentInstructionSha256` must be recorded in the
deployment configuration evidence required for BLOCKER-003.

See `docs/agent/deployment.md` for deployment binding guidance and blocker status.

---

## References

- ADR-20260812-008 — Deterministic validation runs outside the agent
- ADR-20260812-003 — The P0 output contract has no recommendation surface
- ADR-20260812-005 — camelCase field naming across all shared contracts
- `contracts/schemas/shift-closeout-agent-output.schema.json`
- `agent/evaluation/check-instruction-digest.mjs`
