---
name: outputease-design
description: Generate well-branded interfaces and assets for OutputEase. Use when designing UI, writing marketing copy, building hero sections, picking colors, choosing type, or producing any visual artifact. Encodes the canonical voice (5 pillars, terminology, hard rules) and visual system (colors, sequential rule, type, motion, primitives) so output stays on-brand without re-reading DESIGN-SYSTEM.md.
---

# OutputEase Design

Authoritative source for color, type, voice, and component rules. If anything here disagrees with `packages/brand/`, `packages/config-tailwind/`, or `DESIGN-SYSTEM.md`, those files win.

## When to use

- Designing any UI surface (landing, app, marketing, slides, business card)
- Writing user-facing copy (headlines, body, CTAs, pricing, footer)
- Picking colors, type sizes, motion durations
- Composing hero sections, pricing tiers, feature grids
- Producing throwaway prototypes or static HTML mocks

## Files worth reading first

- [`DESIGN-SYSTEM.md`](../../../DESIGN-SYSTEM.md) — full narrative primer (visual + voice)
- [`packages/brand/src/tokens.css`](../../../packages/brand/src/tokens.css) — canonical CSS custom properties (colors, type, motion, spacing, radii, elevation)
- [`packages/brand/src/colors.ts`](../../../packages/brand/src/colors.ts) — canonical hex constants
- [`packages/brand/src/tokens.ts`](../../../packages/brand/src/tokens.ts) — typed scalars (spacing, radii, motion, sequentialColors)
- [`packages/config-tailwind/src/index.css`](../../../packages/config-tailwind/src/index.css) — Tailwind v4 theme bridge
- [`packages/config-tailwind/src/primitives.css`](../../../packages/config-tailwind/src/primitives.css) — opt-in interactive class primitives

## Quick reference

### Colors

- **Primary palette:** Summer Night `#241F44`, Lilac `#A99BF9`, Pale Cyan `#7FD8FF`, Crayola `#FDD468`, Salmon `#F9B09D`, White.
- **Light tints** for soft section backgrounds and card body shades: `lilac-light`, `lilac-extra-light`, `pale-cyan-light`, `crayola-light`, `salmon-light`. Never for text.
- **Sequential color rule:** when a UI enumerates items (cards, steps, tiers, slides, chips), cycle Lilac → Pale Cyan → Crayola → Salmon. Summer Night and White are neutrals and never participate. Never shuffle, never skip.
- **No gradients anywhere.** Not hero backgrounds, not CTAs, not decorative glows, not button fills, not icon fills. Solid colors only. This includes brand-color-to-brand-color gradients, radial glows, and "mesh" backgrounds. The palette is flat by design.

### Type

- **Fellix** (primary, variable, 100–900), Inter (fallback), JetBrains Mono (code). Self-hosted in `packages/brand/fonts/`.
- **Eyebrow:** `text-sm font-medium uppercase tracking-widest`, usually lilac on dark.
- **Hero H1:** `tracking-tight`, `fw-bold`, white on dark / summer-night on light.
- **Body on dark:** `text-white/80`, `leading-relaxed`.
- **Body on light:** `text-summer-night/80`.

### Radii & shadows

- Cards / heroes: `rounded-2xl` (1rem) on mobile, `rounded-3xl` (1.5rem) on desktop. Buttons and avatars: `rounded-full` (pill). Never sharp corners; never under 6px.
- Prefer `shadow-section-card` for hero / primary section cards. `shadow-card` + `shadow-card-hover` for content cards. `shadow-subtle` for inputs and chips. `shadow-elevated` for modals.

### Motion

Motion is for interaction (hover, focus, press, click on clickable elements) and arrival (entry of new content on mount or state change). Never animate static, non-interactive elements (a card the user cannot click does not hover-lift).

- `--ease-out-soft` default; `--ease-in-out` bidirectional; `--ease-press` for press/click
- `--duration-fast` 140ms (hover), `--duration-base` 220ms (state change), `--duration-slow` 380ms (panel open)
- Respect `prefers-reduced-motion` (handled globally in `primitives.css`)

### Interactive primitives (opt-in via `primitives.css`)

- `.btn-shrink` — signature scale-down on hover. Apply to any clickable element.
- `.card-lift` — translate-Y rise on hover. Only on clickable cards.
- `.accent-underline > .ink + .swash` — salmon swash under a hero word. One per headline.
- `.eyebrow` — uppercase tracked-wide section label.
- `.chip-glass` — translucent badge for Summer Night surfaces only.
- `.highlight-crayola`, `.highlight-lilac` — inline benefit callouts. One per paragraph max.

### Voice pillars

1. **Calm authority** — measured, not shouty. Confidence from specificity.
2. **Plain-spoken** — short sentences, concrete nouns, active verbs.
3. **Human and respectful** — write to a person, not a procurement team.
4. **AI-fluent without AI-bragging** — talk about outcomes, not "AI-powered."
5. **Friendly and empowering** — knowledgeable friend, not vendor.

### Hard rules

- **No em-dashes in user-facing marketing copy.** Use comma, period, colon, or rewrite. En-dashes (`–`) fine for numeric ranges.
- **Active voice, concrete verbs.** "Automate invoicing," not "Invoicing can be automated."
- **No AI prefixing for varnish.** Use "AI-assisted" / "AI-augmented" when material; otherwise drop.
- **Specificity over adjective stacks.** Avoid "comprehensive end-to-end enterprise-grade."
- **Oxford comma, always.**
- **Sentence case** for nav, buttons, labels. Title Case only for proper product names (Discover, Launch, Build, Scale; Care Lite, Care Core, Care Plus).
- **Numbers:** spell out one to nine, numerals for 10+. Percentages and time always numeric.
- **Never hardcode hex values.** Reference `var(--oe-color-*)` or import from `@outputease/brand`.

### Terminology (use → not)

- AI-assisted, AI-augmented → not AI-powered, AI-driven
- Discovery call → not intro call, kickoff call, demo
- Workflow → not process (in client-facing copy)
- CCIB-certified Indigenous Business → not Indigenous-certified
- Discover, Launch, Build, Scale → not "tier 1," "starter" (these are proper nouns)
- Care Lite, Care Core, Care Plus → not "small retainer," "basic plan"

### Canonical component patterns

1. **Dark hero card** — Summer Night surface, lilac uppercase eyebrow, salmon `.accent-underline` swash on a word in the H1, `.highlight-crayola` on a phrase in body. `shadow-section-card`, `rounded-2xl md:rounded-3xl`.
2. **Centered logomark intro** — 48px logomark above a tight H1, muted subtitle, tiny muted meta. Works for pitch-deck title slides, business cards, app about screens.

## How to use this skill

- If creating a **visual artifact** (slides, mocks, throwaway prototype): output static HTML with brand tokens inlined; copy assets from `packages/brand/fonts/` and `packages/brand/src/colors.ts`; obey every rule above.
- If creating **production code:** import `@outputease/config-tailwind` (theme) and optionally `@outputease/config-tailwind/primitives.css` (interactive class primitives); use Tailwind utilities (`bg-summer-night`, `text-lilac`, `shadow-section-card`); never inline hex values.
- If writing **marketing copy:** rewrite anything that violates a hard rule; replace banned terms with the preferred swap; lead with outcomes; one inline highlight per paragraph max.
- If unclear which surface or audience applies, ask the user which audience (sales, website, Indigenous engagement, government grant, internal, founder) and apply the matching tone setting from `DESIGN-SYSTEM.md` §9 "Tone by audience."
