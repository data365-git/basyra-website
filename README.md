# Business Navigator — Abdulboriy Abduqodirov mentorlik sayti

Personal mentorship landing page. Detective ("Sotuv Detektivi") concept, Uzbek, sales-systems mentorship.
Design is produced via AI image-generation, section by section, then stacked into a page.

## Folder structure

```
00-source/      Client source of truth — DO NOT edit
                ├─ sayt-tz.pdf                (the TZ — all real copy & numbers come from here)
                └─ reference-mentorlik5.pdf   (benchmark reference site)

01-strategy/    Brief, research & design direction
                ├─ direction.md
                ├─ brief-research-patterns.md
                ├─ design-prd.md
                ├─ design-research.md / .pdf
                └─ design-styles.md

02-concept/     Locked creative concept + prompt rules  ← READ BEFORE WRITING PROMPTS
                ├─ sherlock-concept.md         (the "Sotuv Detektivi" concept)
                └─ master-prompt-spec.md       (full critique + the PROMPT HEADER every prompt inherits)

03-design/      The visual design
                ├─ sections-v1/                (original section renders 1..11)
                ├─ sections-v2-after-critics/  (refined renders: 3,4,5,6,8,9,10)
                ├─ mascot/                      (Basyra AI mascot: mascot.png, mascot_cut.png = transparent)
                └─ exports/                     (full-page PDFs/PNGs — the deliverables)

04-build/       The live site
                ├─ website-v2.html             (1:1 image-stack of the page — open this)
                ├─ assets/site/                (01..11.png the page is built from)
                ├─ assets/mascot.png           (transparent mascot for the widget)
                ├─ mascot-widget.html          (floating Basyra AI mascot + popup component)
                └─ merge_v2.py                 (rebuilds the export PDF from the section renders)

99-archive/     Old experiments — not used, kept for reference
                ├─ html-experiments/           (version1-8.html, v1-*.html, compare.html)
                ├─ scripts/                     (old capture / pdf scripts)
                ├─ screenshots/                 (shots*, scratch images)
                ├─ manifests/
                └─ crit/
```

## Rules (the short version — full version in 02-concept/master-prompt-spec.md)
- All copy & numbers come from **00-source/sayt-tz.pdf**. Never invent numbers.
- Pure Uzbek (Latin) only. "xodim" not "hodim". Keep the name "Business Navigator" / "Abdulboriy Abduqodirov".
- Design = **rich but calm** (mentor section is the quality bar). No prop clutter, numbers visible, easter eggs only at peaks.
- Every image-gen prompt starts with the **PROMPT HEADER** from master-prompt-spec.md.

## Workflow
1. Regenerate a section → drop the PNG into `03-design/sections-v2-after-critics/` (named `3.png`, `4.png`, …).
2. `python3 04-build/merge_v2.py` → rebuilds `03-design/exports/website-v2-after-critics.pdf`.
3. `04-build/website-v2.html` shows the live 1:1 page.

## Status — sections still on the old v1 render (need redo): 1 (hero), 2, 7, 11 (footer)
## Pending: real contact details for the footer (phone, Telegram, Instagram, YouTube)
