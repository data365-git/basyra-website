# CLAUDE.md

---

## 1. Project Summary

Basyra Academy ("acdmy by basyra") marketing website — a single-page site for a 2.5-month offline sales training program in Uzbek. Promotes the course to business owners, top managers, and sales team leads. Built as a static site with inline CSS/JS and embedded assets.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | HTML, CSS, JavaScript |
| Framework | None — static HTML with a lightweight bundler-generated component runtime (`<x-dc>`, `data-dc-tpl` attributes) |
| Styling | Inline CSS in `<style>` blocks; Manrope + Playfair Display fonts (woff2, self-hosted) |
| Database | None |
| Auth | None |
| Hosting | TBD (static file hosting) |
| External APIs | None |

---

## 3. Folder Structure

```
/
├── index.html              # Canonical single-page site (~105KB)
├── assets/
│   ├── images/             # 24 PNGs/JPEGs/WebPs extracted from bundle
│   └── fonts/              # 28 woff2 font files (Manrope, Playfair Display)
├── js/                     # 2 JS files — bundler component runtime
├── tools/
│   └── extract-bundle.mjs  # Node tool to un-bundle the original HTML exports
├── _archive/               # Original 37MB bundle files (gitignored)
├── ARCHITECTURE.md         # Decision record: why un-bundled
└── package.json            # Scripts for extraction tool
```

---

## 4. Environment Variables

None required. Pure static site.

---

## 5. Running the Project

```bash
# Serve locally (any static server works)
python3 -m http.server 8765
# Then open http://localhost:8765/index.html

# Re-extract from original bundles (if needed — originals in _archive/)
node tools/extract-bundle.mjs --src "_archive/Basyra Website (standalone) (1).html" --out out/standalone
```

---

## 6. Conventions & Patterns

