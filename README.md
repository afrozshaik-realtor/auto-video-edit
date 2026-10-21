# Reel Studio

A free web app that guides a small team through producing short talking-head reels
with the 5-Pass Reel Edit Kit, and tracks every reel from raw clip to posted.

Live: https://afrozshaik-realtor.github.io/auto-video-edit/

- Static site on GitHub Pages: no server and no paid services.
- Videos live in Google Drive; tracking data lives in the "Reel Tracker" Google Sheet.
- Everyone signs in with their own Google account. Access comes from sharing the
  `Reels` Drive folder, which also holds the sheet.

See [CLAUDE.md](CLAUDE.md) for the full spec, [CHANGELOG.md](CHANGELOG.md) for what's
shipped, and [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

To try the app without a Google account, add `?mock` to the URL. This uses an
in-memory fake of Drive and Sheets that only works on the dev server:

| URL | What you get |
|---|---|
| `http://localhost:5173/?mock` | Empty Drive, starting at first-run setup |
| `http://localhost:5173/?mock&seed` | Seven demo reels across all three stages |
| `...&user=sam` | Signed in as a second teammate (use another tab) |
| `...&reset` | Wipes the fake Drive |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 |
| `npm test` | Unit tests (workflow rules, filters, Sheet rows, prompts) |
| `npm run build` | Typecheck and build to `dist/` |

## Where things live

| Path | What |
|---|---|
| `src/config/app.config.ts` | Client ID, Sheet ID, Drive folder IDs (none of these are secret) |
| `src/config/workflow.ts` | The 15 checklist steps, as data |
| `src/config/prompts.ts` | Prompts and director notes (kit prompts are drafts for now) |
| `src/config/tools.ts` | Tool buttons |
| `src/services/google/` | All Google API calls (auth, Drive, Sheets) |
| `src/data/` | Sheet schema, workflow rules, reel operations |
| `src/screens/`, `src/components/` | UI |
