# Changelog

All notable changes to Reel Studio. The version shown in the app comes from
`APP_VERSION` in `src/config/app.config.ts`.

## 0.5.0 — 2026-10-23

### Added
- **Manual trim step**, after Upload. A person trims the clip in CapCut or any editor,
  working through two checklists:
  - **Trim:** cut on silence or breaths, never inside a word; keep short pauses and
    breaths; leave 0.3 s at the end; hard cuts only.
  - **Export settings:** native vertical 1080x1920 at a constant 30 fps, with no
    captions, music, zooms, filters or audio processing.

  The step has Open CapCut and Drive buttons, and shows the export file name
  (`<reel-slug>_trimmed.mp4`) with a copy button.
- **Trimmed stage:** Raw → Trimmed → Working → Completed.
  - Marking Manual trim done moves the reel's folder to the new `02 Trimmed Videos`
    folder. The board has a Trimmed lane, and Trimmed shows in the stage filter and
    badges.
  - Each reel gets a `trimmed/` subfolder for the export.
- **Needs a re-trim:** if Pass 01 hears a clipped word, or a cut inside a word or a
  breath, the AI edit stops instead of carrying on.
  - The reel goes back to Trimmed, with the timecodes listed.
  - Fixing the cut, re-exporting and marking Manual trim done restarts the edit.

### Changed
- The AI edit works only on the hand-trimmed clip, as it is. The automatic Trim and
  "Tighten the cut" steps are gone, and no prompt asks Claude to cut, trim or tighten.
- New Pass 01 text: the clip is already trimmed. Pass 01 confirms the length,
  resolution and frame rate, transcribes, and only flags bad cuts.
- Passes 02, 03, both B-roll steps, 04 and 05 now start with "Work on the manually
  trimmed clip as-is. Never re-trim or remove footage."
- **New pass order:** Pass 01 → 02 → 03 Captions → B-roll (shot list, build and mix) →
  04 Motion → 05 Sound. B-roll is placed around the captions.
- The workflow is now version 5, with 9 steps, 8 of them required.

### Migration (schema 4, runs once on first load)
- Creates `02 Trimmed Videos` and saves its ID in the sheet's Meta tab.
- Renames `02 Working Videos` → `03 Working Videos` and `03 Completed Videos` →
  `04 Completed Videos`. Nothing is moved or deleted.
- Adds a `trimmed/` folder to every reel that isn't completed.
- Existing reels keep their stage.

## 0.4.2 — 2026-10-23

### Added
- Privacy Policy (`/privacy.html`) and Terms of Service (`/terms.html`) pages. Google
  needs both before the app can be published. They're linked from the sign-in screen
  and the account menu.

## 0.4.1 — 2026-10-23

### Added
- **AI edit progress bar.** It shows the overall percentage, the current step (for
  example "Pass 02: cut-out (40% of this step)") and "Step 5 of 14". An "All steps"
  list ticks off each stage as it finishes. The board shows the percentage on each
  reel too.
- The step reports **when the AI editor last checked for work**. If it has never
  checked in, or has gone quiet, a warning explains what to fix, instead of a reel
  sitting on "Queued" with no explanation.
- The AI editor job now writes the time of each check to the sheet's Meta tab, under
  `ai_last_check`, and Claude reports a rough percentage during long steps.

## 0.4.0 — 2026-10-23

### Added
- **AI thumbnail step**, after the caption and done automatically. It works in two
  parts:
  - During the edit, Claude picks a sharp frame of you and writes the image prompt.
    The prompt keeps your face as it is and adds a 2–4 word headline in the brand
    colours. It keeps your face and the headline inside Instagram's 3:4 grid crop and
    away from the buttons, with a blurred background that fits the topic.
  - The AI editor then sends the prompt and that frame to OpenAI's image model
    (`gpt-image-2.5-sunburst`), crops the result to 1080x1920, and saves it to the
    reel's `final/` folder.
- The thumbnail step shows a preview of the image.
- **Make a new thumbnail** redoes only the thumbnail, with optional notes. Claude
  rewrites the prompt using your notes, and the redo takes about a minute. Every
  version is kept: `thumbnail-v2.png` and so on.
- The image prompt Claude wrote is shown with a copy button, so you can make a
  thumbnail by hand in ChatGPT if needed.
- New secret `OPENAI_API_KEY` and optional variable `OPENAI_IMAGE_MODEL`.
- Sheet schema version 3 adds five thumbnail columns to Reels: `thumbnail_link`,
  `thumb_status`, `thumb_detail`, `thumb_prompt` and `thumb_notes`. They're added
  automatically on first load.

### Changed
- The workflow is now version 4 and has 8 steps. AI thumbnail is step 5, and 7 steps
  are required.

## 0.3.0 — 2026-10-23

### Added
- **AI editor.** A GitHub Actions job runs Claude Code with your Claude plan. It starts
  by itself when a clip lands in a reel's `raw/` folder, usually within 10 minutes.
  - It runs every pass in order: trim, transcribe, cut-out, B-roll, captions, motion,
    sound and a director self-review.
  - It saves `final.mp4`, `cover.png` and the project files to Drive, and writes the
    caption and hashtags.
  - Nobody copies or pastes prompts.
- The AI edit step shows live progress, refreshed every minute. It has buttons to
  start an edit now or try again after a failure.
- The caption step shows the AI's caption with a **Copy caption** button.
- The phone check has director-note chips and a **Re-run AI edit with these notes**
  button. Each re-run saves a new `final-vN.mp4`, and earlier versions are kept.
- The board shows each reel's AI status: queued, editing, or failed.
- Sheet schema version 2 adds six columns to Reels: `ai_status`, `ai_detail`,
  `ai_updated_at`, `ai_runs`, `ai_notes` and `caption`. The migration in
  `src/data/migrations.ts` adds them automatically on first load.
- `npm run ai:google-token`, a one-time helper for the job's Google sign-in.

### Changed
- The workflow is now version 3 and has 7 steps:
  1. Shoot
  2. Upload
  3. AI edit (automatic)
  4. AI caption (automatic)
  5. Polish (optional)
  6. Phone check
  7. Post

  Trimming, setup, every pass, B-roll, directing and saving are now inside the AI edit.
  The caption step moved before polish and is automatic. Steps 3 and 4 can't be ticked
  by hand.
- A reel now moves to Working when the AI edit starts.

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
