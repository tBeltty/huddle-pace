# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Slack App Home Role-Gating**: Restricted interactive control buttons strictly to authorized speakers:
  - Omitted the "Start in Huddle" button from "Workspace Meetups" for non-speakers.
  - Omitted the "Conclude" button from "Active Sessions" for spectators.

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

[Unreleased]: https://github.com/tBeltty/huddle-pace/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tBeltty/huddle-pace/releases/tag/v1.0.0
