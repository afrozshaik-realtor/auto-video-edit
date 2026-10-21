# Reel Studio — build spec for Claude Code

Repo: https://github.com/afrozshaik-realtor/auto-video-edit
Owner: Afroz Shaik
Live URL (target): https://afrozshaik-realtor.github.io/auto-video-edit/

## What this app is

A free web app that guides a team through producing short-form talking-head reels
using the "5-Pass Reel Edit Kit" method (Claude Opus 5.5 does the technical edit in
code; humans shoot, review, direct and post). It tracks every reel from raw clip to
posted, across three businesses:

| Business | Short code | Notes |
|---|---|---|
| AM Builders | AMB | Construction / basement development |
| TCE (Real Estate) | TCE | Afroz's real estate brand |
| Dr Cyber | DRC | Cybersecurity education brand |

Businesses must be data, not hard-coded, so more can be added later.

## Non-negotiable constraints

1. Hosting: static site on GitHub Pages. No server, no paid services.
2. Video files never go in this repo. They live in Google Drive.
3. Shared data lives in a Google Sheet ("Reel Tracker") read/written via the Sheets API.
4. Auth: Google Identity Services (OAuth token model in the browser). Each user acts
   with their own Google permissions. Access is controlled by sharing the Drive folder
   and the Sheet with team members.
5. No secrets in the repo. The OAuth Client ID, Sheet ID and folder IDs are not secret
   and go in `src/config/app.config.ts`. Never add API keys or client secrets.
6. Must work well on a phone (team will check and tick steps on mobile).
7. Light and dark mode.

## Tech stack

- Vite + React + TypeScript
- React Router (HashRouter, for GitHub Pages compatibility)
- Fonts self-hosted via `@fontsource/*` npm packages (no Google Fonts CDN)
- Google APIs called with `fetch` against REST endpoints (Drive v3, Sheets v4)
- Deploy: GitHub Actions workflow building and publishing to GitHub Pages on push to `main`
- Tests: Vitest for data/workflow logic

## Google Drive structure

```
Reels/
  01 Raw Videos/
  02 Working Videos/
  03 Completed Videos/
```

- Every reel gets its own subfolder, named `YYYY-MM-DD_<BUSINESS>_<slug>`
  (e.g. `2026-10-21_TCE_first-time-buyer-mistakes`).
- The reel folder starts in Raw. Moving a reel between stages moves its whole folder
  (Drive API: update `parents`). Never copy, never delete.
- Inside the reel folder, the app creates: `raw/`, `broll/` (stock and own-footage
  B-roll clips), `project/` (words.json, matte, renders from Claude), `final/`
  (final MP4 + cover frame).

### Stage rules
- **Raw**: reel created, raw clip uploaded.
- **Working**: moves automatically when the Setup step is ticked (editing started).
- **Completed**: moves when every required step is ticked and the user clicks
  "Mark reel complete" (show a confirmation). The posted URL is required.
- A reel can be moved back a stage with a confirmation (e.g. re-edit needed).

## Google Sheet ("Reel Tracker") — tabs

- `Reels`: id, title, business, tags (comma-separated), stage, assignee, created_by,
  created_at, updated_at, drive_folder_id, final_video_link, posted_url, post_date,
  notes
- `Checklist`: reel_id, step_id, done (TRUE/FALSE), done_by, done_at, note
- `Businesses`: id, name, short_code, accent_color, style_rules_md, active
- `Tags`: tag, color (optional)
- `Activity`: timestamp, user, reel_id, action, detail
- `Meta`: key, value (store `schema_version` here)

Schema changes must ship with a migration function in `src/data/migrations.ts`,
keyed by schema version, run on load by the first user with edit access.

## First-run setup screen

If config IDs are empty, show a setup screen that, after Google sign-in:
1. Creates the `Reels` folder tree in the user's Drive.
2. Creates the "Reel Tracker" Sheet with all tabs and headers, and seeds the three
   businesses with the default style rules (below).
3. Displays the folder and Sheet IDs with copy buttons and tells the owner to paste
   them into `src/config/app.config.ts` and share both with the team.

## Workflow (the guided checklist)

Define steps in `src/config/workflow.ts` as versioned data so steps can be added,
reordered or edited without touching UI code. Each step has: id, title, who
(Claude / You / Both), required (bool), instructions (short, plain language),
optional prompt text (with a Copy button), tool buttons, and a "done when" line.

