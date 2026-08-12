# Pre-publication hardening evidence — 2026-08-12

**Owner:** Trinity, sole integration owner.
**Requested by:** Rob McKenna, human project owner.
**Scope:** Surgical `.gitignore` hardening and `scan:secrets` publication-scan
widening ahead of the initial public GitHub commit. Nothing was staged,
committed, or pushed. No GitHub repository was created.

## Audit conclusions carried into this pass

1. No live secrets, PHI/PII, internal topology, or real customer/patient names
   were found. Harborlight Children's Hospital, Maria Delgado, Aurora
   Testcase, and Sample Nurse-Testcase are fictional/synthetic examples with
   explicit labels (see `SQUAD_BOOTSTRAP.md` §4 token contract and
   `config/organizations/harborlight/organization.json`). Rob McKenna is
   project-owner attribution, not customer data. Upstream Squad template
   references (e.g. `.squad/templates/`) are public vendor/project
   documentation, not customers.
2. `.gitignore` lacked editor/OS, dist/build/coverage/log, certificate/key,
   and `local.settings.json` protections.
3. `scripts/scan-secrets.mjs` skipped `.squad`, `.github`, and `.copilot`
   outright even though those directories are eligible for the initial
   commit.

This pass addresses (2) and (3) directly and re-verifies (1) is unchanged.

## 1. `.gitignore` — what changed and why

File: `.gitignore` (rewritten, not replaced — every existing rule preserved
or generalized, nothing that was previously tracked-eligible became newly
ignored except the four local-runtime Squad paths in the table below).

