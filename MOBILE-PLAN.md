# Mobile-First Responsive Rebuild Plan

**Status:** Planning — not started
**Created:** 2026-07-04

---

## The Problem

The site uses a fixed 1672px canvas (`#bn-page`) scaled via `transform: scale(viewportWidth / 1672)`. On a 375px phone that's `scale(0.224)` — everything at 22% size. This is not responsive — it's a scaled screenshot. Must delete the `fit()`/`transform:scale` system and rebuild as fluid flow layout.

## Strategy

Kill the canvas. Rebuild bottom-up: real HTML flow, `rem`/`clamp`/`%`/`grid`, mobile base styles, `min-width` enhancements. Desktop composition becomes the *target* for the top breakpoint — not the base you shrink from.

Two sequencing modes per section:
- **Convert** — sections already in flow (`.cc-sec`, `.faq`, `.ar-inner`, footer): remove `width:1672px`, swap absolute px for grid/flex, invert media queries to `min-width`.
- **Re-author** — absolutely-positioned canvas sections (Hero, Kimlar uchun, Oldin→Keyin): rebuild from scratch as stacked flow.

## Breakpoint System

Mobile-first, `min-width` only:

| Token | Range | Container | Section pad | Grid |
|-------|-------|-----------|-------------|------|
| base | 320–767 | 100% − 20px | 56px | 1 col |
| `sm` 480 | large phones | 100% − 32px | 64px | 1 col |
| `md` 768 | tablets | 720px | 80px | 2 col |
| `lg` 1024 | laptops | 960px | 96px | 2–3 col |
| `xl` 1280 | desktop | 1200px | 112px | 3–4 col |
| `2xl` 1536 | large | 1360px | 120px | 3–4 col |
| `3xl` 1920+ | ultra-wide | **1440px max** | 128px | 3–4 col |

Hard rule for 32-inch: content caps at `max-width:1440px` centered.

## UI Tokens

```css
:root{
  --fs-h1: clamp(30px, 7vw, 84px);
  --fs-h2: clamp(26px, 5vw, 64px);
  --fs-h3: clamp(20px, 3vw, 30px);
  --fs-body: clamp(15px, 1.2vw + 0.6rem, 19px);
  --lh-tight:1.1; --lh-body:1.6; --measure:65ch;
  --space-section: clamp(56px, 8vw, 120px);
  --space-gap: clamp(12px, 2vw, 28px);
  --space-card: clamp(16px, 2.5vw, 28px);
  --container: min(100% - 24px, 1440px);
  --pad-inline: clamp(16px, 4vw, 40px);
  --tap-min: 44px; --radius: clamp(12px, 1.5vw, 24px);
}
```

## Section-by-Section Plan

| Section | Mobile (base) | Tablet (768) | Desktop (1280) | Approach |
|---------|--------------|--------------|----------------|----------|
| **Nav** | logo + hamburger; sticky; CTA in drawer | logo + inline links + CTA | full inline nav | re-author |
| **Hero** | stacked: headline → subcopy → CTA above fold → image below | 2-col text/visual | 2-col, visual right | **re-author** |
| **Kimlar uchun** | cards stack 1-col | 2-col | 3-col | **re-author** |
| **Oldin→Keyin** | 2 cards stack vertically | side by side | side by side + magnifier | **re-author** |
| **Dasturda** | 1-col cards | 2-col | 3-col | convert |
| **Nimani o'rganasiz** | folder cards 1-col | 2-col | 3-col | convert |
| **Yakuniy (Natija)** | mobile crop via `<picture>` | full image | full-bleed | convert + mobile asset |
| **Yopilgan (cc)** | panels stack; grid 2-col | 3-col | 5-col | convert |
| **FAQ** | tap accordion, full-width | centered | centered | convert (hover→click) |
| **Ariza form** | full-width fields, 1-col | form + copy stack | 2-col | convert |
| **Footer** | stacked brand/contact/social | 2-col | multi-col | convert |
| **AI popup** | bottom sheet, safe-area | side panel | corner panel | convert |

## Implementation Order

1. **Tokens + container + kill the scale-canvas** — nothing else works until this lands
2. **Hero** — re-author mobile-first (highest-value, worst on mobile)
3. **Nav** — hamburger + sticky
4. **Convert flow sections** (Dasturda, cc, FAQ→tap, Ariza, Footer)
5. **Re-author absolute sections** (Kimlar uchun, Oldin→Keyin)
6. **Infographics** (Yakuniy/Natija) — mobile `<picture>` or HTML rebuild
7. **AI popup** — bottom-sheet + safe-area
8. **QA sweep** at all 13 widths

## QA Widths

320 · 360 · 390 · 414 · 430 · 768 · 834 · 1024 · 1280 · 1440 · 1536 · 1920 · 2560

## Rules

- No fixed px for layout width, section padding, or type
- No `left:/top:` absolute positioning for layout
- Every interactive target ≥ 44×44px
- No horizontal overflow
- FAQ: click/tap only (no hover)
- Form inputs: `font-size:16px` (prevents iOS zoom)
- `env(safe-area-inset-bottom)` on sticky/popup
- Content capped at 1440px; surplus → background, not content
- Text lines ≤ `--measure` (65ch)
