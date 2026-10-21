# Changelog

All notable changes to Reel Studio. The version shown in the app comes from
`APP_VERSION` in `src/config/app.config.ts`.

## 0.1.0 — 2026-10-21 (Phase 1)

### Added
- Google sign-in in the browser. Each person uses their own Drive and Sheets access.
- First-run setup: creates the `Reels` folder tree (Raw, Working, Completed) and the
  "Reel Tracker" sheet with all tabs, seeds AM Builders, TCE and Dr Cyber with the
  default style rules, and shows the IDs to paste into `app.config.ts`.
- Board: Raw, Working and Completed shown as timeline tracks. Each reel is a clip
  showing its business, tags, assignee and required-step progress. Completed is
  collapsed and shows the 10 most recent.
- Filters on the Board: business, tags (match any or all), stage, assignee and text search.
- New reel: title, business, tags with suggestions, assignee. Creates the reel's
  Drive folder (with `raw/`, `project/`, `final/`) in Raw and adds a Sheet row.
- Reel detail: a 15-step guided checklist with prompts to copy, tool buttons,
  director-note chips, "Stuck?" tips, per-step notes, final video link and posted URL.
- Automatic stage moves: ticking Setup moves the folder to Working. "Mark reel
  complete" (needs every required step and the posted URL) moves it to Completed.
  "Move back" returns it one stage. Both ask for confirmation first.
- Activity log written to the `Activity` tab (shown in the app in Phase 2).
- Light and dark themes, phone layout, keyboard focus styles, reduced-motion support.
- GitHub Pages deploy on every push to `main`.

### Known gaps
- The setup, pass, tighten-the-cut and director-note prompts are drafts, marked
  "Draft text" in the app, until the kit's exact wording is added to `src/config/prompts.ts`.
- Filters aren't saved in the URL yet (Phase 2).