| # | Step | Who | Tool buttons | Prompt to copy |
|---|---|---|---|---|
| 1 | Shoot: headroom above head, clean background, clear audio | You | — | — |
| 2 | Trim dead air, export 1080p, under 30 MB | You | CapCut | — |
| 3 | Upload raw clip to the reel's `raw/` folder | You | Open reel folder (Drive) | — |
| 4 | Setup: new Claude chat (Opus 5.5, code execution on), upload clip, paste setup prompt + this business's style rules | Both | Claude | Setup prompt merged with the business's style rules |
| 5 | Pass 01 Transcribe; fix misheard words in the table; tighten the cut | Both | Claude | Pass 01 + "Tighten the cut" |
| 6 | Pass 02 Cut-out; check hair edges, no outline, no holes | Both | Claude | Pass 02 |
| 7 | B-roll plan: Claude writes a shot list matched to words.json (trigger word, timecode, layout, source: BUILD / STOCK / OWN); approve it, gather stock and own clips into `broll/`, upload to the chat | Both | Claude, Pexels, Pixabay, Canva, Open reel folder (Drive) | B-roll shot list |
| 8 | B-roll mix: Claude builds the BUILD shots in code and cuts all B-roll in on its trigger words | Both | Claude | B-roll build and mix |
| 9 | Pass 03 Captions; approve key words | Both | Claude | Pass 03 |
| 10 | Pass 04 Motion; approve the scene plan before build | Both | Claude | Pass 04 |
| 11 | Pass 05 Sound; listen on a phone | Both | Claude | Pass 05 |
| 12 | Direct: send notes until it's right | Both | Claude | Director note chips (one copy button each) |
| 13 | Save final MP4, cover frame and project files to the reel folder | You | Open reel folder (Drive) | Ask Claude to save to outputs |
| 14 | Optional polish (manual fixes, brand assets) | You | CapCut, Canva | — |
| 15 | Phone check: sound on and off, nothing under Instagram buttons, loudness OK | You | — | — |
| 16 | Write caption and hashtags | Both | ChatGPT, Claude | Caption prompt using business + reel title + tags |
| 17 | Post and paste the posted URL | You | Instagram | — |

Required steps: all except 14 (16 required). Store the exact prompts from the kit in
`src/config/prompts.ts` (setup, five passes, tighten-the-cut, director notes).
The B-roll prompts are not from the kit; the setup prompt must mention the B-roll pass.
Director note chips: outline looks fake; graphic covers face; too much on screen;
graphic lands late (with [word] placeholder); captions too fast; hook harder;
use brand colors [hex]; only re-render a time range; B-roll doesn't match at [word];
too much B-roll; keep B-roll off the hook; swap the B-roll shot at [time].

