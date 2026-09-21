# ⏱️ HuddlePace

> **Slack-native meeting timekeeper and speaker companion to prevent meeting dilation.**

HuddlePace is an internal Slack app built with **Node.js v26.9.0**, **TypeScript**, and **Slack Socket Mode**. It solves the problem of 45-minute technical talks, knowledge shares, and onboarding sessions drifting into 3–5 hour marathons.

It operates with a **$0 external footprint** (zero external paid LLMs, zero cloud servers required, zero public ingress ports needed).

---

## 🌟 Key Features

1. **Slack App Home Tab (Visual Dashboard)**:
   - A dedicated graphical dashboard inside Slack.
   - Click **`[ ➕ Schedule New Meetup ]`** to open the interactive configuration modal.
   - Real-time cards showing active sessions and upcoming scheduled talks.

2. **Modular Percentage Allocator**:
   - Organizers define custom modules and subtopics (e.g., *Context: 15%*, *Core Demo: 60%*, *Q&A: 25%*).
   - Dynamically add unlimited subtopic rows with the **`[ ➕ Add Another Subtopic ]`** button.
   - Enforces 100% time budget alignment before saving.

3. **In-Place Live Huddle Tracker**:
   - Posts a single message in the target channel or Huddle chat thread.
   - Updates every 30 seconds with a visual progress bar (`[████████░░░░░░░░] 50%`), active module, and time remaining.
   - Eliminates notification noise while keeping everyone naturally conscious of elapsed time.

4. **Speaker Pacing Copilot (Private DMs)**:
   - Sends direct, private notifications to the speaker as each module concludes.
   - Keeps the speaker on pace without embarrassing public interruptions.

5. **Gentle Social Exit Ramp**:
   - Automatically posts an official conclusion notice once 100% of the scheduled time is reached.
   - Releases team members who have subsequent commitments without awkwardness.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js v26.9.0 (ESM, TypeScript)
- **Framework**: `@slack/bolt`
- **Transport**: Slack Socket Mode (WebSocket, zero inbound firewall holes)
- **Persistence**: SQLite with Prisma ORM (durable file-based store in `prisma/dev.db`)
- **Cost**: $0 (100% deterministic arithmetic, zero external paid API keys)

---

## 🚀 Quick Setup Guide (5 Minutes)

### 1. Create the Slack App via Manifest
1. Navigate to the [Slack App Management Portal](https://api.slack.com/apps).
2. Click **Create New App** > **From an app manifest**.
3. Select your workspace.
4. Copy and paste the contents of [`manifest.json`](./manifest.json) into the JSON tab and click **Create**.

### 2. Generate Credentials & Tokens

#### A. App-Level Token (for Socket Mode)
1. In your app settings under **Basic Information**, scroll down to **App-Level Tokens**.
2. Click **Generate Token and Scopes**.
3. Name it `socket-token` and add the scope:
   - `connections:write`
4. Copy the token starting with `xapp-...`.

#### B. Install App & Bot Token
1. Go to **Install App** in the left sidebar and click **Install to Workspace**.
2. Copy the **Bot User OAuth Token** starting with `xoxb-...`.

#### C. Signing Secret
1. In **Basic Information**, locate **Signing Secret** under *App Credentials* and click **Show**.

---

### 3. Configure Local Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your Slack credentials in `.env`:
```env
SLACK_BOT_TOKEN="xoxb-your-token-here"
SLACK_APP_TOKEN="xapp-your-token-here"
SLACK_SIGNING_SECRET="your-signing-secret-here"
DATABASE_URL="file:./dev.db"
```

---

### 4. Database Setup & Start Application

1. Push the database schema:
```bash
npm run db:push
```

2. Start HuddlePace in development mode:
```bash
npm run dev
```

You should see:
```text
⚡️ HuddlePace is live and connected via Slack Socket Mode!
⏱️ Periodic scheduler is tracking active meetups.
```

---

## 📖 How to Use

### Method 1: Visual App Home (Recommended)
1. Open Slack, scroll down the left sidebar to **Apps**, and click **HuddlePace**.
2. Navigate to the **Home** tab.
3. Click **`➕ Schedule New Meetup`**.
4. Fill in your topic, choose the channel, set the duration, and adjust module percentages.
5. Click **Schedule & Ready**.

### Method 2: Global Shortcut
- In any channel, click the **`+`** (or ⚡) shortcut button in the message composer.
- Search for **Schedule Meetup**.

### Method 3: Slash Command
- Type `/pace` to open the scheduling modal.
- Type `/pace status` to inspect active meetups in the current channel.

---

## 📂 Project Structure

```text
huddle-pace/
├── manifest.json             # 1-Click Slack App definition
├── package.json              # Node.js 26 dependencies
├── tsconfig.json             # TypeScript compiler settings
├── prisma/
│   └── schema.prisma         # Relational database models
├── src/
│   ├── index.ts              # Bootstrap & process lifecycle
│   ├── db/
│   │   └── client.ts         # Prisma client singleton
│   ├── services/
│   │   └── meetupService.ts  # Pacing calculations & state engine
│   ├── scheduler/
│   │   └── timerWorker.ts    # Durable 30s heartbeat updater
│   ├── utils/
│   │   └── progressBar.ts    # Visual progress bar generator
│   └── slack/
│       ├── app.ts            # Bolt Socket Mode client
│       ├── ui/
│       │   ├── homeTab.ts        # App Home dashboard builder
│       │   ├── scheduleModal.ts  # Dynamic Block Kit modal
│       │   └── trackerBlock.ts   # Live in-channel progress block
│       └── handlers/
│           ├── homeHandlers.ts   # App Home events
│           ├── modalHandlers.ts  # Modal interactions & validation
│           ├── actionHandlers.ts # Live buttons (Start / Conclude)
│           └── commandHandlers.ts# Slash commands & shortcuts
└── README.md
```

---

## 📄 License
MIT. Built for internal engineering team excellence.
