# ⏱️ HuddlePace

> **Slack-native meeting timekeeper and speaker companion.**

[![CI/CD Pipeline](https://github.com/tBeltty/huddle-pace/actions/workflows/ci.yml/badge.svg)](https://github.com/tBeltty/huddle-pace/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/Release-v1.0.1-06b6d4.svg)](https://github.com/tBeltty/huddle-pace/releases)
[![License: Source-Available](https://img.shields.io/badge/License-Source--Available%20%2F%20Audit--Only-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?logo=nodedotjs&logoColor=white)](.node-version)

[![Install HuddlePace](https://img.shields.io/badge/Slack-Install%20HuddlePace-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://huddlepace.com/install)

**Website**: [huddlepace.com](https://huddlepace.com) | **Install to Slack**: [huddlepace.com/install](https://huddlepace.com/install) | **Security Policy**: [SECURITY.md](SECURITY.md)

HuddlePace keeps technical presentations, design reviews, and engineering syncs within scheduled time limits by tracking modular agendas in real time inside Slack Huddles.

This repository publishes the complete application codebase under a **Source-Available & Audit License**. Workspace administrators, security auditors, and technical leads can independently inspect our data handling practices, security boundaries, and execution logic before installing HuddlePace into their Slack workspaces.

---

## Security & Data Privacy Posture

When evaluating third-party Slack applications, transparency regarding data access and processing boundaries is critical. HuddlePace enforces the following architectural safeguards:

- **Zero Voice / Audio Capture**: HuddlePace does not join audio or video calls, connect to WebRTC media streams, or transcribe spoken speech. It coordinates meetings strictly through Slack channel metadata, thread messages, and interactive commands.
- **Zero Third-Party AI / LLM Telemetry**: Meeting titles, agenda topics, and team messages are never forwarded to external AI services (OpenAI, Anthropic, or proprietary models).
- **Data Minimization**: Stored records contain only meeting identifiers, timestamps (`startedAt`, `formalEndsAt`), percentage breakdowns, and speaker user IDs. Channel discussion text is not persisted in the database.
- **Ephemeral Thread Tracking**: Active progress bars update in place on a single Slack message (`thread_ts`) within the Huddle thread, avoiding channel clutter and external data exports.
- **Strict Role-Gated Actions**: Interactive controls (starting sessions, skipping modules, concluding meetings) verify the clicking user's Slack ID against assigned speakers. Unauthorized clicks receive an ephemeral rejection notice.

---

## Slack Permissions Audit

HuddlePace requests only the minimum granular scopes required to coordinate meeting pacing. Below is the technical justification for every scope defined in [`manifest.json`](manifest.json):

| Scope | Type | Technical Purpose |
| :--- | :--- | :--- |
| `commands` | Bot | Registers the `/pace` slash command for scheduling and status checks. |
| `chat:write` | Bot | Posts and updates the live ASCII/Unicode progress bar in the Huddle chat thread. |
| `im:write` | Bot | Sends private pacing warnings when each module starts and with one minute left directly to assigned speakers. |
| `channels:join` | Bot | Joins public channels automatically when an organizer schedules a meeting. |
| `channels:history` | Bot | Scans channel message events solely to detect Huddle lifecycle boundaries (`room.has_ended: true`). |
| `groups:history` | Bot | Detects Huddle start and completion events in private channels where the bot was explicitly invited. |
| `mpim:history` | Bot | Detects Huddle lifecycle events when meetings take place in multi-party direct messages. |
| `im:history` | Bot | Supports the `/pace clear` command to clean up past bot DM notifications for the calling user. |
| `users:read` | Bot | Resolves speaker user IDs into display names for agenda mention blocks. |

---

## Key Capabilities

1. **Slack App Home Dashboard**:
   - Workspace dashboard showing upcoming meetups, active sessions, and historical logs.
   - Role-gated controls hide operational buttons from spectators while keeping agendas readable.
   - Review 30-day team pacing compliance and duration records.

2. **Modular Agendas & Strict Timeboxing**:
   - Split meeting duration into percentage-based topics (e.g., *Context: 15%*, *Demo: 60%*, *Q&A: 25%*).
   - Validates that agenda allocations total exactly 100% before saving.
   - Dynamic module builder supporting up to 10 distinct topics per session.

3. **In-Call Huddle Chat Threading**:
   - Attaches the live tracker directly to the active Huddle chat thread (`thread_ts`).
   - Updates every 30 seconds with a monospace progress bar (`[████████░░░░░░░░] 50%`), current topic, and remaining time.

4. **Automated Huddle Lifecycle Detection**:
   - Listens for Slack room closure events to conclude sessions automatically when all participants exit the Huddle.
   - Posts a final duration summary comparing scheduled versus actual time.

5. **Speaker Pacing Alerts**:
   - Private notifications sent directly to active presenters via Slack DM when each module starts and with 1 minute remaining.
   - `⏭️ Next Module` action allows speakers who finish early to hand off remaining time to the next agenda item.

6. **"Just Chatting" Wrap-Up Mode**:
   - Organizers can switch to casual chat mode to freeze formal presentation metrics while keeping the Huddle open for open discussion.

7. **On-Demand Pacing Reports**:
   - Execute `/pace report [days]` (default: 30 days) in any channel to view timebox adherence rates and session logs.

8. **Exact-Time Scheduling & Manual Start**:
   - Every scheduled pace has an exact date and time, read in the workspace scheduling timezone (Pacific Time by default; `/pace settings` switches it to each scheduler's own timezone or a fixed zone). Summaries show the time with its zone, for example `10:00 AM PT`.
   - HuddlePace watches for a Huddle from 20 minutes before to 20 minutes after that time and starts the pace in the first Huddle it finds. Each Huddle starts only the pace nearest its time.
   - Two paces in the same channel cannot sit within 20 minutes of each other. The form says so and offers to pick another time or save the new pace for **manual start** under a code (`m1`, `m2`...). Start it with `/pace start m1` inside the Huddle. Speakers, the pace creator and workspace managers can start, edit and reschedule it.
   - A pace whose window closes without a Huddle is marked **Missed**. Its creator gets a DM with a Reschedule button (its speakers, for paces created before creators were recorded), and App Home lists it under Missed (the section only appears when there is one). Rescheduling with a new time puts it back under detection.
   - Manual start paces are listed in App Home and on the Huddle standby card.

---

## Slack Commands & Shortcuts

| Action | Invocation | Description |
| :--- | :--- | :--- |
| **Schedule Modal** | `/pace`, the **➕ Schedule Meetup** button in App Home, or the Schedule Meetup Global Shortcut | Opens the interactive meetup scheduling modal. All three open the same modal. |
| **Channel Status** | `/pace status` | Displays active pacing sessions running in the current channel. |
| **Pacing Report** | `/pace report [days]` | Shows timebox compliance and duration metrics (default: 30 days). |
| **Start a Pace** | `/pace start` | Starts the scheduled pace closest to now in this channel. |
| **Manual Start** | `/pace start <code>` | Starts a pace saved for manual start (`m1`, `m2`...) in this channel's active Huddle. |
| **Settings** | `/pace settings` | Reminder defaults, grace buffer, scheduling timezone and bot managers. |
| **Clear Bot DMs** | `/pace clear` | Deletes historical pacing alerts and direct messages sent by the bot. |
| **Help Guide** | `/pace help` | Displays command syntax and operational hints. |
| **App Home Tab** | Click `HuddlePace` under Apps | Opens the visual workspace dashboard, schedule modal, and stats. |

---

## Code Integrity Verification (Auditing)

Security reviewers can verify the codebase, business rules, and access control invariants locally using the automated test suite.

### Prerequisites

- Node.js (`>= 20.0.0`, pinned via `.node-version`)
- `pnpm`

### Running the Test Suite

Clone the repository and run the automated test suite with SQLite:

```bash
# 1. Install dependencies
pnpm install

# 2. Run the test suite
pnpm test
```

The test runner executes 99 automated test cases covering:
- **Role-based authorization**: Verification that spectators cannot start, transition, or conclude sessions.
- **Timebox mathematical reconciliation**: Verification that percentage-to-minute rounding sums to 100% of meeting duration.
- **Data isolation**: Partitioning of meetup records strictly by `teamId`.
- **Negative controls**: Explicit assertion tests proving that unauthorized actions, invalid percentage totals, and malformed inputs fail predictably.

To verify TypeScript compilation:

```bash
pnpm build
```

---

## Architecture Overview

```text
src/
├── index.ts                   # Application lifecycle, runtime validation, and graceful shutdown
├── config/env.ts              # Zod validation for runtime environment variables
├── db/client.ts               # Prisma ORM singleton with SQLite WAL mode enabled
├── services/meetupService.ts  # Core domain logic, minute allocations, and report aggregations
├── scheduler/timerWorker.ts   # 30-second heartbeat loop driving thread updates and DM alerts
├── utils/progressBar.ts       # Monospace Unicode progress bar renderer
└── slack/                     # Slack Bolt integration layer
    ├── app.ts                 # Dual-mode Slack Bolt initialization (Socket Mode & Native HTTP)
    ├── schemas/               # Zod validation schemas for modal submissions
    ├── ui/                    # Block Kit builders (App Home, Modals, Live Tracker, Reports)
    └── handlers/              # Role-gated action handlers, slash commands, and Huddle events
```

For coding standards and design guidelines, consult [`docs/README.md`](docs/README.md).

---

## License

Source-Available & Audit License. Copyright (c) 2026 tBeltty. All rights reserved.

Permission is granted solely for code inspection, security auditing, and personal evaluation. Plagiarism, modification, redistribution, and unauthorized commercial deployment are strictly prohibited. For commercial licensing, contact the repository owner. See [`LICENSE`](LICENSE) for complete legal terms.

---

## Responsible Security Disclosure

If you identify a security issue or vulnerability, please notify us responsibly by emailing **[support@huddlepace.com](mailto:support@huddlepace.com)**. Refer to our [Security Policy](SECURITY.md) for vulnerability handling timelines and guidelines.
