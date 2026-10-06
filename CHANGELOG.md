# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.9.2] - 2026-10-06

### Changed
- **Responsive WebP Images**: The home hero image is served as `hero-vector-400.webp` and `hero-vector-800.webp` with `srcset` (JPEG fallback kept), the full-body Vector image as `vectorfull.webp` (38 KB instead of 322 KB), and the 96 px avatar as `avatar-96.webp` (2 KB instead of 17 KB). Lighthouse had estimated 392 KiB of image savings and the hero image was the LCP element.

### Fixed
- **Scroll Reveal No Longer Fades Text In**: The entry animation on content pages only slides cards up. It used to start at `opacity: 0`, so Lighthouse and any renderer that does not scroll measured the card text at a 1.3:1 contrast ratio.

## [1.9.1] - 2026-10-06

### Fixed
- **Legal Pages Metadata**: `/privacy` and `/terms` titles grew from 27 and 29 characters to 37 and 39 ("... | HuddlePace Slack App"), the Spanish privacy description dropped from 163 to 142 characters so Google stops truncating it, and both pages gained `og:image` size and alt text, the full Twitter card tags and `WebPage` plus `BreadcrumbList` structured data.
- **Render-Blocking Fonts**: The Google Fonts stylesheet loads with `rel="preload"` and swaps to a stylesheet on load (with a `noscript` fallback). Lighthouse measured about 950 ms of render blocking from it and an LCP element render delay of 2.55 s on mobile.
- **Support Widget Contrast**: The launcher button used white text on `#06b6d4` (2.42:1). It now uses `#0e7490` (5.12:1), which clears WCAG AA.

### Changed
- **Versioned Assets Cache for a Year**: Asset URLs that carry `?v=` (the stylesheet) are served with `max-age=31536000, immutable`. Unversioned assets keep `max-age=3600, stale-while-revalidate=86400`.

## [1.9.0] - 2026-10-06

### Changed
- **All Content Pages Redesigned**: The Slack Huddle timer, daily standup, engineering managers and agencies pages (EN and ES) now use the same landing layout as the retrospective page: hero with an example agenda card, segmented time split, module cards, flat problem list, setup steps with a mock of the Huddle thread, FAQ with its own `FAQPage` markup and a closing call to action. Each page has its own content and example (15 / 60 / 25 team sync, 15-minute standup, RFC and post-mortem splits, 40 / 40 / 20 client sync) and runs 570 to 680 words per language, up from about 150.
- **Brand Rules Applied From the Start**: single-hue Telemetry Cyan ramp for splits, `tabular-nums` for timers and minutes, no reuse of semantic accent colors.

### Added
- **Commands List and Prose Blocks**: `.cmd-list` for the `/pace` commands and `.lp-prose` for short statements, used by the Huddle timer and the agencies page.
- **Test Coverage**: One test now checks all eight content URLs for the split bar, agenda card, `FAQPage` markup, resolved placeholders and a minimum word count.

## [1.8.2] - 2026-10-06

### Changed
- **Retrospective Page Follows the Brand Color Semantics**: The time-split bar and module cards use a single Telemetry Cyan ramp instead of cyan, amber and orange, which `docs/BRAND.md` reserves for the midpoint check and final-minute alerts. The "running now" dot is cyan instead of green.
- **Calmer Layout**: The "goes off the rails" and tips sections are flat lists with hairline separators instead of eight bordered cards. The duplicated Next Module tip was removed because the thread notes and the FAQ already cover it.
- **Tabular Numbers**: Timers, minutes and percentages on the page use `tabular-nums`, as the typography rules require.
- **BRAND.md**: `--text-muted` is documented as `#8A9BB3` (the previous `#64748B` fails the 4.5:1 rule), and the accent-color and tabular-numbers rules now cover web content pages.

## [1.8.1] - 2026-10-06

### Fixed
- **Retrospective Page Layout on Desktop**: The Huddle thread mock sat on the left with half the row empty. It now shares a two-column row with three short notes (live progress, private nudges, time that moves). The row stacks on narrow screens.

## [1.8.0] - 2026-10-06

### Changed
- **Sprint Retrospective Page Redesigned**: `/sprint-retrospective-agenda` and `/es/agenda-retrospectiva-sprint` are now a full landing page instead of the legal-page template. It has a two-column hero with an example agenda card, a segmented 20/50/30 time bar, module cards that reflow with container queries, a "four ways a retro goes off the rails" section, three setup steps with a mock of the Huddle thread, facilitator tips, a four-question FAQ and a closing call to action. Copy grew from about 150 to about 640 words per language.

