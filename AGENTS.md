# Central Agentic Guidelines — HuddlePace

This document serves as the central operating manual and source of truth for all autonomous coding agents, AI pair programmers, and contributors working on HuddlePace.

---

## 📚 Core Project Knowledge Base

Any agent operating in this codebase must reference and respect the following core documents before planning or implementing changes:

1. **[Product Capabilities & Changes Log](docs/PRODUCT_CAPABILITIES_LOG.md)** (`docs/PRODUCT_CAPABILITIES_LOG.md`):
   * **Purpose**: Master inventory of everything HuddlePace does and living reverse-chronological changelog.
   * **Rule**: When evaluating current capabilities, consult this document first.
2. **[Target Niches & Market Personas](docs/TARGET_NICHES.md)** (`docs/TARGET_NICHES.md`):
   * **Purpose**: Market segments (Scrum Masters, Tech Leads, Remote Agencies), user pain points, monetization tiers, and GTM strategy.
   * **Rule**: Align feature copy, modal messages, and user experience with these target personas.
3. **[Technical Setup & Architecture Guide](README.md)** (`README.md`):
   * **Purpose**: Dual-mode transport (Socket Mode vs. Native HTTP OAuth), database configuration (SQLite WAL + Prisma), Slack commands, and systemd deployment.
4. **[Engineering Guidelines](docs/README.md)** (`docs/README.md`):
   * **Coding & Architecture**: [`docs/guidelines/CODING.md`](docs/guidelines/CODING.md)
   * **UI & Block Kit Styling**: [`docs/guidelines/UI_SLACK_BLOCKS_CSS.md`](docs/guidelines/UI_SLACK_BLOCKS_CSS.md)
   * **Editorial Standards & Anti-Slop**: [`docs/guidelines/EDITORIAL_STANDARDS.md`](docs/guidelines/EDITORIAL_STANDARDS.md)
   * **Copywriting & Anti-AI Playbook**: [`docs/marketing/COPYWRITING_PLAYBOOK.md`](docs/marketing/COPYWRITING_PLAYBOOK.md)
   * **Security & Tokens**: [`docs/guidelines/SECURITY.md`](docs/guidelines/SECURITY.md)
   * **Definition of Done (DoD)**: [`docs/guidelines/DEFINITION_OF_DONE.md`](docs/guidelines/DEFINITION_OF_DONE.md)
   * **Release Process & Versioning**: [`docs/guidelines/RELEASE_PROCESS.md`](docs/guidelines/RELEASE_PROCESS.md)
5. **[Advanced Writing Skills Suite](.agents/skills/)** (`.agents/skills/`):
   * Tracked skills for automated assistance: `no-ai-slop`, `text-humanizer`, `copywriting`, `copy-editing`, `proofreading`, `paragraph-structure`, `ogilvy`, `content-strategy`, `competitor-alternatives`, `slack-app-distribution`.
6. **[Brand Identity & System Guide](docs/BRAND.md)** (`docs/BRAND.md`):
   * **Purpose**: Master source of truth for color palette (Aerospace Telemetry), typography, Vector mascot lore & generation prompts, wordmark, and visual assets.
   * **Rule**: Adhere to canonical hex tokens, character lore, and voice standards across all web, Slack, and marketing interfaces.

---

## ⚡ Mandatory Agent Protocols

### 1. Capabilities Log Maintenance Protocol
* Whenever new features, modifications, UI updates, schema changes, or architectural decisions are made to HuddlePace, the agent **MUST immediately document them at the TOP** of [`docs/PRODUCT_CAPABILITIES_LOG.md`](docs/PRODUCT_CAPABILITIES_LOG.md).
* **Format**: Reverse-chronological order (newest entry at the top, oldest at the bottom). Include date, category, and bullet points describing the functional change.

### 2. User-Facing Copy & Anti-AI Slop Protocol
* **MANDATORY for every draft of user-facing prose**: Slack Block Kit messages, modal views, button labels, toasts, bot notifications, landing page text (`marketing/index.html`), marketing dossier (`marketing/MARKETING.md`), `README.md`, and changelogs.
* **Proactive Execution**: Run `no-ai-slop` proactively; do not wait for the user to type `/no-ai-slop`.
* **Zero AI-Slop**: Ban binary contrasts (*"not X, but Y"*), colon reveals, corporate agile buzzwords (*"synergize"*, *"empower agile velocity"*), and em-dash crutches.
* **Slack In-App Language**: **100% Strict English Policy** for all Slack Block Kit elements and bot interactions.
* **Spanish Language Rules (Marketing & Docs)**:
  * **NEVER voseo. Always tuteo.** Use `tú`/`tu` conjugations (sube, tienes, puedes, elige), never `vos` (subí, tenés, podés, elegí).
  * **Translate meaning, never words.** Never translate literally; translate the *intent* in natural target idiom.

