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

## Set up the AI editor

The AI edit runs in GitHub Actions ([.github/workflows/ai-edit.yml](.github/workflows/ai-edit.yml)).
Every 10 minutes it checks the Reel Tracker for reels with a new clip in `raw/`, or a
re-run request, and edits them with Claude Code. Until the secrets below are added it
skips quietly.

1. **Let the job's Google sign-in last.** In Google Cloud Console → Google Auth
   Platform → Audience, click **Publish app** so the status is *In production*. In
   *Testing*, the job's sign-in expires every 7 days. You'll see an "unverified app"
   warning when signing in; that's expected for your own app.
2. **Create a Desktop OAuth client.** Google Auth Platform → Clients → Create client →
   Application type **Desktop app**. Keep its client ID and client secret.
3. **Make the job's Google refresh token.** On your computer, in this repo:
   ```bash
   npm run ai:google-token
   ```
   Paste the Desktop client ID and secret, open the link, and sign in as the account
   that owns the `Reels` folder. It prints a refresh token.
4. **Make a Claude token from your plan.** With [Claude Code](https://code.claude.com) installed:
   ```bash
   claude setup-token
   ```
5. **OpenAI key for thumbnails.** Create an API key at
   https://platform.openai.com/api-keys (it's billed per image, separately from a
   ChatGPT subscription). A good idea: set a monthly spending limit there.
6. **Optional: free stock footage.** Get a free API key at
   https://www.pexels.com/api/. Without it, B-roll is built by Claude or taken from the
   reel's `broll/` folder.
7. **Add the secrets.** Run each of these and paste the value when asked. They're
   stored encrypted in GitHub, never in the repo:
   ```bash
   gh secret set GOOGLE_OAUTH_CLIENT_ID
   ```
   ```bash
   gh secret set GOOGLE_OAUTH_CLIENT_SECRET
   ```
   ```bash
   gh secret set GOOGLE_REFRESH_TOKEN
   ```
   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN
   ```
   ```bash
   gh secret set OPENAI_API_KEY
   ```
   ```bash
   gh secret set PEXELS_API_KEY
   ```
8. **Try it.** Upload a clip to a reel's `raw/` folder. Within about 10 minutes the AI
   edit step shows "Downloading the clip", then each pass. To start a check straight
   away, run:
   ```bash
   gh workflow run ai-edit.yml
   ```

To use a different Claude model, set the repository variable `CLAUDE_MODEL` (default
`opus`). To use a different image model, set `OPENAI_IMAGE_MODEL` (default
`gpt-image-2.5-sunburst`; `gpt-image-2.5-flare` is faster). GitHub turns scheduled workflows off after 60 days without a commit; re-enable
it under the repo's Actions tab if that happens.

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
| `...&seed&v1` | An old (schema 1) sheet, to test the migration |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 |
| `npm test` | Unit tests (workflow rules, filters, Sheet rows, prompts) |
| `npm run build` | Typecheck (app and AI editor) and build to `dist/` |
| `npm run ai:google-token` | One-time: make the AI editor's Google refresh token |
| `npm run ai:edit` | Run the AI editor job (needs the secrets as environment variables) |

## Where things live

| Path | What |
|---|---|
| `src/config/app.config.ts` | Client ID, Sheet ID, Drive folder IDs (none of these are secret) |
| `src/config/workflow.ts` | The 8 checklist steps, as data |
| `src/config/prompts.ts` | Prompts and director notes (kit prompts are drafts for now) |
| `src/data/aiEdit.ts` | The AI edit prompt, the file contract, and which reel runs next |
| `automation/` | The AI editor job and the refresh-token helper |
| `src/config/tools.ts` | Tool buttons |
| `src/services/google/` | All Google API calls (auth, Drive, Sheets) |
| `src/data/` | Sheet schema, workflow rules, reel operations |
| `src/screens/`, `src/components/` | UI |
