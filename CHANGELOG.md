# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-09-30

### Added
- **Role-Based Settings Access Control**: Implemented multi-tier authorization hierarchy restricting workspace settings mutation to Slack Workspace Admins & Owners, the app installer, and delegated "Bot Managers".
- **Delegated Bot Manager Role**: Added multi-user select block (`multi_users_select`) allowing authorized managers to delegate settings configuration to specific teammates without requiring Slack workspace admin privileges.
- **Read-Only Settings Modal View**: Regular workspace members opening Settings see an informational read-only modal (`🔒 Read-Only View`) with active reminder preferences, grace margin buffer, and designated managers without a Save button.
- **Backend Settings Security Interceptor**: Enforced server-side permission validation in `submit_settings_modal` to prevent unauthorized database updates.
- **Database Schema Support**: Added `managerUserIds` column to `WorkspaceSettings` for storing comma-separated delegated manager IDs.

### Added
- **Unified Workspace Settings Modal**: Added interactive Settings modal accessible via App Home and `/pace settings` allowing workspace-wide configuration of reminder formats and pacing flexibility.
- **Independent Finish-Line Reminder Toggles**: Configurable thread checkpoints with separate toggles for text message (`reminderTextEnabled`, active by default) and visual Vector illustration banner (`reminderImageEnabled`, disabled by default), eliminating disruptive large images from active Huddle threads by default.
- **Configurable Pacing Flexibility Modes**: Added workspace grace margin controls (`Standard` [15%], `Relaxed` [25%], `Strict` [0%]) directly integrated into the settings modal and compliance analytics.
- **Per-Session Reminder Overrides**: Added finish-line reminder preference checkboxes to the agenda scheduler modal (`buildScheduleModal`) for granular meeting control.

## [1.1.0] - 2026-09-30

### Added
- **Pacing Analytics Flexibility (Grace Period)**: Integrated smart grace margin (`calculateGraceMinutes`: 10m buffer for 60m calls, 5m for 30m, 3m for 15m) ensuring meetings wrapping up 3–5 minutes after scheduled budgets maintain team compliance (`isWithinGrace = true`) and display clear three-state status indicators (`✅ On Time`, `⏳ Flexible`, `⚠️ Overtime`).
- **Single Non-Invasive Time Check Reminder**: Added automated gentle thread check dispatched once per session when ~16.7% of timebox remains (10m before close on 1-hour sessions), pairing concise contextual guidance with canonical Vector artwork (`reminder-healthy.jpg`).

### Fixed
- **In-Thread Ephemeral Permission Routing**: Routed all `Access Denied` ephemeral notifications into the active Huddle thread (`thread_ts`) instead of the main channel root when unauthorized spectators interact with session controls.

## [1.0.1] - 2026-09-30

### Changed
- **Slack App Home Role-Gating**: Restricted interactive control buttons strictly to authorized speakers:
  - Omitted the "Start in Huddle" button from "Workspace Meetups" for non-speakers.
  - Omitted the "Conclude" button from "Active Sessions" for spectators.

### Fixed
- **Package Manifest Resolution**: Removed redundant `main` property from `package.json` for application service, resolving Linux runner symlink collision on optional dependencies (`fsevents`) during automated CI tests.

## [1.0.0] - 2026-09-22

### Added
- **Multi-Tenant OAuth 2.0 & Installation Store**: Dual-mode transport (Socket Mode for development, HTTP OAuth for multi-workspace production) backed by Prisma and SQLite WAL.
- **Dynamic Modular Pacing**: Schedule meetings with customizable agenda modules (percentages totaling 100%) and automatic minute allocation with rounding reconciliation.
- **In-Huddle Live Progress Tracker**: Interactive Block Kit flight tracker attached to Slack Huddles with real-time progress bars, module status, and speaker alerts.
- **Midpoint and 1-Minute Transition Alerts**: Private speaker DMs dispatched at key pacing milestones without interrupting audio feeds.
- **Interactive Session Controls**:
  - `⏭️ Next Module`: Early advance with saved minutes transferred directly to the immediate next topic.
  - `☕ Just Chatting`: Switch to post-agenda casual chat mode when formal discussion concludes early.
  - `⏱️ Snooze / Extend`: Add 5, 10, or 20 minutes to accommodate deep architectural discussions.
  - `⏹️ Conclude`: Finalize meeting and generate summary pacing reports.
- **Slash Commands**:
  - `/pace`: Open the modular agenda scheduler modal.
  - `/pace status`: Check running sessions in the current channel.
  - `/pace report [days]`: Generate workspace pacing compliance metrics.
  - `/pace clear`: Clean up bot direct messages.
  - `/pace help`: Interactive command and tips reference.
- **Personalized Slack App Home**: Minimalist agenda dashboard partitioned into personal scheduled meetups, workspace sessions, and active pacing tracks.
- **Live Support Chat Widget**: Embedded bi-directional support chat on `huddlepace.com` integrating with the customer support backend.
- **Multi-Lingual Landing Page**: High-performance SSR landing page in English and Spanish with automated language negotiation (`Accept-Language`, query param, and cookie fallback).

[Unreleased]: https://github.com/tBeltty/huddle-pace/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/tBeltty/huddle-pace/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/tBeltty/huddle-pace/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/tBeltty/huddle-pace/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/tBeltty/huddle-pace/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/tBeltty/huddle-pace/releases/tag/v1.0.0
