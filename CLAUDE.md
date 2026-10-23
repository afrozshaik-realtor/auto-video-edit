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

1. Hosting: static site on GitHub Pages, with no server of our own. The AI edit runs as
   a scheduled GitHub Actions job (free on this public repo) using the owner's existing
   Claude plan. Thumbnails use OpenAI's Image API with the owner's API key (paid per
   image). No other paid services. (Both changed at Afroz's request, 2026-10-23.)
2. Video files never go in this repo. They live in Google Drive.
3. Shared data lives in a Google Sheet ("Reel Tracker") read/written via the Sheets API.
4. Auth: Google Identity Services (OAuth token model in the browser). Each user acts
   with their own Google permissions. Access is controlled by sharing the Drive folder
   and the Sheet with team members. Exception: the AI edit job acts as the owner's
   Google account via a refresh token (a service account can't upload files to a
   personal Drive).
5. No secrets in the repo. The OAuth Client ID, Sheet ID and folder IDs are not secret
   and go in `src/config/app.config.ts`. Never add API keys or client secrets. The AI
   edit job's credentials live only in GitHub Actions secrets.
6. Must work well on a phone (team will check and tick steps on mobile).
7. Light and dark mode.
8. GitHub Actions logs are public on this repo: the AI edit job prints reel ids and
   statuses only, never titles, transcripts, captions or file contents, and uploads no
   artifacts. Claude runs with only its own token and the stock API key in its
   environment, never the Google or OpenAI secrets.

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
- **Working**: moves automatically when the AI edit job starts on the reel.
- **Completed**: moves when every required step is ticked and the user clicks
  "Mark reel complete" (show a confirmation). The posted URL is required.
- A reel can be moved back a stage with a confirmation (e.g. re-edit needed).

## Google Sheet ("Reel Tracker") — tabs

- `Reels`: id, title, business, tags (comma-separated), stage, assignee, created_by,
  created_at, updated_at, drive_folder_id, final_video_link, posted_url, post_date,
  notes, ai_status (blank / queued / running / done / failed), ai_detail, ai_updated_at,
  ai_runs, ai_notes (notes for a re-run), caption (written by the AI edit),
  thumbnail_link, thumb_status (same values as ai_status), thumb_detail, thumb_prompt
  (Claude's image prompt), thumb_notes (notes for a thumbnail redo).
  Schema version 2 added the ai_* and caption columns; version 3 the thumbnail ones.
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
tool buttons, a "done when" line, and optionally `auto` (ticked by the AI edit job,
not people) and a `panel` (AI status, caption, thumbnail, or review). Workflow
version 4: nobody copies or pastes prompts.

| # | Step | Who | Done by | Tool buttons |
|---|---|---|---|---|
| 1 | Shoot: headroom above head, clean background, clear audio (no trimming needed) | You | Person | — |
| 2 | Upload the raw clip to the reel's `raw/` folder (own B-roll footage to `broll/`) | You | Person (or the job, when it finds the clip) | Open reel folder (Drive) |
| 3 | AI edit: trim, Pass 01–02, B-roll plan and mix, Pass 03–05, director self-review, save | Claude | AI edit job | Open reel folder (Drive) |
| 4 | AI caption and hashtags (shown with a Copy caption button) | Claude | AI edit job | — |
| 5 | AI thumbnail: Claude picks a reference frame and writes the image prompt; OpenAI's image model draws a 9:16 cover (preview in the app; "Make a new thumbnail" with optional notes redoes only the thumbnail) | Claude | AI edit job | — |
| 6 | Optional polish (manual fixes, brand assets) | You | Person | CapCut, Canva |
| 7 | Phone check: sound on and off, nothing under Instagram buttons, loudness OK. Director note chips add notes; "Re-run AI edit with these notes" queues a new version | You | Person | — |
| 8 | Post (with the thumbnail as cover) and paste the posted URL | You | Person | Instagram |

Required steps: all except 6 (7 required).

### AI edit job
- `.github/workflows/ai-edit.yml` runs every 10 minutes (and on demand). A quick check
  step looks for work; video tools and Claude Code are only installed when there is some.
- `automation/run-ai-edit.ts` picks the next reel: queued reels first (a re-run or "start
  now"), then reels that have never been edited and have a video in `raw/`, then
  "running" reels with no update for 5 hours (crashed). Failed reels wait for a person
  to click "Try the AI edit again".
- For each reel it sets ai_status=running, moves the folder to Working, ticks Upload,
  unticks the AI steps and the phone check, downloads the clip and `broll/` files, and
  runs Claude Code headless with the single prompt from `src/data/aiEdit.ts`
  (`buildAiEditPrompt`). Claude writes its current step to `status.txt`, which the job
  copies to ai_detail.
- Outputs (the contract in `AI_FILES`): `out/final.mp4` (1080x1920, checked with
  ffprobe), `out/cover.png`, `out/caption.txt`, `out/project/`. The job uploads them to
  `final/final.mp4` (re-runs: `final-v2.mp4`, …; nothing is overwritten or deleted),
  `final/cover.png` and `project/edit-vN/`, then sets ai_status=done, the caption, the
  final video link, and ticks the AI steps. One retry, then ai_status=failed with a
  short reason.
- Thumbnail (`automation/thumbnail.ts`): during the edit Claude saves a reference frame
  (`out/project/thumbnail-face.png`) and the image prompt (`out/thumbnail-prompt.txt`)
  following the `thumbnail` brief in `prompts.ts`. After the edit the job sends both to
  OpenAI's `/v1/images/edits` (model from the OPENAI_IMAGE_MODEL variable, default
  `gpt-image-2.5-sunburst`, size 1088x1920, quality high), crops to 1080x1920 with
  ffmpeg and uploads `final/thumbnail.png` (redos: `thumbnail-v2.png`, …). A thumbnail
  failure never fails the edit. Redos (thumb_status=queued) run before edits: Claude
  rewrites the saved prompt with the team's notes (`buildThumbnailRewritePrompt`), and
  the job reuses the reference frame from the newest `project/edit-vN/`. With no
  OPENAI_API_KEY the prompt is still saved and the step shows how to add the key.
- Store the exact prompts from the kit in `src/config/prompts.ts` (setup, five passes,
  tighten-the-cut, director notes). The AI edit prompt embeds the pass, tighten,
  B-roll, caption and director-note prompts, and tells Claude to make every approval
  decision itself. The B-roll prompts are not from the kit.

Director note chips (on the phone check, as re-run notes): outline looks fake; graphic covers face; too much on screen;
graphic lands late (with [word] placeholder); captions too fast; hook harder;
use brand colors [hex]; only re-render a time range; B-roll doesn't match at [word];
too much B-roll; keep B-roll off the hook; swap the B-roll shot at [time].

B-roll rules (in the B-roll prompts):
- Sources are free only: BUILD (Claude makes it in code: animated stats, charts, text
  cards, simple illustrations, mock screens), STOCK (the job fetches it from the free
  Pexels API when the PEXELS_API_KEY secret is set; otherwise BUILD and OWN only), OWN
  (the team's footage from the reel's `broll/` folder). No paid AI video generators.
- Nothing in the first 1.5 s (the hook stays on the face). B-roll at most 40% of the
  reel, 2–4 s per shot, at least 1.5 s of face between shots. Each shot starts on its
  trigger word.
- Layouts: full-screen cutaway (voice continues), split screen, picture-in-picture,
  behind the cut-out (uses the Pass 02 matte).
- The B-roll pass runs after Pass 02 (needs the matte) and before Pass 03 (captions
  are placed on the final cut).

Kit troubleshooting tips (the runner has internet, so the AI edit can follow them):
- Pass 01: if a speech model won't download, use a Whisper or Parakeet model from the
  sherpa-onnx GitHub releases.
- Pass 02: rough edges → RobustVideoMatting (ONNX) from GitHub releases; the runner is
  CPU-only, so process frames in chunks.

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
   business color, tags, assignee, progress (x/7 required steps), and the AI edit
   or thumbnail status when queued, running or failed. Completed lane collapsed by default, showing
   the 10 most recent.
2. **Filters** (on Board): business, tags (multi-select, match any/all), stage,
   assignee, text search. Filters reflected in the URL so a filtered view can be
   bookmarked or shared.
3. **New reel**: title, business, tags (type-ahead from existing tags, create new),
   assignee. Creates Drive folder in Raw + Sheet row.
4. **Reel detail**: guided stepper (one step expanded at a time, "Next step" button),
   tool buttons, per-step notes, Drive folder link, final video link, posted URL,
   activity history. The AI edit step shows live status (refreshed every minute while
   queued or running), "start now" and "try again" buttons; the caption step shows the
   caption with a Copy caption button; the thumbnail step shows a preview (loaded from
   Drive with the viewer's sign-in) and "Make a new thumbnail"; the phone check offers
   re-run with notes.
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

**AI edit (0.3.0)**: the automated AI edit job, workflow v3, schema v2 with the
migrations framework (`src/data/migrations.ts`).

**AI thumbnail (0.4.0)**: thumbnail step with OpenAI images, workflow v4, schema v3.

**Phase 2**: Settings (businesses, tags, tools, team), Library, activity history,
URL-synced filters, dark mode polish, more tests for workflow logic.

## Working agreement for Claude Code

- Start by inspecting the repo and proposing a short plan; wait for approval.
- Work phase by phase; commit in small, clearly described commits.
- Before changing anything in this spec's constraints, ask Afroz first.
- After each phase, give Afroz a plain-language test checklist.

## Manual steps Afroz must do (Claude Code cannot do these)

1. Google Cloud Console: create a project, enable Google Drive API and Google Sheets API.
2. OAuth consent screen: user type External (or Internal if using Google Workspace).
   Publishing status must be **In production** for the AI edit job: in Testing, its
   refresh token expires after 7 days. Unverified is fine for a small team (people see
   an "unverified app" warning once).
3. Create an OAuth Client ID (Web application). Authorized JavaScript origins:
   `https://afrozshaik-realtor.github.io` and `http://localhost:5173`.
   Give the Client ID to Claude Code for `app.config.ts`.
4. GitHub repo → Settings → Pages → Source: GitHub Actions.
5. After first-run setup, share the `Reels` folder and "Reel Tracker" Sheet with the
   team (Editor access).
6. AI edit job (see README "Set up the AI editor"): create a **Desktop app** OAuth
   client; run `npm run ai:google-token` and sign in as the Reels owner; run
   `claude setup-token`; optionally get a free Pexels API key. Add the GitHub Actions
   secrets GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
   CLAUDE_CODE_OAUTH_TOKEN, OPENAI_API_KEY (thumbnails) and (optional) PEXELS_API_KEY.
   Optional repository variables CLAUDE_MODEL (default `opus`) and OPENAI_IMAGE_MODEL
   (default `gpt-image-2.5-sunburst`).
