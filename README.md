# ⏱️ HuddlePace

> **Slack-native meeting timekeeper and speaker companion.**

HuddlePace is a Slack bot built with **Node.js**, **TypeScript**, and **Slack Socket Mode**. It keeps technical presentations, design reviews, and syncs within agreed time limits by tracking modular agendas in real time.

Infrastructure footprint:
- Zero cloud ingress costs: connects over outbound WebSockets (Socket Mode). No public IP, reverse proxy, or TLS cert management.
- Self-hosted runtime with embedded SQLite and Prisma ORM.
- Zero external LLM or paid API dependencies.

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
- **Transport**: Slack Socket Mode (outbound WebSocket)
- **Database**: SQLite with Prisma ORM (`prisma/dev.db`, WAL journal mode enabled)
- **Testing**: Built-in test runner via `tsx --test`

---

## Setup Guide

### 1. Create Slack App via Manifest

1. Navigate to [api.slack.com/apps](https://api.slack.com/apps).
2. Click **Create New App** > **From an app manifest**.
3. Select your workspace.
4. Paste the contents of [`manifest.json`](./manifest.json) and confirm.

### 2. Generate Credentials

#### App-Level Token (Socket Mode)
1. In **Basic Information**, scroll to **App-Level Tokens**.
2. Click **Generate Token and Scopes**.
3. Name it `socket-token`, select the `connections:write` scope, and generate.
4. Copy the token (`xapp-...`).

#### Bot User Token & Installation
1. Go to **Install App** in the sidebar and click **Install to Workspace**.
2. Copy the **Bot User OAuth Token** (`xoxb-...`).

### 3. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Populate tokens in `.env`:
```env
SLACK_BOT_TOKEN="xoxb-your-token-here"
SLACK_APP_TOKEN="xapp-your-token-here"
DATABASE_URL="file:./dev.db"
```

Lock file permissions on disk:
```bash
chmod 600 .env
```

### 4. Database Setup & Testing

1. Install dependencies and generate the database schema:
```bash
pnpm install
pnpm db:push
```

2. Run the automated test suite:
```bash
pnpm test
```

3. Build and run:
```bash
pnpm build
pnpm start
```

For development with hot reloading:
```bash
pnpm dev
```

Expected startup log:
```text
⏱️ Timer worker started (interval: 30s).
⚡️ HuddlePace is live and connected via Slack Socket Mode!
⏱️ Periodic scheduler is tracking active meetups.
[INFO] socket-mode:SocketModeClient:0 Now connected to Slack
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

## Production Deployment (systemd)

On a Linux server or VPS, run HuddlePace as a systemd service:

```ini
# /etc/systemd/system/huddlepace.service
[Unit]
Description=HuddlePace Slack Companion
After=network.target

[Service]
Type=simple
User=<DEPLOY_USER>
WorkingDirectory=/opt/huddle-pace
ExecStart=/usr/bin/node /opt/huddle-pace/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Service management:
```bash
sudo systemctl daemon-reload
sudo systemctl enable huddlepace.service
sudo systemctl restart huddlepace.service
sudo journalctl -u huddlepace.service -f
```

---

## License

Source-Available & Audit License. Copyright (c) 2026 tBeltty. All rights reserved.

Permission is granted solely for code inspection, security auditing, and personal evaluation. Plagiarism, modification, redistribution, and unauthorized commercial deployment are strictly prohibited. For commercial licensing, contact the repository owner. See [`LICENSE`](./LICENSE) for full legal terms.