### 3. Zero Manual VPS Manipulation & Mandatory CI/CD Protocol
* **Single Source of Truth for Deployment**: The GitHub Actions pipeline (`.github/workflows/ci.yml`) is the **only authoritative deployment mechanism**. Manual SSH operations (`scp`, manual file edits, manual build commands on the server) are strictly prohibited for applying changes.
* **Mandatory Push on Feature/Fix Completion**: Any code change, bug fix, UI enhancement, schema update, or documentation adjustment **MUST be committed and pushed to remote `main` before marking the task as complete**.
* **Zero Dirty Working Trees**: Never leave changes uncommitted or unpushed in the local repository. If a feature is implemented and tested locally, it does not exist in production until it is committed, pushed, and deployed via CI/CD.
* **Proactive Monitoring**: Immediately after `git push`, the agent **MUST proactively monitor** the triggered GitHub Actions workflow run (using `gh run list --limit 1` or `gh run view`) until it completes with green checks (`✓`).
* **SSH Scope Boundary**: SSH access to `mi-vps` is strictly restricted to read-only diagnostics (inspecting runtime logs, checking systemd/PM2 errors when CI fails). Any actual code or database changes must be introduced via version-controlled files, migrations, and CI/CD pipelines.

### 4. Verification Protocol
* Always run `pnpm test` and `pnpm build` locally before committing or reporting changes.
* Ensure all tests (access control, time allocation math, progress bar rendering, Zod schemas) pass with 0 failures.
* Confirm that post-deploy smoke checks on production (`https://huddlepace.com/healthz`) return HTTP 200 OK.
* After editing any page in `public/*.html`, the strings it renders in `src/locales/*.json`, or its FAQ, run `pnpm page-dates` and commit `src/web/pageDates.json`. It feeds the sitemap `<lastmod>` values, moves a page's date only when that page's content hash changes, and `pnpm test` fails when it is stale.

### 5. Mandatory Proactive Versioning & GitHub Releases Protocol (Zero User Reminders)
* **Automatic Execution Required**: The agent MUST NEVER complete any task involving functional code, bug fixes, schema changes, or UI updates without proactively executing the full release lifecycle. **Do NOT wait for the user to ask or remind you to update the changelog or cut a release.**
* **Strict SemVer Determination**:
  * **PATCH (`x.x.Y`)**: Backward-compatible bug fixes, refinements, UI adjustments, setting toggles, minor enhancements, or doc fixes. Use `pnpm version:patch`.
  * **MINOR (`x.Y.0`)**: New major capabilities, interactive workflows, modal architectures, or new command subsystems. Use `pnpm version:minor`.
* **Atomic Keep a Changelog Hygiene**:
  * Concurrently with any code change, create or update the release block in `CHANGELOG.md` following [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
  * The release workflow publishes that block verbatim as the GitHub Release notes. Run the `no-ai-slop` pass and the [editorial standards](docs/guidelines/EDITORIAL_STANDARDS.md) on it **before** committing and tagging, and keep implementation detail in the Capabilities Log. `pnpm test` fails when an entry from 1.5.0 on breaks them.
  * Update footer comparison links (`[Unreleased]`, `[x.y.z]`) to maintain accurate GitHub diff links.
* **Tag & Automated Release Deployment**:
  * Immediately after the CI/CD deploy run passes green (`✓`) on `main` and production smoke checks pass (`/healthz` 200 OK):
  * Create an annotated git tag matching the bumped SemVer: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
  * Push the tag: `git push origin vX.Y.Z`
  * Proactively monitor the triggered GitHub Actions release workflow (`gh run list --workflow=release.yml --limit 1` and `gh run watch`) until the official GitHub Release is verified published (`gh release view vX.Y.Z`).
* **Non-Negotiable Definition of Done**: No coding task is considered "Done" until the version is bumped, the changelog is updated, the tag is pushed, and the GitHub release is live.
* **Guideline Reference**: Follow [`docs/guidelines/RELEASE_PROCESS.md`](docs/guidelines/RELEASE_PROCESS.md) for step-by-step procedures.

