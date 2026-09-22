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
5. **[Advanced Writing Skills Suite](.agents/skills/)** (`.agents/skills/`):
   * Tracked skills for automated assistance: `no-ai-slop`, `text-humanizer`, `copywriting`, `copy-editing`, `proofreading`, `paragraph-structure`, `ogilvy`, `content-strategy`, `competitor-alternatives`.

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

### 3. CI/CD Monitoring Protocol on Push
* Whenever changes are pushed to remote (`git push`), the agent **MUST proactively monitor** the triggered GitHub Actions workflow run (using `gh run list --limit 1` or `gh run view`) until it finishes.
* The agent must verify that all automated builds, lints, and test suites succeeded (`✓`) before marking any task as complete.

### 4. Verification Protocol
* Always run `pnpm test` locally before committing or reporting changes.
* Ensure all tests (access control, time allocation math, progress bar rendering, Zod schemas) pass with 0 failures.
