# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2026-10-07

### Added
- A "Share with workspace" checkbox next to "Save as template". Shared templates show up for every teammate in the template picker.

### Changed
- The template picker groups templates into "My templates" and "Shared by teammates". Templates stay private unless you share them.
- Only the owner can delete or overwrite a shared template. Teammates can start sessions from it.

## [1.5.0] - 2026-10-07

### Added
- A "Private huddle" checkbox in the Schedule Meetup modal. Private huddles run and post their tracker as usual and only appear in the analytics of their speakers and creator.

### Changed
- Analytics are private by default. Workspace admins, owners and bot managers see the workspace report. Everyone else sees only the huddles they spoke in or created.
- The pacing report says whether you are looking at your own numbers or the workspace.

### Notes
- Huddles scheduled before this release have no recorded creator. They stay visible to their speakers and to admins and managers, and the creator rule applies from now on.

## [1.4.0] - 2026-10-06

### Added
- **Edit Scheduled Meetups**: Speakers get an `✏️ Edit` button on their upcoming meetups in App Home. It opens the schedule modal prefilled (title, channel, speakers, duration, destination, reminders, modules) with a `Save Changes` action.
- **Edit Guardrails**: Only designated speakers can edit, and only while the meetup is still `SCHEDULED`. The update runs in a transaction that replaces the modules atomically, so a session that starts mid-edit is never altered.

### Fixed
- Meetups with a non-standard duration (for example 25 minutes from `/pace`) keep that value when reopened in the modal instead of falling back to 60.

## [1.3.1] - 2026-10-06

### Changed
- **Time Budget Fields Hold Real Values**: The agenda modal now starts with 15 / 60 / 25 as actual values (previously placeholders), so the default split can be scheduled as-is.
- **Auto-Balanced Percentages**: Editing a module's % and pressing Enter splits the remainder evenly across the other modules so the total stays at 100. Adding a module gives it an equal share and shrinks the others proportionally.

## [1.3.0] - 2026-10-06

### Added
- **Session Templates**: Tick "Save as template" in the Schedule Meetup modal to store the title, channel, speakers, duration, Huddle destination, reminder toggles, and agenda modules. Saving the same title again updates the template.
- **Start from a Template**: A new template picker at the top of the modal (available from `/pace`, the App Home button, and the global shortcut) prefills every field so a recurring call only needs `Schedule & Ready`.
- **Template Deletion**: A confirmed `Delete template` button appears when a template is selected.
- **Database Schema Support**: Added the `MeetupTemplate` model, private to its creator within the workspace.

### Changed
- Schedule modal inputs now carry a revision suffix in their `block_id` so Slack applies prefilled values, and handlers read inputs by `action_id`.

### Removed
- Dead `custom_duration_block` lookups in the schedule modal handlers (the block was never rendered).

## [1.2.0] - 2026-09-30

### Added
- **Role-Based Settings Access Control**: Implemented multi-tier authorization hierarchy restricting workspace settings mutation to Slack Workspace Admins & Owners, the app installer, and delegated "Bot Managers".
- **Delegated Bot Manager Role**: Added multi-user select block (`multi_users_select`) allowing authorized managers to delegate settings configuration to specific teammates without requiring Slack workspace admin privileges.
- **Read-Only Settings Modal View**: Regular workspace members opening Settings see an informational read-only modal (`🔒 Read-Only View`) with active reminder preferences, grace margin buffer, and designated managers without a Save button.
- **Backend Settings Security Interceptor**: Enforced server-side permission validation in `submit_settings_modal` to prevent unauthorized database updates.
- **Database Schema Support**: Added `managerUserIds` column to `WorkspaceSettings` for storing comma-separated delegated manager IDs.

### Added
- **Unified Workspace Settings Modal**: Added interactive Settings modal accessible via App Home and `/pace settings` allowing workspace-wide configuration of reminder formats and pacing flexibility.
- **Independent Finish-Line Reminder Toggles**: Configurable thread checkpoints with separate toggles for text message (`reminderTextEnabled`, active by default for subtle updates) and visual Vector illustration banner (`reminderImageEnabled`, optional for teams preferring a high-visibility, expressive visual prompt).
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

[Unreleased]: https://github.com/tBeltty/huddle-pace/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/tBeltty/huddle-pace/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/tBeltty/huddle-pace/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/tBeltty/huddle-pace/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/tBeltty/huddle-pace/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/tBeltty/huddle-pace/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/tBeltty/huddle-pace/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/tBeltty/huddle-pace/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/tBeltty/huddle-pace/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/tBeltty/huddle-pace/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/tBeltty/huddle-pace/releases/tag/v1.0.0