| Added coverage | Rules | Rationale |
|---|---|---|
| Node dependencies/caches | `node_modules/`, `.npm/`, `.eslintcache`, `*.tsbuildinfo`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*` | `node_modules/` already existed; the rest cover npm/yarn/pnpm's own local debug artifacts and the (currently absent, but forward-safe) TypeScript/ESLint caches. |
| Build/dist/coverage/test artifacts | `dist/`, `build/`, `out/`, `coverage/`, `.nyc_output/`, `*.tgz` | The repository ships no build step today, but any future `npm pack`/bundler output must never be committed. |
| Logs/temp | `*.log`, `logs/`, `*.tmp`, `*.temp`, `*.pid`, `*.seed` | General-purpose local-run noise. |
| Editor/OS | `.vscode/`, `.idea/`, `*.swp`, `*.swo`, `*~`, `.DS_Store` (pre-existing), `Thumbs.db` (pre-existing), `Desktop.ini` | No `.vscode/`/`.idea/` currently exists in the tree; this is forward coverage so a contributor's local editor state never lands in a public commit. |
| Azure Functions / local runtime config | `local.settings.json`, `*.PublishSettings`, `*.publishsettings` | Named per audit requirement; none exist today but the accelerator's target architecture references Azure. |
| Certificates/private keys | `*.pem`, `*.key`, `*.crt`, `*.cer`, `*.p12`, `*.pfx`, `*.jks`, `id_rsa`, `id_rsa.pub`, `id_ed25519`, `id_ed25519.pub` | None exist today (confirmed by repository-wide glob before this change); forward coverage. `*.key` was checked against every tracked file name — no collisions with source or contract files. |
| Environment values | Generalized `.env` exceptions from two hardcoded paths (`.env.example`, `config/environments/.env.example`) to pattern-based `!*.env.example`, `!*.env.sample`, `!*.env.template`, so any future nested example/sample/template file is covered without another `.gitignore` edit. Live `.env`/`.env.*` remain fully ignored. | Matches the audit-mandated safe-example allowlist (`.env.example`, `.env.sample`, `.env.template`) exactly. |
| Squad runtime state | Retained `orchestration-log/`, `log/`, `decisions/inbox/`, `sessions/`, `.scratch/`, `.cache/`; **added** `.squad/memory/` (tiered-memory subsystem: `audit.jsonl`, `index.json`, `config.json`, `local/`, `policy-inbox/`, `semantic-inbox/`, `tombstones/` — an explicitly unshipped/design-proposal feature per `.squad/templates/skills/tiered-memory/SKILL.md`, currently empty scaffolding), `.squad/identity/` (`now.md`, `wisdom.md` — session-focus notes rewritten every session per `.squad/templates/squad.agent.md.template` lines 260–261, not authoritative governance), and `.squad/.first-run` (a first-run marker timestamp local to this machine). | See §2 below for the full governance-vs-runtime determination. |

### Explicitly NOT ignored (verified still eligible for commit)

`SQUAD_BOOTSTRAP.md`, `.mcp.json`, `.copilot/mcp-config.json`, all of
`.github/` (workflows, agents, skills, `copilot-instructions.md`), all
`.squad/` authoritative governance (`team.md`, `routing.md`, `ceremonies.md`,
`decisions.md`, `config.json`, `casting/*.json`, every `agents/*/charter.md`
and `agents/*/history.md`, `rai/audit-trail.md`, `rai/policy.md`,
`fact-checker/audit-trail.md`, `fact-checker/policy.md`, `templates/**`),
`README.md`, `docs/**`, `contracts/**`, `data/**` (synthetic only), `src/**`,
`tests/**` (excluding `tests/.artifacts/`), `agent/**`, `config/**`
(excluding live `.env*`), `workflow/**`, `package.json`, `package-lock.json`.

## 2. Governance vs. runtime-state determination

| Path | Determination | Basis |
|---|---|---|
| `.copilot/mcp-config.json` | **Source governance — keep committed.** | `.squad/templates/mcp-config.md` documents this exact path as "Repository-level: team-shared, committed to repo." Its only value, `GITHUB_TOKEN`, is a `${GITHUB_TOKEN}` template interpolation — never a literal — so no live credential is present. |
| `.squad/.first-run` | **Local runtime marker — ignore.** | Single ISO timestamp with no cross-machine meaning; not referenced by any authoritative file in `.squad/templates/`; analogous to a CLI first-run cache flag. |
| `.squad/memory/**` | **Local runtime state — ignore.** | `.squad/templates/squad.agent.md.template` lists `.squad/memory/**` alongside `.squad/log/**`, `.squad/orchestration-log/**`, and `.squad/decisions/inbox/**` (all already ignored) as runtime-managed paths under the state-backend contract. `.squad/templates/skills/tiered-memory/SKILL.md` states the underlying tier scaffolding is "a design proposal, not a shipped runtime" (tracked upstream as bradygaster/squad#1264). On disk today it is empty scaffolding (`audit.jsonl` empty, `index.json` is `[]`, all inbox/tombstone directories empty) — nothing of value is lost by ignoring it. |
| `.squad/identity/**` (`now.md`, `wisdom.md`) | **Local runtime state — ignore.** | Same runtime-managed-path listing in `squad.agent.md.template` (lines 260–261). `now.md` is explicitly rewritten every session to record "what the team was last focused on" (session-local working state, not a durable decision). `wisdom.md` is currently an empty template with no entries. Neither appears in the authoritative file hierarchy table in `.squad/templates/skills/coordinator-source-of-truth/SKILL.md`, which enumerates every genuinely authoritative or committed-evidence file and does not include `identity/` or `memory/`. |
| `.squad/rai/audit-trail.md`, `.squad/fact-checker/audit-trail.md` | **Committed governance evidence — keep.** | Explicitly listed in `coordinator-source-of-truth/SKILL.md` as "Derived / append-only" evidence logs readable by all agents, distinct from the runtime-managed scratch paths above. Both already contain substantive, reviewable audit content (RAI verdicts, Fact Checker verification) and were never in the prior `.gitignore`. |
| `.squad/casting/*.json`, `.squad/decisions.md`, `.squad/team.md`, `.squad/routing.md`, `.squad/config.json`, `.squad/agents/*/charter.md`, `.squad/agents/*/history.md` | **Authoritative governance — keep (unchanged).** | Explicitly authoritative per the same source-of-truth table; the pre-existing `.gitignore` comment already protects `casting/*`. |
| `.squad/log/`, `.squad/orchestration-log/`, `.squad/decisions/inbox/`, `.squad/sessions/`, `.squad/.scratch/`, `.squad/.cache/` | **Local runtime state — ignore (unchanged, pre-existing).** | Already correctly ignored before this pass; verified still correct against the same source-of-truth table (session logs, orchestration evidence, and unmerged decision proposals are diagnostic/append-only working state, not the canonical `decisions.md` ledger). |

No broad directory was deleted. The three pending proposals currently sitting
in `.squad/decisions/inbox/` (`copilot-illustrative-metrics-extension.md`,
`trinity-architecture-baseline.md`, `trinity-wp09-integration.md`) remain on
disk, untouched, and continue to be excluded from the initial commit exactly
as they were before this pass — that is existing, unchanged behavior, not a
new decision made here.

## 3. `scripts/scan-secrets.mjs` — what changed and why

1. **Removed the blanket `.squad` / `.github` / `.copilot` directory
   carve-out.** File discovery now calls `git ls-files --cached --others
   --exclude-standard` (new `listEligibleFiles()`), which returns exactly the
   set of files eligible for the initial commit — i.e. it automatically
   tracks whatever `.gitignore` currently excludes, rather than a hardcoded
   list that can drift out of sync with `.gitignore`. Only `.git` itself is
   hard-excluded (`HARD_SKIP_DIRS`). A filesystem-walk fallback
   (`walkFallback`) runs only if `git` is unavailable, and approximates the
   same exclusions (dependencies, build/coverage output, and Squad's own
   already-ignored runtime paths) as a safety net, not the primary path.
2. **Widened `TEXT_EXTENSIONS`** to include `.jsonl`, `.sample`, and
   `.template` — extensions that exist under `.squad/` and were previously
   unreachable because the whole directory was skipped.
3. **Refined the `email-address` rule with two narrow, generally-applicable
   content-aware carve-outs** (not file-specific hacks):
   - GitHub's own privacy-preserving noreply address shape
     (`{id}+{username}@{subdomain}.noreply.github.com`) is excluded, because
     it is a GitHub-issued placeholder, not a direct identifier — and this
     repository's own commit-trailer convention
     (`Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`)
     embeds it in every future commit message.
   - A match immediately followed by `:` or `/` is excluded, because that
     shape is a git SSH-remote or HTTPS-URL userinfo segment (e.g.
     `git@github.com:org/repo.git`, `token@github.com/org/repo.git`), not a
     standalone email address.
   Both carve-outs are implemented as explicit post-match checks in
   `scanLine` (not regex lookaround, which was tried and rejected after it
   proved to backtrack around a negative lookbehind — see test coverage
   below) and are covered by dedicated tests proving a genuine personal email
   address still fires the rule.
4. **Added 15 narrow, explicit, file+line+rule-pinned allowances** (not a
   blanket per-file or per-rule allowance) for genuine documentation
   false positives found only after widening the scan surface — all inside
   two copies (the installed `.github/skills/` copy and the
   `.squad/templates/skills/` source copy) of upstream Squad security-guidance
   skill files that intentionally show illustrative "patterns to avoid"
   (a truncated/non-functional `sk-proj-...` key sample, a synthetic
   `super_secret_123` password sample, generic-placeholder connection
   strings, a bare PEM header with no key material, and shell examples where
   the credential position is a runtime shell variable `$token`). Each
   allowance entry records file, line, rule ID, and a one-sentence reason
   (see the `allowances` array in `scripts/scan-secrets.mjs`). Detection
   strength is unchanged: a fresh literal credential anywhere else in either
   allowed file — or a moved/changed line in it — still fails the scan (see
   test `documented allowances are pinned to file + line + rule, not
   file-wide`).
5. Updated `isEnvExample` detection to match `.env.example`, `.env.sample`,
   and `.env.template` (previously only `.env.example`), consistent with the
   generalized `.gitignore` allowlist.

### Result of widening the scan surface

| Metric | Before this pass (directories skipped) | After this pass (full eligible surface) |
|---|---|---|
| Files scanned | 125 | 299 |
| Lines scanned | 17,230 | 38,347 |
| Rules applied | 11 | 11 (unchanged — no rule was weakened) |
| Documented allowances | 0 | 15, each pinned to an exact file/line/rule |
| Findings | 0 | 0 |
| Exit code | 0 | 0 |

(The final "after" count of 299 files / 38,347 lines includes this evidence
report itself, added after the scanner change and re-verified clean on its
own — see §5. The scan surface is git-eligibility based, so any new file
added to the tree is automatically included on the next run without further
scanner changes.)

## 4. Tests and docs updated

- `tests/security/secret-exposure.test.mjs` — added 6 new tests: GitHub
  noreply carve-out, git-remote-userinfo carve-out, a genuine-email
  still-fires control, a widened-surface smoke test asserting `.squad/`,
  `.github/`, and `.copilot/` files are actually part of the eligible-for-commit
  set and get scanned, a full-run clean-exit assertion, and an
  allowance-precision control. All 16 tests in the file pass (`node --test
  tests/security/secret-exposure.test.mjs`).
- `README.md` and `docs/plan/p0-execution-plan.md` — updated the
  `scan:secrets` row description from "tracked files" to "every file eligible
  for commit … including `.squad/`, `.github/`, and `.copilot/`" to match the
  new mechanism.
- Historical evidence files (`docs/evidence/2026-08-12-integration-run.md`,
  `docs/evidence/2026-08-12-fact-check-audit.md`) and the accepted ADR
  (`docs/architecture/decisions/ADR-20260812-006.md`) were left untouched —
  they are dated, append-style records of a specific past run and are not
  living documentation of the scanner's current mechanics.

## 5. Full validation run

Command: `npm run verify` (2026-08-12, this session). Exit code `0`.

| Subsuite | Result |
|---|---|
| `validate:contracts` | 48/48 contract checks passed |
| `validate:docs` | 18/18 documentation checks passed |
| `scan:secrets` | 299 files, 38,347 lines, 11 rules, 15 documented allowances, **0 findings** (re-run after adding this evidence report; no new allowances were needed) |
| `test:fail-closed` | All twelve fail-closed codes passed |
| `test:governance` | 31/31 governance checks passed |
| `evaluate:digest` | 7/7 instruction digest checks passed |
| `evaluate:grounding` | 18/18 grounding evaluation checks passed |
| `test:unit` | 126 tests, 126 pass, 0 fail (includes the 6 new scanner tests) |
| `demo` (local journey) | 37/37 journey checks passed, milestones M1–M6 |

## 6. `git check-ignore` / `git status --short --ignored` probes

All probes below were run from the repository root with nothing staged or
committed.

```
.env                                  => IGNORED
.env.local                            => IGNORED
.env.example                          => TRACKED-ELIGIBLE
config/environments/.env.example      => TRACKED-ELIGIBLE
.vscode/settings.json                 => IGNORED
coverage/lcov.info                    => IGNORED
dist/out.js                           => IGNORED
npm-debug.log                         => IGNORED
id_rsa                                => IGNORED
server.pem                            => IGNORED
local.settings.json                   => IGNORED

.squad/log/x.md                       => IGNORED
.squad/orchestration-log/x.md         => IGNORED
.squad/decisions/inbox/x.md           => IGNORED
.squad/sessions/x.md                  => IGNORED
.squad/.scratch/x                     => IGNORED
.squad/.cache/x                       => IGNORED
.squad/memory/x.json                  => IGNORED
.squad/identity/x.md                  => IGNORED
.squad/.first-run                     => IGNORED
.squad-workstream                     => IGNORED
.squad/casting/registry.json          => TRACKED-ELIGIBLE
.squad/rai/audit-trail.md             => TRACKED-ELIGIBLE
.squad/fact-checker/audit-trail.md    => TRACKED-ELIGIBLE
.squad/decisions.md                   => TRACKED-ELIGIBLE
.squad/team.md                        => TRACKED-ELIGIBLE
.squad/config.json                    => TRACKED-ELIGIBLE

src/governance/audit.mjs              => TRACKED-ELIGIBLE
docs/README.md                        => TRACKED-ELIGIBLE
.github/workflows/squad-heartbeat.yml => TRACKED-ELIGIBLE
.copilot/mcp-config.json              => TRACKED-ELIGIBLE
.mcp.json                             => TRACKED-ELIGIBLE
SQUAD_BOOTSTRAP.md                    => TRACKED-ELIGIBLE
```

`git status --short --ignored` at repository root shows only expected
ignored entries: `.squad/.first-run`, `.squad/decisions/` (the `inbox/`
subfolder only — `.squad/decisions.md` is a separate, tracked-eligible file),
`.squad/identity/`, `.squad/log/`, `.squad/memory/`, `.squad/orchestration-log/`,
`node_modules/`, and `tests/.artifacts/`. Every top-level project directory
(`.copilot/`, `.github/`, `.squad/` remainder, `agent/`, `config/`,
`contracts/`, `data/`, `docs/`, `scripts/`, `src/`, `tests/` remainder,
`workflow/`) plus `README.md`, `SQUAD_BOOTSTRAP.md`, `.mcp.json`,
`.gitattributes`, `.gitignore`, `package.json`, and `package-lock.json` shows
as untracked-and-eligible (`??`).

## 7. Focused name/identifier re-check

`grep -ri` for `Harborlight Children`, `Maria Delgado`, `Aurora Testcase`,
`Sample Nurse-Testcase`, and `Rob McKenna` across the tree returns only the
files already reviewed by the original audit (config pack, ADRs, decisions
ledger, narrative/demo docs, agent history, contract examples, and
`SQUAD_BOOTSTRAP.md` itself) — all explicitly labeled fictional/synthetic
examples or project-owner attribution per the charter's own token contract
(§4). No new occurrence outside those already-reviewed files was introduced
by this pass. Public vendor/project references under `.squad/templates/`
(e.g. `bradygaster/squad`, GitHub's own noreply address format) are treated
as public documentation, not customer data, consistent with the original
audit's second conclusion.

## 8. Remaining concerns and initial-commit policy

**Include in the initial commit:** everything currently reported as
untracked-and-eligible (`??`) by `git status --short --ignored` above —
source, contracts, docs, tests, workflows, synthetic data, `.github/`
project configuration, `.copilot/mcp-config.json`, `.mcp.json`, and all
authoritative `.squad/` governance (team/routing/ceremonies/decisions/config,
casting registry, agent charters and histories, RAI and Fact Checker audit
trails, and the static templates library).

**Exclude from the initial commit (and every future commit) via
`.gitignore`:** live `.env*` (except `*.env.example`/`*.env.sample`/`*.env.template`),
`node_modules/` and other dependency/build/coverage/log artifacts, editor/OS
files, `local.settings.json` and publish-settings files, certificate/private-key
material, and Squad's own local runtime state (`log/`, `orchestration-log/`,
`decisions/inbox/`, `sessions/`, `.scratch/`, `.cache/`, `memory/`,
`identity/`, `.first-run`, and the `.squad-workstream` marker).

**Remaining concerns for independent reviewer attention:**
- BLOCKER-001, BLOCKER-002, and BLOCKER-003 (live Microsoft Foundry/Copilot
  Studio platform work) remain open and unchanged by this pass — this pass
  did not touch platform integration, only repository hygiene.
- The three pending files in `.squad/decisions/inbox/` remain unmerged into
  `.squad/decisions.md`; they are correctly excluded from the initial commit
  by the (pre-existing) `.gitignore` rule, but a human/Scribe pass to merge
  or discard them is still outstanding.
- No repository formatter or linter exists; none was added, consistent with
  prior integration evidence.

**Verdict: the tree is safe to stage for independent final review.** All
validation commands pass with exit code 0, the widened secret scan reports
zero findings across the full 298-file eligible-for-commit surface with 15
narrowly documented allowances, and every `git check-ignore` probe requested
by this task returns the expected result. No file was deleted or renamed;
`SQUAD_BOOTSTRAP.md` and the fictional Harborlight example were left
untouched as instructed. Nothing was staged, committed, or pushed.