### Added
- **Per-Page FAQ Structured Data**: A page can declare `__FAQ_JSON_LD:<prefix>__` and the server builds its `FAQPage` JSON-LD from the `<prefix>Faq<n>Q/A` locale keys, so markup and visible text cannot drift.
- **Landing Components in `site.css`**: `.lp-*`, `.split-bar`, `.agenda-card`, `.mod-card`, `.step`, `.thread` and `.reveal`. Entry reveals use scroll-driven animation only where supported and when motion is allowed.

## [1.7.1] - 2026-10-06

### Removed
- **Duplicate Image**: Deleted `public/assets/vectorful.png`, a byte-identical copy of `vectorfull.png` that no page referenced.

## [1.7.0] - 2026-10-06

### Added
- **Three More Content Pages (EN and ES)**: a meeting timer for engineering managers (RFC and post-mortem splits), a client call timer for agencies (weekly sync split and Just Chatting mode) and a sprint retrospective agenda (20/50/30 split). All are in the sitemap, now 16 URLs.
- **Cross-Linking**: Every content page ends with a "More guides" list linking to the others, with Spanish links resolving to Spanish pages.

### Changed
- **Support Widget Loads Idle on Every Page**: The legal pages and the first two content pages still loaded the widget synchronously. They now use the same idle loader as the home page.

## [1.6.2] - 2026-10-06

### Changed
- **Privacy Policy Cookie Statement**: Removed the mention of the `huddlepace_lang` cookie, which the site no longer sets, and updated the "Last updated" date. The language is now defined by the page address.

## [1.6.1] - 2026-10-06

### Fixed
- **Stale Stylesheet at the Edge**: Pages link `/assets/site.css?v=<app version>`, so each release gets a fresh URL. Cloudflare had kept serving the previous `site.css` under its old `immutable` header, which left the skip link and FAQ unstyled.

## [1.6.0] - 2026-10-06

### Added
- **Slack Huddle Timer Page**: `/slack-huddle-timer` and `/es/temporizador-huddle-slack` explain setup, what the team sees during a call, the real `/pace` commands, the zero-audio design and pricing.
- **Daily Standup Timer Page**: `/daily-standup-timer-slack` and `/es/temporizador-daily-standup-slack` cover a 15 / 60 / 25 module split, private speaker nudges, templates and `/pace report`.
- **FAQ on the Home Page**: Six visible questions in both languages, with `FAQPage` structured data generated from the same strings so the markup always matches the visible text.
- **Page Structured Data**: Content pages carry `WebPage` and `BreadcrumbList` JSON-LD.

### Changed
- **Sitemap and Footer**: The sitemap now lists 10 URLs. The Product footer column links to both new pages. Internal links on Spanish pages resolve to the matching Spanish URL.
- **Pricing Copy**: Pages state that HuddlePace is in early access and free today, that pricing will be per workspace, and that today's features stay free.

## [1.5.0] - 2026-10-06

### Added
- **Spanish Site on Its Own URLs**: `/es/`, `/es/privacy` and `/es/terms` serve the Spanish pages. Each page declares a self-referencing canonical, `hreflang` pairs (`en`, `es`, `x-default`) and `og:locale` tags, so Google can index both languages.
- **`/sitemap.xml` and `/robots.txt`**: The sitemap lists all six pages with `hreflang` alternates. `robots.txt` declares the sitemap and blocks `/slack/` endpoints.
- **Structured Data**: The home page JSON-LD is now an `Organization` + `WebSite` + `SoftwareApplication` graph (Spanish pages switch description and `inLanguage`).
- **Accessibility and Semantics**: `<main>` landmark, skip link, visible `:focus-visible` outline.

### Changed
- **Language Is Decided by the URL**: `Accept-Language`, the `huddlepace_lang` cookie and browser-language auto-switching no longer change page content. The EN/ES switcher is a pair of crawlable links. Cached HTML no longer varies on `Cookie` and no longer sets one.
- **Legacy URLs Redirect**: `/?lang=es` and `/?lang=en` 301 to `/es/` and `/`. `/es` and trailing-slash variants 301 to the canonical path.
- **Meta Tags**: Removed ignored `title`/`keywords` meta tags, switched Twitter tags to `name=`, added `og:image` size and alt text.
- **Performance**: Header and in-page avatars use a 96 px copy (17 KB instead of 619 KB). The support widget loads after the page is idle. Static assets use `max-age=3600, stale-while-revalidate=86400` instead of `immutable`, since file names carry no hash.
- **Headings and Contrast**: Decorative `h4`/`h5` elements became paragraphs to keep a clean outline. `--text-muted` was lightened to pass WCAG AA contrast.

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

[Unreleased]: https://github.com/tBeltty/huddle-pace/compare/v1.9.2...HEAD
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
