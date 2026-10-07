# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.10.1] - 2026-10-06

### Added
- A test fails when a changelog entry from 1.5.0 on uses banned words, bold-label colons, dashes or binary contrasts, so release notes are reviewed before they publish.

### Changed
- Rewrote the release notes for 1.5.0 to 1.10.0 in plain language. Implementation detail stays in the Product Capabilities Log.

## [1.10.0] - 2026-10-06

### Added
- Unknown URLs return a 404 page in English or Spanish, marked `noindex` so search engines drop them. Slack's endpoints are not affected.
- Every sitemap URL has a `lastmod` date that changes only when that page's content changes. Run `pnpm page-dates` after editing a page.

### Changed
- Cloudflare's analytics script loads after the page finishes loading, which shortens mobile load time. Analytics keep working. A visit that ends before the page finishes loading is no longer counted.

## [1.9.5] - 2026-10-06

### Fixed
- `/privacy` and `/terms` have a main content region and a skip link, like every other page.

## [1.9.4] - 2026-10-06

### Changed
- Fonts load from huddlepace.com instead of Google Fonts, so first paint no longer waits on a third-party server. In Lighthouse, mobile first paint went from as slow as 3.6 s to 2.1 s at most.
- Font files are cached for a year.

### Fixed
- The home page menu fits phones 480 px wide or narrower. At that width the GitHub link shows only its icon.

## [1.9.3] - 2026-10-06

### Changed
- The tag under the home hero image reads "Flight Pacer · Efficiency Crew".

## [1.9.2] - 2026-10-06

### Changed
- Home page images load as WebP sized to the screen. The Vector hero is 17 KB on small screens and 55 KB on large ones, down from 102 KB. The full-body image is 38 KB, down from 322 KB.

### Fixed
- Cards on the content pages no longer start transparent, which made their text fail contrast checks until it scrolled into view.

## [1.9.1] - 2026-10-06

### Changed
- Files requested with `?v=` in the URL are cached for a year.

### Fixed
- `/privacy` and `/terms` have longer titles, a Spanish privacy description within Google's 160 characters, social preview details and structured data.
- The support button passes the WCAG AA contrast ratio (5.12:1, was 2.42:1).
- The Google Fonts stylesheet no longer blocks first paint.

## [1.9.0] - 2026-10-06

### Added
- The `/pace` command list and short statement blocks, used on the Huddle timer and client call pages.
- One test covers all eight content URLs.

### Changed
- The Slack Huddle timer, daily standup, engineering managers and client call pages, in English and Spanish, use the same layout as the retrospective page. Each has its own example, steps and FAQ, and runs 570 to 680 words, up from about 150.

## [1.8.2] - 2026-10-06

### Changed
- The retrospective time split uses one cyan color family. The brand guide reserves amber and orange for alerts. The "now running" dot is cyan instead of green.
- The problem and tips sections are plain lists, and a duplicate tip is gone.
- Timers and minutes use fixed-width digits.
- `docs/BRAND.md` lists the muted text color as `#8A9BB3`, because the previous value failed the 4.5:1 contrast rule.

## [1.8.1] - 2026-10-06

### Fixed
- On desktop, the Huddle thread mock on the retrospective page sat beside an empty half row. It now sits beside three short notes and stacks on narrow screens.

## [1.8.0] - 2026-10-06

### Added
- A page can build its FAQ structured data from its own locale strings.

### Changed
- The retrospective page is a full landing page with an example agenda card, a 20/50/30 time split, setup steps, a mock of the Huddle thread, facilitator tips, an FAQ and a closing call to action. It grew from about 150 to about 640 words per language.

## [1.7.1] - 2026-10-06

### Removed
- `public/assets/vectorful.png`, a duplicate of `vectorfull.png` that no page used.

## [1.7.0] - 2026-10-06

### Added
- Pages for engineering managers (RFC and post-mortem splits), agencies (weekly client sync and Just Chatting mode) and sprint retrospectives, in English and Spanish. The sitemap lists 16 URLs.
- Each content page ends with links to the other guides.

### Changed
- The support widget loads when the page is idle on every page.

## [1.6.2] - 2026-10-06

### Changed
- The privacy policy no longer mentions the `huddlepace_lang` cookie, which the site stopped setting. Its last-updated date is October 6, 2026.

## [1.6.1] - 2026-10-06

### Fixed
- Pages request `site.css` with the release version in the URL. Cloudflare had kept serving an old copy, which left the skip link and the FAQ unstyled.

## [1.6.0] - 2026-10-06

### Added
- Pages for the Slack Huddle timer and the daily standup timer, in English and Spanish, with the real `/pace` commands.
- A six-question FAQ on the home page, with structured data built from the same text as the visible answers.
- Page and breadcrumb structured data on the content pages.

### Changed
- The sitemap lists 10 URLs and the footer links to both guides. Spanish pages link to Spanish pages.
- The pages say HuddlePace is in early access and free today, with future pricing per workspace and never per user.

## [1.5.0] - 2026-10-06

### Added
- Spanish pages at `/es/`, `/es/privacy` and `/es/terms`, each with its own address, canonical tag and `hreflang` pair, so Google can index both languages.
- `/sitemap.xml` and `/robots.txt`.
- Structured data for the organization, the website and the app.
- A main content region, a skip link and a visible keyboard focus outline.

### Changed
- The URL sets the language. Browser language, cookies and `?lang=` no longer change the content, and `?lang=` redirects to the matching address.
- Social tags are cleaner: unused meta tags removed, Twitter tags use `name=`, and the preview image has a size and alt text.
- The header avatar is 17 KB instead of 619 KB.
- Decorative headings became paragraphs, and muted text has higher contrast.

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

[Unreleased]: https://github.com/tBeltty/huddle-pace/compare/v1.10.1...HEAD
[1.10.1]: https://github.com/tBeltty/huddle-pace/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/tBeltty/huddle-pace/compare/v1.9.5...v1.10.0
[1.9.5]: https://github.com/tBeltty/huddle-pace/compare/v1.9.4...v1.9.5
[1.9.4]: https://github.com/tBeltty/huddle-pace/compare/v1.9.3...v1.9.4
[1.9.3]: https://github.com/tBeltty/huddle-pace/compare/v1.9.2...v1.9.3
[1.9.2]: https://github.com/tBeltty/huddle-pace/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/tBeltty/huddle-pace/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/tBeltty/huddle-pace/compare/v1.8.2...v1.9.0
[1.8.2]: https://github.com/tBeltty/huddle-pace/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/tBeltty/huddle-pace/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/tBeltty/huddle-pace/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/tBeltty/huddle-pace/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/tBeltty/huddle-pace/compare/v1.6.2...v1.7.0
[1.6.2]: https://github.com/tBeltty/huddle-pace/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/tBeltty/huddle-pace/compare/v1.6.0...v1.6.1
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