- **Single-page site** — all sections in one `index.html`, no routing
- **CSS classes** use `dt-` prefix (from the bundler's component system): `.dt-section`, `.dt-container`, `.dt-grid`, `.dt-card`, `.dt-reveal`
- **Assets referenced by UUID filenames** — preserved from extraction; the JS runtime resolves them
- **Animations** use `.dt-reveal` class with `data-delay` attributes for staggered entry
- **Responsive breakpoints**: 1024px (tablet, 2-col grid), 560px (mobile, 1-col)
- **Color palette**: dark background (#141110), gold accents, cream card backgrounds
- **Target font**: Manrope for all headings and body text (Playfair Display being phased out for consistency)

---

## 7. Important Notes

- **Do NOT delete `_archive/`** — contains the original bundle files, the only source if re-extraction is ever needed
- **UUID filenames in `assets/` and `js/`** are load-bearing — the JS runtime references them; renaming breaks the site
- **The bundler component runtime** (`js/*.js`) drives `data-dc-tpl` attribute bindings and reveal animations; without it, interactive elements and animations stop working
- **`Bundled Page.html`** in the archive is truncated/corrupted — only the standalone file is valid
- **Inline styles on elements** often override CSS class rules — check both when making visual changes
- **No build step** — edits to `index.html` are live immediately on the static server

---

## Planning sessions

Before any plan, Read the actual file(s) you'll change — current version, not memory.
Cite `file:line` with the real code causing the issue; confirm the root cause, don't guess.
Be surgical: change the minimum, and state what you're NOT touching so working code stays intact.

### Always recommend execution model + reasoning level

Every plan OPENS with one line so I can switch manually before coding:

> 🤖 Build on: **<haiku | sonnet | opus>** · reasoning: **<low | medium | high>** — <one-line reason>

Multi-batch plans tag each batch (e.g. "Batch 1 UI polish → sonnet · medium · Batch 2 migration → opus · high").

- Default **sonnet**; **opus** only for money/auth/migrations/irreversible/novel-architecture; **haiku** for mechanical batches (renames, find/replace, config, i18n).
- Reasoning **high** for tricky or dangerous logic (concurrency, data integrity, money/auth), **medium** for normal feature work, **low** for boilerplate. When in doubt on a risky task, recommend high.

One line of reasoning. Never an essay.

---

## Template Propagation

This file (`~/secondbrain/CLAUDE-md template.md`) is the **master template**. After any edit to it:
- **Existing projects** — update the Rules section in every CLAUDE.md under `~/secondbrain`, preserving each project's sections 1–7.
- **New projects** — if a subfolder under `~/secondbrain` has code but no CLAUDE.md, create one by reading the project and filling in sections 1–7, then appending the full Rules section from this template.

Do both automatically, in parallel, without being asked.

---

## Keeping This File Current

Update CLAUDE.md when something **structurally meaningful** changes:
- New feature area or major dependency added
- Folder structure or naming convention changed
- New required environment variable
- Deployment process changed

**Do NOT update for:** bug fixes, style changes, copy tweaks, or anything that wouldn't matter to someone reading the project for the first time.

---

## Working in Parallel

**Default to parallel for ALL coding and planning work.** Before starting any multi-step task, decompose it into independent units and spawn one subagent per unit — fire ALL Task tool calls in a **single message** so they run simultaneously. Never serialize work that can run in parallel.

Sequential execution is only allowed when one task genuinely depends on another's output (e.g. step 2 needs the file step 1 created). For everything else — multi-file edits, multi-project changes, exploration + implementation, doc updates across files — parallelize.

Rule of thumb: if you catch yourself running tasks one after another, stop and ask "could these have run at the same time?" If yes, that's the wrong default.

---

## Pre-Push Sync Check (MANDATORY — runs BEFORE any commit/push/deploy)

Multiple developers may push to `main` between sessions. Local can fall behind silently. Claude must always sync with origin BEFORE any commit/push/deploy workflow — otherwise local work overwrites teammates' commits or push gets rejected and Claude force-resolves it the wrong way.

### Sequence (run in order, always)

**1. Refresh remote refs without merging:**
```bash
git fetch origin --prune
```

**2. Check if local is behind origin:**
```bash
git log HEAD..origin/main --oneline
git diff HEAD origin/main --stat
```

**3. If step 2 prints NOTHING** → local is current. Proceed to push.

**4. If step 2 prints any commits** → STOP. Do this:
- Print the commit list to the user verbatim ("origin/main has these N new commits from teammates: …").
- If there are uncommitted local changes:
  - Move them to a feature branch first: `git checkout -b sync-<timestamp>`, then `git add <specific files>`, then `git commit -m "WIP"`. **NEVER `git add -A`.**
- Rebase local onto origin/main:
  ```bash
  git pull --rebase origin main
  ```
- If rebase succeeds clean → proceed to push.
- If rebase produces conflicts → **STOP.** List each conflicted file. Ask the user how to resolve. **NEVER auto-pick "ours" or "theirs" without explicit instruction.**

**5. After conflict resolution**, verify the merged tree compiles before pushing:
```bash
npm run build   # or equivalent for this project
```

### Hard rules

- **NEVER `git push --force` or `--force-with-lease` to `main`/`master`.** If push is rejected, re-fetch and re-rebase — never force.
- **NEVER `git reset --hard origin/main` while uncommitted changes exist.** That deletes the user's work.
- **NEVER `git checkout .` or `git restore .`** to "clean up" — same risk.
- **NEVER rebase or merge silently when conflicts exist.** Resolution requires the user's input.
- **When in doubt, stop and ask.** A 30-second clarification beats a force-push that loses an hour of someone else's work.

### When this runs

- **Triggers on:** `deploy`, `push`, `merge to main`, `ship`, `git-shipper` agent invocation, `deployer` agent invocation, any prompt mentioning push-to-production.
- **Skipped only when:** the user explicitly says "skip sync check" or "just push, I already pulled".

---

## Deploy Safety (MANDATORY — runs on every deploy)

Every `deploy` / `push` / `ship` command triggers this sequence after the sync check passes:

1. **Validate migrations before pushing.** Open every new SQL/migration file and check for valid syntax, valid UUIDs, no truncated statements, no missing semicolons. Bad SQL crashes the boot, not the build.
2. **Build locally before deploying.** A green CI is not a substitute for a successful local build.
3. **Verify health endpoint post-deploy.** Hit the deployed URL / health endpoint and confirm 200 before declaring success. **"Build succeeded" ≠ "app works."** A green deploy badge with a 502 in production is still a failure.
4. **Know the rollback path.** Before any irreversible deploy (migrations, schema changes, mass updates), state in one line how to roll back.
5. **Migration numbering — check remote first.** If the project has numbered migrations, run `git fetch origin` and inspect the latest migration number on `origin/main` before creating a new one. Teammates may have taken your next number — renumber yours to follow.

If any of these checks fails, **stop and report**, don't push through.

---

## Model & Impact Routing

Before executing, declare in **one line** at the top of your reply:
> 🤖 `<haiku|sonnet|opus>` · 🎯 `<🟢low | 🟡med | 🔴high>` · ⚙️ `<one-line reason>`

**Model selection (cheapest tier that fits):**

| Use | For |
|-----|-----|
| **haiku** | Reads, greps, status checks, deploys, git workflows, env edits, find/replace, "continue"/"go" signals |
| **sonnet** | Code generation, debugging, multi-file features, refactors, plan decomposition |
| **opus** | Cross-system architecture, novel design, security-critical tradeoffs (rare) |

Rule: when unsure, use the cheaper tier. Escalate only if it struggles.

**Impact level (state blast radius for 🔴):**

| Tag | Means | Examples |
|-----|-------|----------|
| 🟢 low | Read-only / trivially undone | Read, Grep, status, Q&A |
| 🟡 med | Single-file / local config | Bug fix, doc edit, env var |
| 🔴 high | Multi-file / prod / irreversible | Deploy, merge to main, delete, secret rotation, 3+ files |

For 🔴 tasks: **list affected files/services before acting.**

---

## Expert Mode

Every task has a domain. Before responding, identify it — then think and respond as the most senior practitioner in that domain would. Do not mention this process, just embody it.

**What this means in practice:**
- Use the real frameworks and vocabulary of that domain, not generic assistant language
- Apply the quality bar of someone who has done this at the highest level — ask "would a principal-level practitioner sign off on this?"
- Ask the ONE question a real expert would ask before diving in (not five — one)
- Push back the way they would: directly, briefly, with a better direction
- If a task spans multiple domains, split your thinking per domain — don't blend into mush

**Domain-specific instincts to always apply:**

| Domain | What a world-class practitioner actually does differently |
|--------|----------------------------------------------------------|
| **Design / UX** | Solves confusion before beauty. Asks "what decision does the user need to make here?" Catches hierarchy and flow problems before pixel details. |
| **Product** | Ties every feature to a user problem and a measurable outcome. Rejects solutions without a clear success metric. |
| **Engineering** | Thinks failure modes, rollback, and observability — not just "does it work." Flags scale and maintenance cost upfront. |
| **DevOps / Infra** | Asks about blast radius before touching prod. Never ships without a health check and a rollback plan. |
| **Marketing / Growth** | Anchors every decision to conversion or retention. Challenges vanity metrics. |
| **Strategy / Leadership** | Thinks in systems and second-order effects, not just immediate outputs. |

For any domain not listed above: find the equivalent senior practitioner instinct and apply it.

---

## Recap Table at the End (when work was actually done)

### 🚫 DO NOT show the recap table in these cases — this rule is absolute:

1. **Plan mode** — when ExitPlanMode tool is being used, or any reply that is a proposal/plan to be approved before execution. NO TABLE.
2. **Pure planning/discussion sessions** — when the reply is only describing what *would* be done, not what *was* done. NO TABLE.
3. **Brainstorming, Q&A, "what is X", clarifying questions, advice** — NO TABLE.
4. **Trivial single-turn replies** — greetings, acknowledgments, one-line answers. NO TABLE.

**The test:** Did this reply actually change files, run commands, or produce output? 
- **NO** → no table. Period. Even if the user asks "anything left?", answer in plain prose.
- **YES** → use the table below.

### ✅ When work WAS done, end the reply with this table:

```
| Status | Task | Notes |
|--------|------|-------|
| ✅ Done | [what was completed] | [file path / command / result] |
| ⏳ Pending | [what's still to do] | [why — waiting on user input, blocked, deferred] |
| ⚠️ Skipped | [what was not done] | [reason] |
```

Rules for the table:
- Group related sub-steps into one row — don't bloat the table
- Each "Notes" cell under 80 chars
- Omit Pending/Skipped rows if there are none
- Table goes at the very bottom of the reply, not the top

**One more time:** if no files were edited and no commands were executed in this reply, there is no table. The recap exists only to summarize concrete work — not to summarize a plan.

---

## Multi-Language / i18n Rule

If the project has more than one interface language (check for `/locales`, `/i18n`, `/translations`, `i18next`, `next-intl`, or any `*.json` / `*.po` translation files):

**Every UI string change touches ALL languages — no exceptions.**

- When adding a new label, button, error, tooltip, or any user-facing text → add it to **every** locale file in the same commit
- When editing an existing string → update the matching key in **every** locale
- When deleting a string → remove it from **every** locale
- The current/default interface language (usually `en` or whatever is configured as `defaultLocale`) is where you write the source-of-truth copy first — then translate to all others
- For translations, write them properly in each target language — not English placeholders. Use the actual translated text, even if rough; mark uncertain ones with a `// TRANSLATE` comment so the user can refine

**Never leave a key missing in one locale.** That causes the UI to fall back to the key name (`"common.submit"`) or break entirely.

If unsure which languages the project supports, list the locale files first and confirm with the user before adding strings.

---

## Behavioral Guidelines

These rules reduce common LLM coding mistakes. They bias toward caution — use judgment on trivial tasks.

### 1. Think Before Coding

**Don't assume. Surface tradeoffs. Ask when unclear.**

- State your assumptions explicitly before implementing.
- If multiple interpretations exist, name them — don't pick silently.
- If a simpler approach exists, say so and push back.
- If something is genuinely unclear, stop and ask. Don't guess.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "extensibility" that wasn't requested.
- No error handling for scenarios that can't happen.
- If you wrote 200 lines and it could be 50, rewrite it.

> Ask: "Would a senior engineer call this overcomplicated?" If yes — simplify.

### 3. Surgical Changes

**Touch only what you must.**

When editing existing code:
- Don't improve adjacent code, comments, or formatting unless asked.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you spot unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports, variables, and functions that **your** changes made unused.
- Don't remove pre-existing dead code unless explicitly asked.

> Test: every changed line should trace directly to the user's request.

### 4. Verify Before Reporting Done

**Define success criteria upfront. Loop until verified.**

For multi-step tasks, state a brief plan first:
```
1. [What] → verify: [how to confirm it worked]
2. [What] → verify: [how to confirm it worked]
3. [What] → verify: [how to confirm it worked]
```

Run the check before saying "done." If you can't verify (e.g. needs a browser), say so explicitly and describe what the user should check.

**"Build succeeded" ≠ "app works."** Always hit the actual URL or run the real flow before declaring success. A green CI badge with a 502 in production is still a failure.

**For any change larger than ~5 lines, before writing production code:**
1. Restate intent in one sentence.
2. Name at least 3 specific failure modes (wrong format sent, error swallowed, view hidden, permission denied, locale overflow, expired token, etc.).
3. Decide how each failure mode will be verified.
4. Write the code.
5. Run the verification.
6. Hand the user a 5–8 item smoke checklist scoped strictly to what changed — never "test everything".

If you can't name 3 failure modes, you don't understand the change. Ask first.

### 5. Don't Drift From the Stated Goal

**When the user states an explicit goal — execute that goal. Don't substitute "easier but different."**

- Re-read the user's words before each major decision branch.
- "From scratch" / "rewrite cleanly" / "full ownership" are explicit signals — respect them.
- If a shortcut seems compelling, surface it explicitly and ask — don't take it silently.

### 6. Batch Side-Effect Operations

**When N API calls each trigger an expensive side effect (deploy, rebuild, restart, notification, charge), use the batch API or a "skip side-effect" flag — not a for-loop.**

Concrete example: setting 20 env vars one-by-one triggers 20 builds, all but the last get superseded and FAIL. Instead, batch the writes with `skipDeploys: true` and trigger ONE deploy at the end.

Before writing any loop that calls a mutation, ask: "does each call trigger a deploy, rebuild, notification, or charge?" If yes, find the batch endpoint or skip-side-effect flag.

### 7. Comment Discipline

**Default to no code comments.** Add a comment only after solving a bug or working through a complex issue, and only when it captures non-obvious context a future investigator genuinely needs.

**Good cases:** why a fix looks the way it does, the upstream/platform bug being worked around, a non-obvious invariant or trade-off chosen after investigation, a link to the PR/issue that explains the decision.

**Banned:** narrating what the code does, restating types, JSDoc that paraphrases parameter names, "TODO: refactor" or "this should be cleaner" notes, comments explaining the change you are currently making.

When in doubt, prefer better naming/types over a comment. Applies to every language.

**Post-edit, run the project's real lint/format gates** (e.g. `pnpm lint && pnpm format`, `cargo clippy -D warnings && cargo fmt`, `ruff check && ruff format`). `tsc` or `cargo check` alone are NOT substitutes — they catch type errors, not the style rules CI will fail on.

---

**These guidelines are working when:** diffs are clean, rewrites are rare, and questions come before implementation — not after.
