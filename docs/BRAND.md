# HuddlePace Brand Identity & System Guide

Canonical, current brand reference: name, logo, palette, typography, voice, wordmark usage, and mascot design. This is the single source of truth for brand identity across HuddlePace — if a decision here conflicts with an older artifact, a conversation, or a memory note, **this file wins**; update it the moment a decision changes, in the same commit as the change.

---

## 1. Name & Positioning

- **Brand Name**: **HuddlePace**
- **Etymology**: "Huddle" (Slack's native voice/video space) + "Pace" (cadence, velocity, and boundary enforcement).
- **Spelling & Capitalization**: Always PascalCase (**HuddlePace**). Never all-lowercase (*"huddlepace"*), never separated with a hyphen in prose (*"Huddle-Pace"*), and never all-caps (*"HUDDLEPACE"*). In legal agreements and copyright notices, "HuddlePace" operates as a software product of tBeltty.
- **Canonical Domain**: `huddlepace.com`
- **Primary Taglines**:
  - *English*: *"15-minute huddles that actually take 15 minutes"*
  - *Spanish*: *"Reuniones de 15 minutos que duran 15 minutos"*
- **Secondary Descriptor**: *"Slack-native meeting cadence and speaker companion."* / *"Copiloto de cadencia para Slack Huddles."*

---

## 2. Logo & Visual Asset Architecture

The brand mark is built around **Vector**, the tactical flight navigator falcon from the Vibecoder Universe. The visual identity lives across dedicated directories with strict responsibilities:

| Asset | Path | Format & Dimension | Role / Surface |
| :--- | :--- | :--- | :--- |
| **Bot Avatar / App Icon** | `assets/avatar.png`, `public/assets/avatar.png` | PNG, 512x512 (Circular crop safe) | Official Slack App Directory, bot profile picture, navbar brandmark. |
| **Hero Key Visual** | `public/assets/hero-vector.jpg` | JPEG, 800x800 | Landing page hero card (Vector with active HUD visor and telemetry). |
| **Full Body Companion** | `public/assets/vectorfull.png` | PNG, 467x534 (Alpha transparency) | "Meet Vector" landing section and product cards. |
| **Favicon Suite** | `public/assets/favicon-*` | ICO, PNG (16x16, 32x32, 180x180) | Browser tab icons, PWA icons, mobile home screen bookmarks. |
| **Social / OpenGraph** | `public/assets/og-image.jpg` | JPEG, 1200x630 | Slack link previews, Twitter Card, OpenGraph meta image. |
| **Master Artworks** | `marketing/` | High-res originals | Character model sheets, turned views, and design directions (excluded from public npm dist). |

### Antialiasing and Background Discipline
All transparent PNG assets (`avatar.png`, `vectorfull.png`) are rasterized against neutral or dark slate foundations with smooth alpha gradients. They must never carry light halos or white edge artefacts when rendered against dark aerospace surfaces (`#080B11` / `#0F172A`).

---

## 3. Color Palette & Semantic Tokens ("Aerospace Telemetry")

The visual system adapts the **Atmos UI** design philosophy to an **Aerospace Flight & Telemetry** dark theme. It reflects precision instrumentation, radar consoles, and pilot HUDs.

### Core Brand Colors

| Swatch Role | Hex Value | CSS Token | Meaning & Usage |
| :--- | :--- | :--- | :--- |
| **Space Navy (Base)** | `#080B11` | `--bg-base` | Deep canvas background, space black foundation. |
| **Cockpit Slate (Surface)** | `#0F172A` | `--bg-surface` | Translucent glass panels (`rgba(15, 23, 42, 0.72)`), cards, modals. |
| **Slate Elevated** | `#1E293B` | `--bg-surface-hover` | Hover states, interactive surface lift (`rgba(30, 41, 59, 0.85)`). |
| **Telemetry Cyan (Primary Accent)** | `#06B6D4` | `--accent-cyan` | Active flight path, current timebox elapsed, glowing indicators. |
| **Visor Amber (Warning Accent)** | `#F59E0B` | `--accent-amber` | Midpoint flight check, 60% time elapsed, blocker alert prompt. |
| **Pilot Orange (Action Accent)** | `#F97316` | `--accent-orange` | Flight vest accents, high-priority buttons, 1-minute wrap-up alert. |
| **Slack Aubergine (Platform)** | `#611F69` | `--accent-slack` | Official Slack branding, "Add to Slack" OAuth entry points. |
| **Primary Text** | `#F8FAFC` | `--text-primary` | Headings, high-contrast values, active speaker names. |
| **Secondary Text** | `#94A3B8` | `--text-secondary` | Labels, module descriptions, helper guidance. |
| **Muted Text** | `#64748B` | `--text-muted` | ASCII bar remaining blocks, footer metadata, timestamps. |

### Semantic State Mapping (Slack Block Kit & Web)

Every phase of a timeboxed Huddle maps deterministically to a semantic color and emoji state:

```text
Phase 1: Active Timebox  -> Telemetry Cyan  [#06B6D4]  | Emoji: ⏱️  | Block: [████████░░░░░░░░]
Phase 2: Midpoint Check  -> Visor Amber     [#F59E0B]  | Emoji: 🧭  | Alert: 60% elapsed check
Phase 3: Final Minute    -> Pilot Orange    [#F97316]  | Emoji: ⚠️  | Alert: 1m remaining
Phase 4: Overtime Hold   -> Tactical Red    [#EF4444]  | Emoji: 🚨  | Alert: Over budget
Phase 5: Concluded       -> Emerald Touch   [#10B981]  | Emoji: ✅  | Alert: Session wrapped
Phase 6: Casual Chat     -> Coffee Warm     [#D97706]  | Emoji: ☕  | Mode:  Just Chatting
```

### Contrast & Accessibility Rules
- Text on `--bg-base` (`#080B11`) or `--bg-surface` (`#0F172A`) must always maintain at least **4.5:1 contrast** (WCAG AA).
- `--accent-cyan` (`#06B6D4`) and `--accent-amber` (`#F59E0B`) are used for accents, icons, and borders. When rendering readable body text, use `--text-primary` (`#F8FAFC`).
- Amber and red alerts must always be paired with icons (`🧭`, `⚠️`, `🚨`) and explicit status text, never relying on color alone for accessibility.

---

## 4. Typography

The typography system pairs an ergonomic contemporary geometric sans for interface communication with an ultra-legible monospace engine for telemetry, timeboxes, and ASCII progress meters.

### 1. Primary Display & UI: **Plus Jakarta Sans**
- **Source**: Google Fonts (SIL Open Font License — free, unrestricted commercial use).
- **Weights in Use**:
  - `400` (Regular): Secondary paragraphs and legal text.
  - `500` (Medium): Interactive buttons, navigation links, and table data.
  - `600` (SemiBold): Section titles, pillar headers, card badges.
  - `700` / `800` (Bold / ExtraBold): Hero titles (`h1`), milestone numbers.
- **CSS Variable**: `--font-main: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;`

### 2. Telemetry & Monospace: **JetBrains Mono**
- **Source**: Google Fonts / JetBrains (OFL).
- **Role**: All ASCII progress bars (`[████████░░░░░░░░] 50%`), timers (`10:14 AM`, `9m 12s / 15m`), slash commands (`/pace 15m`), and terminal telemetry.
- **Requirement**: Must use tabular numbers (`font-variant-numeric: tabular-nums`) so seconds and character widths remain rock-solid without horizontal jitter during live 30-second ticks.
- **CSS Variable**: `--font-mono: 'JetBrains Mono', monospace;`

---

## 5. Wordmark Convention

When "HuddlePace" renders as text inside web headers, navigation, or branded components:
1. **Two-Tone Rendering**:
   - `Huddle`: Inherits `--text-primary` (`#F8FAFC`).
   - `Pace`: Accented with `--accent-cyan` (`#06B6D4`) in standard telemetry contexts, or bold white with cyan glow in hero headers.
2. **Independence of Assets**:
   - The **Falcon Avatar** (`avatar.png`) and the **Wordmark** are independent, composable components.
   - The avatar can appear alone (Slack App Home, bot messages, favicon).
   - The wordmark can appear alone (running prose, footer legal lines).
   - Side-by-side lockup (avatar left, wordmark right) is standard for navigation headers.

---

## 6. Mascot Identity: Vector (The Pacer Falcon)

### Character Lore & Vibecoder Universe Connection
Vector is the flight navigator and cadence controller of the **Vibecoder Crew**. In the crew:
- **Cluck-O** (The Vibecoder Chicken) operates in the engineering trenches: building fast, shipping code, and hacking solutions.
- **Vector** (The Pacer Falcon) takes the high-altitude vantage point. He recognizes that maximum velocity without navigation creates circular meetings and burnout. His job is keeping developers on the flight path so they can return to uninterrupted deep work.

### Physical & Tactical Gear Specifications

| Feature | Design Specification |
| :--- | :--- |
| **Species** | Peregrine Falcon (*Falco peregrinus*) — the fastest animal on Earth. |
| **Plumage** | Soft slate grey, warm cream chest, deep navy flight feathers, and natural peregrine eye-stripe markings resembling a pilot's visor helmet. |
| **HUD Visor Ámbar** | Floating amber holographic display projecting countdowns, remaining minutes, and telemetry without obscuring his warm, attentive gaze. |
| **Aviation Headset** | Lightweight tactical earpiece with flexible boom mic and cyan LED indicator for clean, continuous crew comms. |
| **Pilot Flight Vest** | Aerospace tactical vest in dark navy and pilot orange, featuring a center zipper and an integrated digital cadence meter on the lapel. |
| **Micro-Thrusters** | Twin vector-thrust nozzles flush-mounted on the back of the vest for sharp tactical pivots. |
| **Anti-Gravity Talons** | Natural agile talons equipped with micro-telemetry rings for landing balance. |

### Mascot Generation Prompt Template (Gemini & Diffusion Pipelines)
To produce consistent, on-brand artwork for Vector across new poses or marketing collateral, use this base prompt template:

```text
Flat vector-style mascot illustration of a heroic peregrine falcon pilot named Vector,
clean bold ink outline, soft slate grey and cream feathers, dark navy blue and aerospace
orange tactical flight vest with zipper and lapel timekeeper badge, glowing translucent
amber holographic HUD monocle visor over one eye showing digital time metrics, lightweight
pilot aviation headset with cyan glowing LED, warm friendly focused gaze, minimal cel-shading
with crisp color boundaries (no photographic realism, no messy gradients, no noise), pure flat
colors matching #080b11 navy, #06b6d4 cyan, #f59e0b amber, #f97316 orange, crisp vector linework,
centered single subject on plain solid background, square composition, modern tech companion
mascot aesthetic like Linear and Duolingo, [INSERT POSE-SPECIFIC INSTRUCTION HERE].
```

#### Pose-Specific Clauses
- **Hero Monocle / Radar Scan**: *"falcon looking forward with confident reassuring half-smile, tapping the side of his amber HUD monocle, pilot-navigator ready mood."*
- **Midpoint Check / Blocker Alert**: *"falcon hovering slightly, holding up a small glowing holographic amber compass dial, focused collaborative problem-solving mood."*
- **Touchdown / Meeting Concluded**: *"falcon landing smoothly with wings folded, giving a crisp friendly pilot salute, mission-accomplished celebration mood."*
- **Casual Chat / Just Chatting**: *"falcon sitting comfortably, holding a small steaming ceramic coffee mug with both talons, relaxed coffee-break mood."*

---

## 7. Voice, Tone & Personality

Vector speaks with the cadence of an experienced, friendly flight controller:
- **Calm & Supportive**: Never panicked, never passive-aggressive, never punitive. Vector is an ally protecting everyone's focus, not a "meeting cop."
- **Concise & Direct**: Reports time remaining and active speakers in short, active sentences. Zero filler, zero corporate agile buzzwords (*"synergy"*, *"cadence velocity"*).
- **Positive Reinforcement**: Acknowledges when meetings end on time (*"Clean touchdown at 14m. The channel is clear."*).
- **Language Boundaries**:
  - **Slack In-App Elements**: **100% Strict English**. All Block Kit text, modal headers, button labels, and bot DM notifications must be in English.
  - **Marketing & Documentation (Spanish)**: **100% Strict Tuteo (`tú`/`tu`)**. Never use voseo (`vos`). Translate *meaning* rather than literal words (*"cuida tu tiempo"*, never *"valora el foco"*).

---

## 8. Slack App Directory Specifications

When configuring the application listing in the [Slack App Directory](https://api.slack.com/apps):
- **App Name**: `HuddlePace`
- **Short Description (English)**:  
  *Keep Slack Huddles on time. Visual thread progress bars and midpoint blocker alerts with zero audio recording.*
- **Short Description (Spanish)**:  
  *Mantén tus Slack Huddles a tiempo. Barras de progreso visuales y alertas de bloqueos sin grabar audio.*
- **App Icon**: `assets/avatar.png` (512x512 PNG, RGB, no transparency issues around borders).
- **Background Color**: `#0f172a` (Cockpit Slate) or `#080b11` (Space Navy).
- **Bot Display Name**: `Vector`
- **Default Username**: `huddlepace`
