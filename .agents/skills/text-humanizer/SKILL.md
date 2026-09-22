---
name: text-humanizer
description: "Rewrites AI-generated or robotic-sounding text into natural human prose: increases sentence-length variation (burstiness), cuts cliché AI vocabulary (ES/EN), restores active voice, targets Flesch readability 60-70. Treats every proper name, number, date, quote, brand, and Slack token in the source as immutable (grounding/fact-shielding) and flags unsupported claims instead of inventing replacements. Two modes: Balanced (default, for formal/technical prose) and Intense (opt-in, creative/brand-voice writing). For HuddlePace's own app/Slack copy, prefer `no-ai-slop` first — use this skill for general marketing prose, blog posts, emails, or explicit humanization requests. Source: finances_app & manual-tecnico-humanizacion."
---

# 🧬 Text Humanizer — HuddlePace

## 🎯 Objective
Erase the statistical fingerprint of LLM output — homogeneous sentence length, low perplexity, corporate cliché vocabulary, weak transitions, passive voice — without altering a single fact, name, number, date, quote, brand, or technical parameter from the source. Humanize the *style*, never the *substance*.

## 🔀 When to Use This vs `no-ai-slop`
- **HuddlePace In-App Copy** (Slack Block Kit cards, modals, notifications, command responses, `README.md`, `PRODUCT_CAPABILITIES_LOG.md`) $\rightarrow$ use `no-ai-slop` first; it already encodes this project's specific aerospace/telemetry voice.
- **Marketing, Guides & External Text** (Blog articles, customer case studies, comparison pages, founder emails, or explicit "humanize this" / "make it sound human" requests) $\rightarrow$ use this skill.

## 🔒 Non-Negotiable Rule: Grounding (Fact-Shielding)
Before rewriting, extract and lock down every **protected token** from the source:
- **Slack Tokens & Commands**: `/pace`, `/pace start`, `/pace status`, `/pace next`, `/pace wrap`, `/pace cancel`, `/pace report`, `<@U...>`, `<#C...>`.
- **Numerical Specifications**: Duration parameters (`15m`, `45m`, `90m`), percentage allocations (`50/30/20`), time limits (`1.5 min per speaker`), zero audio retention (`0% audio recorded`).
- **Brand & Character Names**: HuddlePace, Vector (The Pacer Falcon), Vibecoder Universe, Cluck-O, Slack, Slack Huddles, SQLite WAL, Prisma.
- **Direct Quotes, Statistics & Dates**.

These are strictly immutable in **both modes** — never delete, rephrase, or substitute them. If an original sentence asserts a technical capability not found in the codebase or docs, do not launder it into smooth human prose; append `[verify source]` instead.

## 🎛️ Two Modes

### Balanced Mode (default)
For documentation, technical release notes, onboarding guides, and B2B emails.
- Varies sentence length (burstiness).
- Cuts robotic vocabulary and corporate filler.
- Converts passive voice to active voice.
- Targets Flesch reading ease 60–70.
- Preserves the professional engineering register.

### Intense Mode (opt-in — marketing narrative & brand storytelling only)
Only when explicitly requested by the user, or for founder origin stories, Vector brand narrative, and creative case studies.
- Breaks predictable, inoffensive AI cadence.
- Drops two-sided hedging ("while some may argue...").
- Grounds descriptions in tangible sensory friction (e.g. awkward silence when someone is talking on mute, frantic tab switching during a demo, 45 minutes lost to a minor code style debate).
- Uses asymmetric punctuation and conversational dialectic transitions.
- *Strict limitation*: Never apply Intense Mode to Slack UI blocks or technical specs; those remain strictly in Balanced Mode / `no-ai-slop`.

## 📊 Metrics (Applied as Judgment)
| Metric | Target | How to Act on It |
|---|---|---|
| **Burstiness** | Dynamic sentence variation | If every sentence sits between 15 and 25 words, break at least one under 6 words. Follow a short punchy sentence with a longer descriptive clause. |
| **Perplexity** | Unpredictable, natural phrasing | Replace stock LLM collocations ("significantly optimize", "streamline your daily standup") with concrete engineering verbs ("stop standups from dragging past 15 minutes"). |
| **Readability** | Flesch ease ~60–70 | Ensure sentences are easily parsed while reading Slack channels or quick documentation. |

## ⛔ Cliché Lexicon

### English Banned Terms
| AI Cliché | Human Alternative |
|---|---|
| delve into | look at, explore, examine |
| empower teams | give teams, let developers |
| seamlessly integrate | works inside Slack, connects to |
| robust solution | reliable tool, solid system |
| revolutionize meetings | finish calls on time, cut meeting drift |
| testament to | shows, proves |
| in today's fast-paced world | today, in remote engineering |
| game changer | practical fix, major improvement |

### Spanish Banned Terms
| Cliché IA | Reemplazo Humano |
|---|---|
| aprovechar | usar, exprimir, utilizar |
| sumergirse en | ver, revisar, entrar en |
| facilitar | permitir, ayudar, dar |
| iniciativa estratégica | proyecto, plan, objetivo |
| partes interesadas | equipo, clientes, participantes |
| en la era digital | hoy, en equipos remotos |
| es importante destacar | directo al punto sin preámbulos |

## 🔁 Voice: Active Over Passive
- *Passive AI*: "Time overruns are prevented by the automated Slack notifications."
- *Active Human*: "HuddlePace pings the speaker before the timebox runs out."
- *Passive ES*: "Una mejor cadencia de reunión es facilitada por la división en módulos..."
- *Active ES*: "Dividir la reunión en módulos mantiene al equipo enfocado..."

## ✅ Post-Edit Verification
1. All protected tokens (`/pace`, minutes, Slack handles, zero-audio retention) remain intact and unaltered.
2. Cliché buzzwords have been purged.
3. Sentence length varies visibly across paragraphs.
4. No new factual claims or unsupported features were hallucinated.
5. Return the humanized draft with a brief **What Changed** summary.
