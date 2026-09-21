# ⏱️ HuddlePace

> **Slack-native meeting timekeeper and speaker companion.**

HuddlePace is a Slack bot built with **Node.js**, **TypeScript**, and **Slack Socket Mode**. It keeps technical presentations, design reviews, and onboarding sessions within their agreed time budgets by tracking modular agendas in real time.

Runs with a zero-cost infrastructure footprint: no external paid LLM calls, no cloud API subscriptions, and no inbound public ports.

---

## Key Capabilities

1. **Slack App Home Dashboard**:
   - Central graphical dashboard within the Slack workspace.
   - Live session cards showing elapsed time, module progress, and quick controls.
   - Schedule new sessions directly using `[ ➕ Schedule New Meetup ]`.
   - 30-day team pacing analytics and historical session logs.

2. **Modular Agenda & Percentage Budgeting**:
   - Organizers divide scheduled time into custom segments (e.g., *Context: 15%*, *Demo: 60%*, *Q&A: 25%*).
   - Dynamic rows allow adding as many modules as needed.
   - Validates that allocated percentages total exactly 100%.

3. **In-Call Huddle Chat Threading**:
   - Posts the live tracking card directly into the active Huddle chat thread (`thread_ts`), keeping the public channel free from clutter.
   - Updates in-place every 30 seconds with a visual progress bar (`[████████░░░░░░░░] 50%`), the active module, and remaining time.

4. **Huddle Destination Selector & Disambiguation**:
   - The scheduling modal scans the chosen channel for active or recent Huddle calls and lists them explicitly.
   - Options include linking to a detected Huddle, auto-detecting on start, posting to the channel feed, or specifying a custom message thread link.
   - If set to auto-detect and multiple active Huddles exist when starting, HuddlePace opens a single-step picker modal so the organizer chooses the correct call.

5. **Automated Huddle Lifecycle Detection**:
   - Listens for Huddle call conclusion events (`room.has_ended: true`).
   - When all participants leave the Huddle, HuddlePace stops the background timer, marks the session as concluded, and posts the final duration summary into the thread.

6. **Decoupled Moderator & Multi-Speaker Assignment**:
   - Moderators can schedule sessions on behalf of one or more presenters via a multi-user picker.
   - Pacing countdowns and module transition alerts are sent simultaneously via private direct messages to each assigned speaker.

7. **"Just Chatting" Post-Meeting Mode**:
   - A `[ ☕ Switch to Just Chatting ]` button lets organizers wrap up the formal agenda while keeping the Huddle open.
   - Freezes formal presentation duration metrics for accurate analytics while tracking informal discussion time.
   - Updates the tracker card with a casual chat banner so teammates browsing the channel know the meeting transitioned to open discussion.

8. **On-Demand Pacing Reports**:
   - Run `/pace report [days]` (e.g. `/pace report 14`, default 30) to view timebox compliance rates, formal presentation hours, casual chat hours, and recent session records.
   - View 30-day summary metrics on the Slack Home Tab or click `[ 📊 View Full Report ]` to open the full modal breakdown.

---

## Tech Stack

- **Runtime**: Node.js (ESM, TypeScript)
- **Framework**: `@slack/bolt`
- **Transport**: Slack Socket Mode (WebSocket, zero inbound firewall holes)
- **Database**: SQLite with Prisma ORM (`prisma/dev.db`)
- **Cost**: $0 (deterministic calculations, self-hosted, no paid external APIs)

---

## Setup Guide

### 1. Create the Slack App via Manifest

1. Navigate to the [Slack App Management Portal](https://api.slack.com/apps).
2. Click **Create New App** > **From an app manifest**.
3. Select your target workspace.
4. Paste the contents of [`manifest.json`](./manifest.json) into the JSON editor and confirm.

### 2. Generate Credentials

#### App-Level Token (Socket Mode)
1. Under **Basic Information**, scroll to **App-Level Tokens**.
2. Click **Generate Token and Scopes**.
3. Name it `socket-token` and add the `connections:write` scope.
4. Copy the token (`xapp-...`).

#### Bot User Token & Installation
1. Go to **Install App** in the left sidebar and click **Install to Workspace**.
2. Copy the **Bot User OAuth Token** (`xoxb-...`).

### 3. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your tokens in `.env`:
```env
SLACK_BOT_TOKEN="xoxb-your-token-here"
SLACK_APP_TOKEN="xapp-your-token-here"
DATABASE_URL="file:./dev.db"
```

### 4. Database Setup & Start

1. Generate Prisma client and sync database schema:
```bash
pnpm db:push
```

2. Build and start the service:
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
├── manifest.json                  # Slack App manifest definition
├── package.json                   # Node.js dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── prisma/
│   ├── schema.prisma              # Database schema (Meetup, Modules)
│   └── dev.db                     # SQLite database file
├── src/
│   ├── index.ts                   # Application entry point and graceful shutdown
│   ├── db/
│   │   └── client.ts              # Prisma client singleton with WAL mode
│   ├── services/
│   │   └── meetupService.ts       # Business logic, time calculations, and report queries
│   ├── scheduler/
│   │   └── timerWorker.ts         # 30-second heartbeat worker and pacing notifications
│   ├── utils/
│   │   └── progressBar.ts         # Text-based progress bar generator
│   └── slack/
│       ├── app.ts                 # Slack Bolt app initialization
│       ├── utils/
│       │   └── huddleDiscovery.ts # Channel history scanner for active and recent Huddles
│       ├── ui/
│       │   ├── homeTab.ts         # App Home tab builder
│       │   ├── scheduleModal.ts   # Interactive schedule modal with Huddle selector
│       │   ├── huddleSelectModal.ts # Launch-time Huddle disambiguation modal
│       │   ├── trackerBlock.ts    # In-call live progress block and chatting banner
│       │   └── reportBlock.ts     # Pacing analytics report builder
│       └── handlers/
│           ├── homeHandlers.ts    # Home Tab events and report modal triggers
│           ├── modalHandlers.ts   # Modal submissions and dynamic channel refresh
│           ├── actionHandlers.ts  # Start, switch to chatting, and conclude buttons
│           ├── commandHandlers.ts # Slash commands (/pace, status, report, help)
│           └── huddleHandlers.ts  # Native Huddle lifecycle detection (auto-conclusion)
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
User=jhonatan
WorkingDirectory=/home/jhonatan/huddle-pace
ExecStart=/usr/bin/node /home/jhonatan/huddle-pace/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
sudo systemctl daemon-reload
sudo systemctl enable huddlepace.service
sudo systemctl restart huddlepace.service
sudo journalctl -u huddlepace.service -f
```

---

## License

MIT License.
