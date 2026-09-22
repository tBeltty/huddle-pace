---
name: no-ai-slop
description: "MANDATORY for user-facing copy: removes AI-slop writing patterns (binary contrasts 'no es X, es Y', throat-clearing openers, colon reveals, importance puffery, fake-profound endings, em-dash overuse, banned buzzwords) from Slack Block Kit messages, modal views, landing pages, marketing dossiers, docs, and CHANGELOG entries while preserving HuddlePace's tactical cadence voice, in English or Spanish. Execute proactively, not only when the user types '/no-ai-slop'. Adapted from finances_app & petergyang/no-ai-slop."
---

# ✍️ No AI Slop — HuddlePace

## 🎯 Objective
Keep every piece of user-facing prose in HuddlePace sounding like this project — direct, precise, flight-pacer sharp, allergic to corporate agile fluff and marketing exaggeration — instead of sounding like generic AI output. This exists to protect HuddlePace's tone across Slack Block Kit cards, landing page copy, marketing dossiers, and technical documentation.

## 🚨 Mandatory Execution Rule
- **Run this check on every draft of user-facing prose**:
  - **Slack Block Kit copy & Bot messages**: Modals, in-channel progress cards, DM alerts, overflow notifications (`src/views/**`, `src/handlers/**`, `src/utils/**`).
  - **Web & Marketing**: Landing page (`marketing/index.html`), marketing dossier (`marketing/MARKETING.md`), character and GTM assets.
  - **Documentation & Specs**: `README.md`, `docs/**`, `docs/TARGET_NICHES.md`, and `docs/PRODUCT_CAPABILITIES_LOG.md`.
  - **Changelogs & Git Commits**: Release narratives and commit messages.
- Does **not** apply to unit tests, pure code logic, or internal agent scratch notes.

## 🌐 Language Policy & Rules

### 1. Strict English Policy for Slack UI
- **100% of Slack in-app text must be in English**: Block Kit headers, section text, modal labels, button text, overflow menus, error ephemerals, and DM notifications.
- When reminding teams about time or topic transitions, use neutral, non-accusatory language. Never act like an abrasive "meeting copilot" or "time cop".

### 2. Marketing & Documentation (Bilingual ES / EN)
When drafting Spanish copy for marketing, target niches, or internal documentation:
- **NEVER voseo. Always tuteo.** Use `tú`/`tu` conjugations (sube, tienes, puedes, elige), never `vos` (subí, tenés, podés, elegí). Catch imperative and second-person verbs ending in stressed vowels.
- **Translate meaning, never words.** Any time content moves between EN and ES, translate the *intent* of the phrase in its target-language idiom. Literal calques sound synthetic and alter nuance.
- **Pan-regional Spanish:** Avoid Spain-only peninsular idioms ("móvil", "céntimo", "apetecer") and hyper-local slang. Use neutral, professional phrasing ("teléfono", "centavos", "reunión", "llamada").

## 🛠️ Two Jobs
1. **Edit (default).** Minimum effective edit against the rules below, followed by a short **What Changed / Qué cambió** summary.
2. **Detect.** On "is this slop?" requests: identify each pattern, quote the offending line, and provide the concrete fix without grading or guessing model authorship.

## 📋 Editing Principles
- **Preserve the Voice of Vector (The Pacer Falcon):** Tactical, calm, aeronautical cadence. Clear telemetric status over rhetorical persuasion.
- **Active Voice & Physical Concrete Actions:** Use real engineering and team actions ("wrap up PR review", "switch to Q&A block", "close the huddle") instead of corporate abstractions ("synergize team momentum", "optimize discussion bandwidth").
- **Zero Unverifiable Claims:** Never claim "100% productive meetings" or "eliminates all wasted time". State only what the codebase actually does: allocates module percentages, renders monospace progress bars, alerts speakers privately, and retains 0% audio data.
- **Portability Test:** If a sentence could be pasted onto any generic SaaS or agile consultancy website without modification, cut it or ground it in HuddlePace facts (timeboxes, Slack huddles, `/pace` commands).

