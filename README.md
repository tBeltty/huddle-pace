# ⏱️ HuddlePace

> **Slack-native meeting timekeeper and speaker companion.**

[![Install HuddlePace](https://img.shields.io/badge/Slack-Install%20HuddlePace-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://huddlepace.com/install)

**Website**: [huddlepace.com](https://huddlepace.com) | **Install to Slack**: [huddlepace.com/install](https://huddlepace.com/install)

HuddlePace keeps technical presentations, design reviews, and engineering syncs within scheduled time limits by tracking modular agendas in real time inside Slack Huddles.

This repository contains the source-available codebase of HuddlePace for security audits, data privacy verification, and local development.

---

## Key Capabilities

1. **Slack App Home Dashboard**:
   - Workspace dashboard showing live sessions, active modules, and quick controls.
   - Schedule sessions using `[ ➕ Schedule New Meetup ]`.
   - View 30-day team pacing stats and session logs.

2. **Modular Agendas & Strict Timeboxing**:
   - Organizers divide meeting duration into percentage-based topics (e.g., *Context: 15%*, *Demo: 60%*, *Q&A: 25%*).
   - Validated at runtime with Zod schemas to enforce that allocations sum to exactly 100%.
   - Dynamic module rows support up to 10 agenda items, respecting Slack's 100-block view limit.

3. **In-Call Huddle Chat Threading**:
   - Posts the live tracking card into the active Huddle chat thread (`thread_ts`), keeping the main channel clean.
   - Updates every 30 seconds with a visual progress bar (`[████████░░░░░░░░] 50%`), current topic, and remaining time.

4. **Huddle Discovery & Disambiguation**:
   - The scheduling modal detects active or recent Huddle calls in the target channel.
   - Choose to link a detected call, auto-detect on start, post to channel feed, or supply a custom thread link.
   - If multiple active Huddles exist at launch, HuddlePace opens a single-step selector modal.

5. **Automated Huddle Lifecycle Detection**:
   - Listens to channel message events for call completion markers (`room.has_ended: true`).
   - Automatically concludes the session when participants leave the Huddle, posting the final duration summary.

6. **Role-Gated Speaker Controls & Private DMs**:
   - Buttons to start, transition, or conclude sessions verify user identity against assigned speakers. Unauthorized clicks receive an ephemeral access denied notice.
   - Transition alerts and time warnings are sent privately to assigned presenters via Slack DMs.

7. **Transparent Channel Membership**:
   - Automatically joins public channels using the `channels:join` scope when a meeting is scheduled or launched.
   - For private channels, provides a prompt to invite the bot (`/invite @HuddlePace`) if not already a member.

8. **"Just Chatting" Wrap-Up Mode**:
   - A `[ ☕ Switch to Just Chatting ]` button lets organizers close the formal agenda while keeping the Huddle open.
   - Freezes formal presentation metrics for analytics while tracking casual conversation time.

9. **On-Demand Pacing Reports**:
   - Run `/pace report [days]` (default: 30 days) to review timebox compliance rates, formal presentation time, and recent session records.
   - Access reports directly from the Slack App Home tab.

---

## Tech Stack

- **Runtime**: Node.js (ESM, TypeScript, pinned via `.node-version`)
- **Framework**: `@slack/bolt`
- **Validation**: `zod` runtime schema validation for environment variables and modal payloads
- **Transport**: Dual-mode (Slack Socket Mode for local dev; native HTTP with OAuth v2 receiver for multi-tenant production)
- **Database**: SQLite with Prisma ORM (`prisma/dev.db`, WAL journal mode enabled)
- **Testing**: Built-in test runner via `tsx --test`

---

## Local Development

For developers auditing or contributing to the codebase:

### Prerequisites

- Node.js (pinned in `.node-version`)
- `pnpm`

### 1. Installation & Database Setup

Install dependencies and run SQLite migrations:
```bash
pnpm install
pnpm db:push
```

### 2. Automated Test Suite

Run unit and integration tests:
```bash
pnpm test
```

### 3. Local Execution with Socket Mode

For local development without public IP or HTTPS tunnel requirements:

1. Create a test app in [api.slack.com/apps](https://api.slack.com/apps) from [`manifest.json`](./manifest.json).
2. Generate an app-level token with the `connections:write` scope (`xapp-...`).
3. Install the app to your development workspace and copy the Bot Token (`xoxb-...`).
4. Configure `.env`:
   ```env
   SOCKET_MODE="true"
   SLACK_BOT_TOKEN="xoxb-your-bot-token"
   SLACK_APP_TOKEN="xapp-your-app-token"
   ```
5. Start development mode with hot reloading:
   ```bash
   pnpm dev
   ```

---

## Slack Commands & Shortcuts

| Action | Invocation | Description |
| :--- | :--- | :--- |
| **Schedule Modal** | `/pace` or Global Shortcut | Opens the interactive meetup scheduling modal. |
| **Channel Status** | `/pace status` | Lists active sessions running in the current channel. |
| **Pacing Report** | `/pace report [days]` | Displays timebox compliance and duration stats (default: 30 days). |
| **Help Guide** | `/pace help` | Shows available commands and usage hints. |
| **App Home Tab** | Click `HuddlePace` under Apps | Opens the visual dashboard, active sessions, and reports. |

---

## Project Structure

```text
huddle-pace/
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI pipeline: build, typecheck, and test suite
├── .gitignore                     # Environment, SQLite, and build exclusions
├── .node-version                  # Pinned Node.js runtime
├── manifest.json                  # Slack App manifest with least-privilege scopes
├── package.json                   # Dependencies, build, dev, and test scripts
├── tsconfig.json                  # TypeScript compiler options
├── prisma/
│   ├── schema.prisma              # Relational models with performance indexes
│   └── dev.db                     # Embedded SQLite database
├── src/
│   ├── index.ts                   # Entry point, runtime env validation, shutdown hooks
│   ├── config/
│   │   └── env.ts                 # Runtime environment validation with Zod
│   ├── db/
│   │   └── client.ts              # Prisma singleton with SQLite WAL mode
│   ├── services/
│   │   └── meetupService.ts       # Domain logic, minute allocations, report queries
│   ├── scheduler/
│   │   └── timerWorker.ts         # 30-second heartbeat loop and pacing notifications
│   ├── utils/
│   │   └── progressBar.ts         # ASCII/Unicode progress bar renderer
│   └── slack/
│       ├── app.ts                 # Slack Bolt app initialization (Socket Mode)
│       ├── schemas/
│       │   └── scheduleSchema.ts  # Zod schema for modal inputs and 100% timebox
│       ├── utils/
│       │   ├── channelUtils.ts    # Transparent auto-join and private channel handling
│       │   └── huddleDiscovery.ts # Channel history scanner for active Huddles
│       ├── ui/
│       │   ├── homeTab.ts         # App Home tab builder
│       │   ├── scheduleModal.ts   # Interactive modal with 10-module cap
│       │   ├── huddleSelectModal.ts # Launch-time Huddle disambiguation modal
│       │   ├── trackerBlock.ts    # Live progress bar block and chatting banner
│       │   └── reportBlock.ts     # Pacing analytics report builder
│       └── handlers/
│           ├── homeHandlers.ts    # Home Tab events and report modal triggers
│           ├── modalHandlers.ts   # Modal submissions with Zod validation
│           ├── actionHandlers.ts  # Role-gated controls (start, chatting, conclude)
│           ├── commandHandlers.ts # Slash commands (/pace, status, report, help)
│           └── huddleHandlers.ts  # Native Huddle lifecycle detection
├── tests/
│   ├── accessControl.test.ts      # Speaker authorization and modal boundary tests
│   ├── meetupService.test.ts      # Time allocation math and discrepancy tests
│   ├── progressBar.test.ts        # Progress bar and time formatting tests
│   └── validation.test.ts         # Zod environment and modal schema tests
└── README.md
```

---

## License

Source-Available & Audit License. Copyright (c) 2026 tBeltty. All rights reserved.

Permission is granted solely for code inspection, security auditing, and personal evaluation. Plagiarism, modification, redistribution, and unauthorized commercial deployment are strictly prohibited. For commercial licensing, contact the repository owner. See [`LICENSE`](./LICENSE) for full legal terms.