B-roll rules (in the B-roll prompts):
- Sources are free only: BUILD (Claude makes it in code: animated stats, charts, text
  cards, simple illustrations, mock screens), STOCK (Pexels / Pixabay, portrait), OWN
  (the team's footage). No paid AI video generators.
- Nothing in the first 1.5 s (the hook stays on the face). B-roll at most 40% of the
  reel, 2–4 s per shot, at least 1.5 s of face between shots. Each shot starts on its
  trigger word.
- Layouts: full-screen cutaway (voice continues), split screen, picture-in-picture,
  behind the cut-out (uses the Pass 02 matte).
- The B-roll pass runs after Pass 02 (needs the matte) and before Pass 03 (captions
  are placed on the final cut).

Step troubleshooting tips (show under a "Stuck?" disclosure):
- Pass 01: if a speech model won't download, ask Claude to use a Whisper or Parakeet
  model from the sherpa-onnx GitHub releases.
- Pass 02: rough edges → RobustVideoMatting (ONNX) from GitHub releases; the sandbox
  is CPU-only, so ask Claude to process frames in chunks and keep clips under ~30 s.
- Any pass: ask Claude to save key files to its outputs folder after each pass, since
  the sandbox can reset during long gaps. Download and add them to `project/`.

## Tools (configurable)

`src/config/tools.ts` — list of { id, name, url, icon }. Defaults:
Claude (https://claude.ai/new), ChatGPT (https://chatgpt.com), Canva
(https://www.canva.com), CapCut (https://www.capcut.com), Instagram
(https://www.instagram.com), Pexels (https://www.pexels.com/videos/), Pixabay
(https://pixabay.com/videos/), Google Drive (reel folder link built from folder id).
All open in a new tab.

## Screens

1. **Board** (home): three lanes — Raw, Working, Completed — styled like tracks on an
   editing timeline, with each reel as a clip on its track. Clip shows title,
   business color, tags, assignee, progress (x/16 required steps). Completed lane
   collapsed by default, showing the 10 most recent.
2. **Filters** (on Board): business, tags (multi-select, match any/all), stage,
   assignee, text search. Filters reflected in the URL so a filtered view can be
   bookmarked or shared.
3. **New reel**: title, business, tags (type-ahead from existing tags, create new),
   assignee. Creates Drive folder in Raw + Sheet row.
4. **Reel detail**: guided stepper (one step expanded at a time, "Next step" button),
   prompts with copy buttons, tool buttons, per-step notes, Drive folder link, final
   video link, posted URL, activity history.
5. **Library**: all prompts and director notes for quick copying outside a reel.
6. **Settings**: businesses (name, color, style rules editor), tags (rename/merge/
   color), tools list, team members list (for assignee picker), app version +
   changelog.

## Default style rules (seed all three businesses with this; owner edits later)

```
# Reel Style Rules
## Canvas
- 1080x1920, 30 fps.
- Safe area: keep text out of the top 220px, the bottom 380px and the right 140px.
## Type
- Key words: a serif italic, big, one per sentence.
- Support words: a clean sans, semibold, small.
- Max 3 words on screen. Never over my face.
## Color
- Brand colors: [replace with this business's hex codes]
## Motion
- Fast in (0.2-0.35s), hold, clean out. One idea per scene, fired on its word.
- Text behind me (cut-out) for hooks and big words. Push-ins max 6%.
## Sound
- Hit on the hook, tap on clicks, whoosh on scene changes, chime to close.
- Voice always on top. Master to -14 LUFS, peaks under -1 dB.
## Don't
- No white sticker outline. No emoji captions. Max 2 fonts on screen.
```

## Visual direction

Subject: a production board for a small team editing reels. The memorable element is
the Board's timeline-track lanes; keep everything else quiet.
- Avoid template defaults: no all-caps eyebrow labels, no identical card grid with
  soft grey shadows, no gradient washes, no "→" on buttons.
- Each business's accent color appears only as an identifying stripe/chip on its reels.
- Two type families max, self-hosted via @fontsource.
- Sentence case, plain verbs. Buttons say exactly what they do ("Mark reel complete",
  "Copy prompt", "Open in Drive").
- Empty states give direction ("No reels in Working. Start one from Raw.").
- Visible keyboard focus, respects reduced motion, good contrast in both themes.
- Take screenshots while building to check layout on desktop and a 390px-wide phone.

## Upgradeability rules

- Workflow, prompts, tools and businesses are config/data, not hard-coded in components.
- Google API access isolated in `src/services/google/` (drive.ts, sheets.ts, auth.ts)
  so storage could later move to another backend without UI changes.
- `CHANGELOG.md` updated with every feature; app version shown in Settings.
- Keep a `docs/ROADMAP.md` with the future ideas below.

### Future ideas (do not build now)
- Canva: auto-generate cover/thumbnail from a brand template (Canva Connect API).
- Content calendar view and posting schedule per business.
- Notifications to the assignee (Zapier, email, or WhatsApp).
- Performance tracking (views, saves) entered after posting.
- AI caption/hashtag generator inside the app (needs a backend for API keys).
- Odoo CRM link for leads generated by a reel.

## Build phases

**Phase 1 (MVP)**: auth, first-run setup, Sheet + Drive services, Board with lanes,
New reel, Reel detail stepper with prompts/tools, auto stage moves, filters by
business/tag/stage, GitHub Pages deploy.
Done when: a reel can go from New → Raw → Working → Completed with its Drive folder
moving correctly, on desktop and phone, by two different signed-in team members.

**Phase 2**: Settings (businesses, tags, tools, team), Library, activity history,
URL-synced filters, dark mode polish, migrations framework, tests for workflow logic.

## Working agreement for Claude Code

- Start by inspecting the repo and proposing a short plan; wait for approval.
- Work phase by phase; commit in small, clearly described commits.
- Before changing anything in this spec's constraints, ask Afroz first.
- After each phase, give Afroz a plain-language test checklist.

## Manual steps Afroz must do (Claude Code cannot do these)

1. Google Cloud Console: create a project, enable Google Drive API and Google Sheets API.
2. OAuth consent screen: user type External (or Internal if using Google Workspace),
   publishing status Testing, add every team member's Google email as a test user.
3. Create an OAuth Client ID (Web application). Authorized JavaScript origins:
   `https://afrozshaik-realtor.github.io` and `http://localhost:5173`.
   Give the Client ID to Claude Code for `app.config.ts`.
4. GitHub repo → Settings → Pages → Source: GitHub Actions.
5. After first-run setup, share the `Reels` folder and "Reel Tracker" Sheet with the
   team (Editor access).
