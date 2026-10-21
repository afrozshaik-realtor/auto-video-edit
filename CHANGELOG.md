# Changelog

All notable changes to Reel Studio. The version shown in the app comes from
`APP_VERSION` in `src/config/app.config.ts`.

## 0.2.0 — 2026-10-21

### Added
- B-roll pass, between Pass 02 (cut-out) and Pass 03 (captions), as two required steps:
  - **B-roll: plan and gather shots.** Claude writes a shot list matched to the
    transcript. Each shot has a trigger word, timecode, layout and source. Sources are
    built by Claude in code, free stock from Pexels or Pixabay, or your own footage.
  - **B-roll: build and mix.** Claude builds the graphic shots and cuts every shot in
    on its word. The shots can be full-screen, split screen, picture-in-picture or
    behind your cut-out.
- Rules in the B-roll prompts: the hook stays on your face, B-roll is at most 40% of
  the reel, and every shot starts on its word.
- New reels get a `broll/` folder.
- Pexels and Pixabay tool buttons.
- Four director notes: B-roll doesn't match, too much B-roll, keep B-roll off the
  hook, and swap a B-roll shot.
- The setup and save-outputs prompts now mention B-roll.

### Changed
- The workflow is now version 2, with 17 steps, 16 of them required. Existing reels
  show the two new steps unticked, so a completed reel shows 14/16. It stays complete.

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