## ⛔ Words to Cut
delve, foster, leverage, utilize, facilitate, empower, streamline, robust, cutting-edge, paradigm shift, game changer, tapestry, realm, beacon, multifaceted, meticulous, paramount, transformative, elevate, embark, supercharge, harness, ever-evolving, world-class, revolutionary, best-in-class, synergize, holistic, seamless, trailblazing — plus empty adverbs (just, literally, honestly, simply, actually, truly, fundamentally, crucially) and conversational filler (it's worth noting, at the end of the day, at its core, the reality is, going forward).

## ⛔ Patterns to Cut

| Pattern | Offending Example (EN / ES) | Correct Human Fix |
|---|---|---|
| **Binary Contrast** | "HuddlePace isn't just a timer, it's your meeting copilot." / "No es solo un cronómetro, es..." | State the fact directly: "HuddlePace tracks topic timeboxes inside Slack huddles." |
| **Throat-Clearing Opener** | "Here's the thing:" / "Cabe destacar que las reuniones..." | Cut completely; start with the concrete observation. |
| **Faux-Insight Setup** | "What nobody tells you about standups..." / "Lo que nadie te dice de las reuniones..." | State the operational problem plainly without dramatic prelude. |
| **Theatrical Colon Reveal** | "The result: meetings finish 15 minutes faster." / "El resultado: foco total." | Combine into a single direct sentence: "Meetings finish within their scheduled time." |
| **Importance Puffery** | "Marks a revolutionary milestone in agile rituals." | "Allows Scrum Masters to assign minutes per speaker." |
| **Weasel Attribution** | "Studies show remote workers hate meetings." (no citation) | Cite specific data or describe the observable operational bottleneck. |
| **Fake-Profound Kicker** | "Because time is the only currency that truly matters." | Delete. End on the last actionable instruction or data point. |
| **Summary-Recap Ending** | "In conclusion, HuddlePace elevates your teamwork." | End on the concrete next action (e.g. `/pace start 15m`). |
| **Em Dash Rhythm Crutch** | Overusing `—` to string together disparate thoughts. | Zero em-dashes in Slack Block Kit / UI copy. Use periods or commas. Max 1-2 in long-form guides. |
| **False Agency** | "Efficiency naturally emerges when..." | Name the actual actor: "When teams set explicit timeboxes per agenda item..." |
| **Narrator-from-a-Distance** | "Nobody designed huddles to last 50 minutes." | "A 10-minute huddle easily stretches to 50 minutes when debugging code live." |
| **Slide-Transition Scaffolding** | "HuddlePace operates in two distinct modes, depending on the scenario:" | State directly: "Use `/pace start` for structured agendas or `/pace 15m` for open timers." |
| **Symmetrical Tripartite Rhythm** | "It tracks your agenda, alerts the speaker, and frees your team." | Break the 3-item rule: "It tracks agenda modules and pings the speaker before overtime." |
| **Orphaned Prepositional Fragment** | ". Without audio recording and without intrusive bots." | Connect with comma: ", without audio recording or external bots in the call." |
| **Task-Oriented Decision Trees** | "If you run an architecture review, open the modal, select modules, and configure..." | Frame from team relief: "In architecture reviews, allocating 20 minutes for objections prevents the call from ending without a consensus." |
| **Defensive Negation** | "We will never spy on your microphone." | State the architectural guarantee directly: "HuddlePace stores zero audio. Telemetry uses message timestamps only." |

## ✅ Standard Workflow
1. Read the full draft.
2. Identify the core message and the context (Slack notification, Block Kit modal, or landing copy).
3. If reviewing: cite each violation, quote the offending text, and provide the rewritten sentence.
4. If editing: apply minimal effective changes, preserving brevity and precision.
5. Self-check against the Banned Words & Patterns table.
6. Return the cleaned copy along with a concise **What Changed** section.
