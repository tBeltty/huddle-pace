---
name: proofreading
description: "When the user wants a mechanical grammar/punctuation/spelling pass on finished copy (not a rewrite) in Spanish or English. Also use when the user says 'revisa la puntuación,' 'proofread this,' 'corrige gramática,' or 'chequeo mecánico.' Surface-level error correction only — pairs with copy-editing (message-level) and no-ai-slop (pattern-level), does not replace either."
metadata:
  version: 1.0.0
---

*Adapted 2026-09-07 from [xcrrr/claude-skills](https://github.com/xcrrr/claude-skills)'s
`proofreader` skill (MIT). The source is English-only (Oxford comma, apostrophes, etc.) — this
version keeps its scope, process, and output-format intent but replaces every mechanical rule
with the Spanish equivalent alongside the English one, since this project ships user-facing
copy in both (`.agents/AGENTS.md` §10). See `.agents/skills/NOTICE-boraoztunc.md`-style
attribution: full credit to the source repo, MIT license, no further obligation beyond this note.*

# Proofreading

Surface-level error correction for finished copy. Grammar, spelling, punctuation, style
consistency, tone matching — never restructuring, never rewriting for message or persuasion.

## Scope — what this is and isn't

**Use for:** a final mechanical pass before publishing — the copy's message and structure are
already settled (by the user, or by `copy-editing`'s Seven Sweeps, or by `no-ai-slop`'s pattern
pass).

**Do not use for:** a rough draft that still needs restructuring, or as a substitute for
`no-ai-slop` (banned words, AI-sounding patterns) or `copy-editing` (message-level clarity,
tone, specificity). Those run first; this runs last, right before the copy ships.

## Before starting

Confirm the language of the draft — Spanish and English have different rule sets below:
- **Slack App UI & Block Kit Copy**: 100% strictly English (`docs/guidelines/EDITORIAL_STANDARDS.md`). No Spanish in Slack notifications, modals, or bot responses.
- **Marketing & Documentation**: Bilingual (English / Spanish).

For Spanish copy in this project: **tuteo, never voseo** (`docs/guidelines/EDITORIAL_STANDARDS.md`) — that check belongs here too, not just in `no-ai-slop`, since it's a grammar-conjugation issue as much as a tone one. Check imperative and present-tense verbs.

## Main focus areas

### Grammar

| English | Español |
|---|---|
| Subject-verb agreement | Concordancia sujeto-verbo (número y género) |
| Tense consistency | Consistencia de tiempo verbal (no mezclar presente/pretérito sin razón) |
| Dangling modifiers | Gerundios mal referenciados ("gerundio de posterioridad" — un error real y común) |
| Fragments / run-ons | Oraciones incompletas / oraciones fusionadas sin conector ni puntuación |
| — | Leísmo, laísmo, loísmo (uso incorrecto de le/la/lo como objeto) |
| — | Concordancia de tiempo entre cláusulas subordinadas |

### Punctuation

| English | Español |
|---|---|
| Oxford comma | La coma no se usa antes de "y"/"o" en enumeraciones (regla opuesta al inglés — error frecuente al traducir mentalmente) |
| Apostrophes (possessive/contraction) | No existen apóstrofes posesivos en español — revisar que no se haya calcado del inglés |
| Em/en dashes | Raya (—) para incisos, distinta del guion (-); en copy corto de este proyecto, evitar del todo (`no-ai-slop`) |
| Semicolons | Punto y coma: uso correcto para unir cláusulas relacionadas sin conjunción — ver "Coma vs. punto y coma vs. punto y seguido" abajo |
| Comma splices | Comas que unen dos oraciones independientes sin conjunción ni punto y coma |
| — | Signos de apertura obligatorios: ¿...? y ¡...! (nunca solo el de cierre) |
| — | Tildes: diacríticas (sí/si, más/mas, tú/tu, él/el) — omitirlas cambia el significado |
| — | Mayúscula después de dos puntos solo si introduce una cita textual o enumeración formal, no en uso general |

#### Coma vs. punto y coma vs. punto y seguido (RAE)

Cuando dos ideas están relacionadas, la [Ortografía de la RAE](https://www.rae.es/ortograf%C3%ADa/usos-del-punto-y-coma) y la
[duda lingüística oficial](https://www.rae.es/duda-linguistica/cuando-se-usa-el-punto-y-coma) dan una escala de tres
niveles según la fuerza del vínculo semántico entre las dos oraciones — no es una preferencia de estilo, es la regla:

1. **Coma** — el vínculo es casi de una sola idea (una es aclaración o ampliación directa de la otra dentro de la misma
   estructura). Ejemplo de la RAE: *"Lo hizo, lamentablemente."*
2. **Punto y coma** — las oraciones son sintácticamente independientes pero mantienen una relación semántica estrecha,
   normalmente de consecuencia inmediata. Ejemplo oficial de la RAE: *"Puede irse a casa; ya no hay nada más que
   hacer."* Señal para detectarlo: la segunda oración es casi el mismo acto de habla que la primera (una invitación,
   una orden, una consecuencia directa), no una idea nueva.
3. **Punto y seguido** — el vínculo se estima débil; cada oración tiene peso informativo propio, aunque compartan
   tema. Un pronombre o adjetivo demostrativo (*"eso", "esa", "esos", "por eso"*) al inicio de la oración siguiente es
   un mecanismo de cohesión (anáfora) **perfectamente válido con punto y seguido** — no obliga a usar punto y coma.
   Ejemplo real de este proyecto: *"El capybara es conocido por no alterarse por nada. Esa calma es la idea detrás
   del nombre."* — dos proposiciones distintas (un hecho zoológico, una decisión de naming) enlazadas por "Esa", no
   una sola idea partida en dos.

**Caso resuelto en este proyecto (`client/src/views/About.jsx`, 2026-09-15):** el borrador intermedio *"Es un
proyecto pequeño y las mismas manos que escriben el código responden tus mensajes; escríbeme a hello@capylite.co."*
usó punto y coma porque la segunda cláusula (imperativa, sin motivo explícito) era la consecuencia/invitación
directa de la primera — mismo patrón que el ejemplo oficial de la RAE ("Puede irse a casa; ya no hay nada más que
hacer."). Pero el usuario señaló un problema de fondo, no de puntuación: *"¿Para qué escribirían?"* — la invitación
no daba un motivo. La versión final añadió el motivo ("Si necesitas ayuda, escríbeme a...") y con eso la segunda
oración ganó peso informativo propio (ya no es solo "por eso escríbeme", es una condición + una acción), así que el
signo correcto pasó a ser punto y seguido: *"...responden tus mensajes. Si necesitas ayuda, escríbeme a
hello@capylite.co."* — **la lección: el signo de puntuación correcto puede cambiar cuando cambia el contenido de la
oración, no solo cuando cambia el estilo.** Resolver la puntuación antes de resolver si la oración dice lo que debe
decir es resolver el síntoma, no la causa.

**Regla práctica para el pipeline de traducción/copy:** antes de decidir el signo entre dos oraciones relacionadas,
preguntar "¿la segunda es la consecuencia/invitación inmediata de la primera, o es una proposición con su propio
peso informativo?" — lo primero pide punto y coma, lo segundo pide punto y seguido. No usar punto y coma solo porque
las oraciones "se sienten conectadas"; la anáfora con "eso/esa" ya resuelve esa cohesión sin necesidad de un signo
más fuerte.

### Commonly confused words

| English | Español |
|---|---|
| affect / effect | haber / a ver |
| its / it's | echo (de "echar") / hecho (de "hacer") |
| their / there / they're | halla (de "hallar") / haya (de "haber") / allá |
| that / which | porque / por qué / porqué / por que |
| who / whom | sino / si no |

## Process

1. Confirm language(s) and, for Spanish, confirm tuteo is the target register.
2. Read once for meaning — flag anything a mechanical pass would miss (that's out of scope,
   route back to `copy-editing` or the user).
3. Run one focused pass per category above (grammar, then punctuation, then confused words) —
   multiple narrow passes catch more than one pass trying to do everything at once.
4. For bilingual pairs, run the Spanish and English versions as two independent passes, not a
   translation-equivalence check.

## Output

Match what the user asked for:
- Corrected full text
- Marked-up original with inline notes (what changed and why, one line each)
- Bulleted error report only (no rewrite) — best when the user wants to fix it themselves

Always name the specific rule broken (e.g. "leísmo: 'le vi' → 'lo vi'"), not just "grammar
error" — the reason is what makes the correction checkable and the pattern avoidable next time.
