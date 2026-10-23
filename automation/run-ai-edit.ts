// The AI editor. Runs in GitHub Actions (.github/workflows/ai-edit.yml):
//
//   npx tsx automation/run-ai-edit.ts --check   says whether any reel needs editing
//   npx tsx automation/run-ai-edit.ts           edits reels until none are waiting
//
// It acts as the owner's Google account (a refresh token in GitHub secrets),
// runs Claude Code with the owner's Claude plan token, and draws thumbnails with
// the owner's OpenAI API key. Nothing it prints includes reel titles,
// transcripts or file contents: this repo's logs are public.

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, openAsBlob, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { appConfig, type AppIds } from '../src/config/app.config';
import { AI_EDITOR_NAME } from '../src/config/workflow';
import {
  AI_FILES,
  buildAiEditPrompt,
  buildThumbnailRewritePrompt,
  cleanStatus,
  orderCandidates,
  runnableWithoutClipCheck,
  thumbnailQueued,
  waitingForClip,
} from '../src/data/aiEdit';
import { runMigrations } from '../src/data/migrations';
import * as repo from '../src/data/repo';
import { SCHEMA_VERSION } from '../src/data/schema';
import type { Reel } from '../src/data/types';
import * as drive from '../src/services/google/drive';
import { setTokenProvider } from '../src/services/google/http';
import { cropToCover, DEFAULT_IMAGE_MODEL, generateImage, ImageApiError } from './thumbnail';

const CLAUDE_TIMEOUT_MS = 3.75 * 60 * 60 * 1000;
const JOB_BUDGET_MS = 4.5 * 60 * 60 * 1000;
const STATUS_POLL_MS = 20_000;
const MAX_PROJECT_FILE_BYTES = 100 * 1024 * 1024;
const startedAt = Date.now();

function log(message: string) {
  console.log(`[ai-edit] ${message}`);
}

function env(name: string, required = true): string {
  const v = process.env[name]?.trim() ?? '';
  if (!v && required) throw new Error(`Missing ${name}. Add it under the repo's Settings → Secrets and variables → Actions.`);
  return v;
}

// ---------- Google sign-in as the owner ----------

let cached: { token: string; expiresAt: number } | null = null;

async function ownerToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 120_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_REFRESH_TOKEN'),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Google refused the AI editor's sign-in (${res.status}). Make a new refresh token with "npm run ai:google-token" and update the GOOGLE_REFRESH_TOKEN secret.`,
    );
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

function ids(): AppIds {
  if (!appConfig.sheetId) throw new Error('src/config/app.config.ts has no sheetId yet.');
  return { sheetId: appConfig.sheetId, driveFolders: { ...appConfig.driveFolders } };
}

// ---------- Finding work ----------

async function rawClip(reel: Reel): Promise<drive.DriveFile | undefined> {
  const rawFolder = await drive.findChildFolder(reel.driveFolderId, 'raw');
  if (!rawFolder) return undefined;
  const videos = (await drive.listChildren(rawFolder.id)).filter((f) => f.mimeType?.startsWith('video/'));
  return videos.sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''))[0];
}

type Work =
  | { kind: 'edit'; reel: Reel; clip: drive.DriveFile | undefined }
  | { kind: 'thumbnail'; reel: Reel };

async function nextReel(skip: Set<string> = new Set()): Promise<Work | null> {
  const data = await repo.loadAll(ids());
  const now = new Date();
  // Thumbnail redos take a minute, so they go first.
  const thumb = data.reels.find((r) => !skip.has(r.id) && thumbnailQueued(r));
  if (thumb) return { kind: 'thumbnail', reel: thumb };
  for (const reel of orderCandidates(data.reels)) {
    if (skip.has(reel.id)) continue;
    if (runnableWithoutClipCheck(reel, now)) return { kind: 'edit', reel, clip: await rawClip(reel) };
    if (waitingForClip(reel)) {
      const clip = await rawClip(reel);
      if (clip) return { kind: 'edit', reel, clip };
    }
  }
  return null;
}

// ---------- Thumbnail ----------

/** The presenter photo from the newest project/edit-vN folder, downloaded to `dir`. */
async function latestReferencePhoto(reel: Reel, dir: string): Promise<string | undefined> {
  const project = await drive.findChildFolder(reel.driveFolderId, 'project');
  if (!project) return undefined;
  const runs = (await drive.listChildren(project.id))
    .filter((f) => f.mimeType === drive.FOLDER_MIME && /^edit-v\d+$/.test(f.name))
    .sort((a, b) => Number(b.name.slice(6)) - Number(a.name.slice(6)));
  for (const run of runs) {
    const face = (await drive.listChildren(run.id)).find((f) => f.name === AI_FILES.thumbFaceName);
    if (face) return join(dir, await downloadTo(face, dir));
  }
  return undefined;
}

/** Draw the thumbnail with OpenAI, save it to final/, and record it. Never throws. */
async function makeThumbnail(reel: Reel, prompt: string, referencePath: string | undefined, workdir: string) {
  const apiKey = env('OPENAI_API_KEY', false);
  if (!prompt.trim()) {
    await setStatus(reel, { thumbStatus: 'failed', thumbDetail: 'Claude didn’t write a thumbnail prompt.' });
    return;
  }
  if (!apiKey) {
    await setStatus(reel, {
      thumbStatus: 'failed',
      thumbPrompt: prompt,
      thumbDetail: 'No OpenAI API key yet. Add the OPENAI_API_KEY secret, then click “Make a new thumbnail”.',
    });
    return;
  }
  try {
    await setStatus(reel, { thumbStatus: 'running', thumbDetail: 'Drawing the thumbnail', thumbPrompt: prompt });
    const model = env('OPENAI_IMAGE_MODEL', false) || DEFAULT_IMAGE_MODEL;
    const image = await generateImage({ apiKey, model, prompt, referencePath });
    mkdirSync(workdir, { recursive: true });
    const coverPath = join(workdir, 'thumbnail.png');
    cropToCover(image, join(workdir, 'thumb-raw.png'), coverPath);

    const finalFolder = (await drive.findChildFolder(reel.driveFolderId, 'final')) ?? (await drive.createFolder('final', reel.driveFolderId));
    const existing = (await drive.listChildren(finalFolder.id)).filter((f) => /^thumbnail(-v\d+)?\.png$/.test(f.name)).length;
    const name = existing ? `thumbnail-v${existing + 1}.png` : 'thumbnail.png';
    const file = await drive.uploadFile(name, finalFolder.id, 'image/png', await openAsBlob(coverPath, { type: 'image/png' }));

    const updated = await setStatus(reel, {
      thumbStatus: 'done',
      thumbDetail: `Made ${name}`,
      thumbnailLink: drive.fileUrl(file.id),
      thumbNotes: '',
    });
    await tick(updated, 'ai-thumbnail', true);
    await repo.logActivity(ids(), AI_EDITOR_NAME, reel.id, 'Thumbnail made', name);
    log(`reel ${reel.id}: thumbnail done`);
  } catch (e) {
    const message = e instanceof ImageApiError ? e.message : 'Making the thumbnail failed.';
    await setStatus(reel, { thumbStatus: 'failed', thumbDetail: message }).catch(() => {});
    log(`reel ${reel.id}: thumbnail failed`);
  }
}

/** Redo just the thumbnail, rewriting Claude's prompt with the team's notes first. */
async function redoThumbnail(reel: Reel) {
  log(`reel ${reel.id}: new thumbnail`);
  await setStatus(reel, { thumbStatus: 'running', thumbDetail: 'Writing the thumbnail prompt' });
  await tick(reel, 'ai-thumbnail', false);
  const workdir = join(process.env.RUNNER_TEMP ?? '/tmp', `thumb-${reel.id}`);
  const data = await repo.loadAll(ids());
  const business = data.businesses.find((b) => b.id === reel.business);

  let prompt = reel.thumbPrompt;
  if (reel.thumbNotes.trim() || !prompt.trim()) {
    prompt = askClaude(
      buildThumbnailRewritePrompt({
        businessName: business?.name ?? reel.business,
        styleRules: business?.styleRulesMd ?? '',
        reelTitle: reel.title,
        tags: reel.tags,
        caption: reel.caption,
        previousPrompt: prompt || '(none yet: write the first prompt from the brief)',
        notes: reel.thumbNotes || '(no notes: write a fresh take on the brief)',
      }),
      workdir,
    );
  }
  const reference = await latestReferencePhoto(reel, workdir);
  await makeThumbnail(reel, prompt, reference, workdir);
}

// ---------- One edit ----------

async function setStatus(reel: Reel, patch: repo.ReelPatch) {
  return repo.updateReel(ids(), reel.id, { ...patch, aiUpdatedAt: new Date().toISOString() });
}

async function tick(reel: Reel, stepId: string, done: boolean) {
  await repo.saveStep(ids(), reel.id, stepId, { done }, AI_EDITOR_NAME);
}

async function downloadTo(file: drive.DriveFile, dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const safe = file.name.replace(/[^\w.\- ]+/g, '_');
  writeFileSync(join(dir, safe), Buffer.from(await drive.downloadFile(file.id)));
  return safe;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  json: 'application/json', md: 'text/markdown', txt: 'text/plain', py: 'text/x-python', srt: 'text/plain',
};
const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Claude gets only what it needs: never the Google or OpenAI secrets. */
function claudeEnv(): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: 'C.UTF-8',
    TMPDIR: process.env.RUNNER_TEMP ?? process.env.TMPDIR,
    CLAUDE_CODE_OAUTH_TOKEN: env('CLAUDE_CODE_OAUTH_TOKEN'),
  };
  const pexels = env('PEXELS_API_KEY', false);
  if (pexels) childEnv.PEXELS_API_KEY = pexels;
  return childEnv;
}

/** The headless Claude Code command. CLAUDE_BIN lets a dry run swap in a stand-in. */
function claudeCommand(maxTurns: number): [string, string[]] {
  const model = env('CLAUDE_MODEL', false) || 'opus';
  const [bin, ...binArgs] = (env('CLAUDE_BIN', false) || 'claude').split(/\s+/);
  return [
    bin,
    [...binArgs, '-p', '--model', model, '--dangerously-skip-permissions', '--max-turns', String(maxTurns), '--output-format', 'json'],
  ];
}

/** A short Claude call that answers with text (for rewriting the thumbnail prompt). */
function askClaude(prompt: string, workdir: string): string {
  mkdirSync(workdir, { recursive: true });
  const [bin, args] = claudeCommand(3);
  const r = spawnSync(bin, args, { cwd: workdir, env: claudeEnv(), input: prompt, encoding: 'utf8', timeout: 10 * 60 * 1000 });
  try {
    const parsed = JSON.parse(r.stdout) as { result?: string; is_error?: boolean };
    if (!parsed.is_error && parsed.result?.trim()) return parsed.result.trim();
  } catch {
    // fall through
  }
  throw new Error('Claude couldn’t rewrite the thumbnail prompt.');
}

/** Run Claude Code headless. Resolves with its exit code; status.txt updates go to the Sheet. */
function runClaude(workdir: string, prompt: string, reel: Reel, logFile: string): Promise<{ code: number; result: string }> {
  return new Promise((resolve) => {
    const [bin, args] = claudeCommand(600);
    const child = spawn(bin, args, { cwd: workdir, env: claudeEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => appendFileSync(logFile, d));
    child.stdin.end(prompt);

    let lastStatus = '';
    const poll = setInterval(() => {
      const path = join(workdir, AI_FILES.status);
      if (!existsSync(path)) return;
      const s = cleanStatus(readFileSync(path, 'utf8'));
      if (s && s !== lastStatus) {
        lastStatus = s;
        setStatus(reel, { aiDetail: s }).catch(() => {});
      }
    }, STATUS_POLL_MS);
    const timer = setTimeout(() => child.kill('SIGTERM'), CLAUDE_TIMEOUT_MS);

    child.on('close', (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      appendFileSync(logFile, stdout);
      let result = '';
      try {
        const parsed = JSON.parse(stdout) as { subtype?: string; is_error?: boolean };
        result = parsed.subtype ?? '';
      } catch {
        // Not JSON: Claude was killed or crashed.
      }
      resolve({ code: code ?? 1, result });
    });
  });
}

function checkOutputs(workdir: string): string | null {
  const final = join(workdir, AI_FILES.final);
  if (!existsSync(final) || statSync(final).size < 10_000) return 'The AI editor finished without saving the final video.';
  const probe = spawnSyncJson('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', final]);
  const stream = (probe as { streams?: { width: number; height: number }[] } | null)?.streams?.[0];
  if (!stream || stream.width !== 1080 || stream.height !== 1920) return 'The final video isn’t 1080x1920.';
  return null;
}

function spawnSyncJson(cmd: string, args: string[]): unknown {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

async function uploadOutputs(reel: Reel, workdir: string, runNumber: number) {
  const reelFolder = reel.driveFolderId;
  const finalFolder = (await drive.findChildFolder(reelFolder, 'final')) ?? (await drive.createFolder('final', reelFolder));
  const projectFolder = (await drive.findChildFolder(reelFolder, 'project')) ?? (await drive.createFolder('project', reelFolder));
  const suffix = runNumber > 1 ? `-v${runNumber}` : '';

  const final = await drive.uploadFile(`final${suffix}.mp4`, finalFolder.id, 'video/mp4', await openAsBlob(join(workdir, AI_FILES.final)));
  const coverPath = join(workdir, AI_FILES.cover);
  if (existsSync(coverPath)) await drive.uploadFile(`cover${suffix}.png`, finalFolder.id, 'image/png', await openAsBlob(coverPath));

  // Project files go in project/edit-vN/, keeping the folder structure.
  const runFolder = await drive.createFolder(`edit-v${runNumber}`, projectFolder.id);
  const folders = new Map<string, string>([['', runFolder.id]]);
  const projectDir = join(workdir, AI_FILES.projectDir);
  for (const path of filesUnder(projectDir)) {
    if (statSync(path).size > MAX_PROJECT_FILE_BYTES) continue;
    const rel = relative(projectDir, path).split(/[\\/]/);
    let parent = runFolder.id;
    for (let i = 0; i < rel.length - 1; i++) {
      const key = rel.slice(0, i + 1).join('/');
      if (!folders.has(key)) folders.set(key, (await drive.createFolder(rel[i], parent)).id);
      parent = folders.get(key)!;
    }
    await drive.uploadFile(rel[rel.length - 1], parent, mimeOf(path), await openAsBlob(path));
  }
  return final;
}

async function editReel(reel: Reel, clip: drive.DriveFile | undefined) {
  const runNumber = reel.aiRuns + 1;
  log(`reel ${reel.id}: starting edit ${runNumber}`);

  if (!clip) {
    await setStatus(reel, { aiStatus: 'failed', aiDetail: 'There’s no video in the reel’s raw folder. Upload one, then try again.' });
    log(`reel ${reel.id}: no clip`);
    return;
  }

  const data = await repo.loadAll(ids());
  const business = data.businesses.find((b) => b.id === reel.business);
  const notes = reel.aiNotes;

  // Claim the reel, move it to Working and reset the AI steps.
  let current = await setStatus(reel, { aiStatus: 'running', aiDetail: 'Downloading the clip' });
  if (current.stage === 'raw') current = await repo.moveReel(ids(), AI_EDITOR_NAME, current, 'working');
  const checklist = data.checklists.get(reel.id);
  if (!checklist?.get('upload')?.done) await tick(current, 'upload', true);
  for (const step of ['ai-edit', 'ai-caption', 'ai-thumbnail', 'phone-check']) if (checklist?.get(step)?.done) await tick(current, step, false);
  current = await setStatus(current, { thumbStatus: '', thumbDetail: 'Made after the AI edit' });
  await repo.logActivity(ids(), AI_EDITOR_NAME, reel.id, 'AI edit started', `edit ${runNumber}`);

  const workdir = join(process.env.RUNNER_TEMP ?? '/tmp', `reel-${reel.id}`);
  mkdirSync(join(workdir, AI_FILES.projectDir), { recursive: true });
  const rawFileName = await downloadTo(clip, join(workdir, AI_FILES.rawDir));
  const brollFolder = await drive.findChildFolder(reel.driveFolderId, 'broll');
  const ownBrollFiles: string[] = [];
  if (brollFolder) {
    for (const f of await drive.listChildren(brollFolder.id)) {
      if (!/^(video|image)\//.test(f.mimeType ?? '')) continue;
      ownBrollFiles.push(await downloadTo(f, join(workdir, AI_FILES.ownBrollDir)));
    }
  }

  const prompt = buildAiEditPrompt({
    businessName: business?.name ?? reel.business,
    styleRules: business?.styleRulesMd ?? '',
    reelTitle: reel.title,
    tags: reel.tags,
    rawFileName,
    ownBrollFiles,
    notes,
    runNumber,
    hasStockApi: Boolean(env('PEXELS_API_KEY', false)),
  });

  const logFile = join(process.env.RUNNER_TEMP ?? '/tmp', `claude-${reel.id}.log`);
  let problem: string | null = 'The AI editor didn’t run.';
  for (let attempt = 1; attempt <= 2 && problem; attempt++) {
    await setStatus(current, { aiDetail: attempt === 1 ? 'Starting the edit' : 'Retrying the edit' });
    const retryNote =
      attempt === 1 ? '' : `\n\nA previous attempt stopped early (${problem}). Reuse what's useful from ${AI_FILES.projectDir}/ and finish the edit.`;
    const { code, result } = await runClaude(workdir, prompt + retryNote, current, logFile);
    problem = checkOutputs(workdir);
    if (problem && code !== 0) problem = result === 'error_max_turns' ? 'The AI editor ran out of turns.' : `The AI editor stopped with an error (code ${code}).`;
    log(`reel ${reel.id}: attempt ${attempt} ${problem ? 'failed' : 'finished'}`);
  }

  if (problem) {
    await setStatus(current, { aiStatus: 'failed', aiDetail: problem });
    await repo.logActivity(ids(), AI_EDITOR_NAME, reel.id, 'AI edit failed', problem);
    return;
  }

  await setStatus(current, { aiDetail: 'Saving to Drive' });
  const final = await uploadOutputs(current, workdir, runNumber);
  const captionPath = join(workdir, AI_FILES.caption);
  const caption = existsSync(captionPath) ? readFileSync(captionPath, 'utf8').trim() : '';

  current = await setStatus(current, {
    aiStatus: 'done',
    aiDetail: `Finished edit ${runNumber}`,
    aiRuns: runNumber,
    aiNotes: '',
    caption,
    finalVideoLink: drive.fileUrl(final.id),
  });
  await tick(current, 'ai-edit', true);
  if (caption) await tick(current, 'ai-caption', true);
  await repo.logActivity(ids(), AI_EDITOR_NAME, reel.id, 'AI edit finished', `edit ${runNumber}`);
  log(`reel ${reel.id}: done`);

  // The thumbnail uses Claude's prompt and reference photo from this edit.
  const thumbPromptPath = join(workdir, AI_FILES.thumbPrompt);
  const facePath = join(workdir, AI_FILES.thumbFace);
  await makeThumbnail(
    current,
    existsSync(thumbPromptPath) ? readFileSync(thumbPromptPath, 'utf8').trim() : '',
    existsSync(facePath) ? facePath : undefined,
    workdir,
  );
}

// ---------- Main ----------

async function main() {
  setTokenProvider(ownerToken);
  const check = process.argv.includes('--check');

  // Until the owner adds the secrets, the scheduled check skips quietly instead of failing.
  const setUp = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].every((n) => env(n, false));
  if (check && !setUp) {
    log('the AI editor isn’t set up yet (Google secrets missing), skipping');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'has_work=false\n');
    return;
  }

  const data = await repo.loadAll(ids());
  if (data.schemaVersion < SCHEMA_VERSION) {
    log(`migrating sheet from schema ${data.schemaVersion} to ${SCHEMA_VERSION}`);
    await runMigrations(ids(), data.schemaVersion);
  }

  if (check) {
    const work = await nextReel();
    log(work ? `work found: ${work.kind} for reel ${work.reel.id}` : 'nothing to edit');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `has_work=${work ? 'true' : 'false'}\n`);
    return;
  }

  // Keep going while there's work and time left in this job. Each reel is tried once per job.
  const tried = new Set<string>();
  while (Date.now() - startedAt < JOB_BUDGET_MS - CLAUDE_TIMEOUT_MS / 2) {
    const work = await nextReel(tried);
    if (!work) break;
    tried.add(work.reel.id);
    try {
      if (work.kind === 'thumbnail') await redoThumbnail(work.reel);
      else await editReel(work.reel, work.clip);
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      log(`reel ${work.reel.id}: error`);
      const patch: repo.ReelPatch =
        work.kind === 'thumbnail' ? { thumbStatus: 'failed', thumbDetail: message } : { aiStatus: 'failed', aiDetail: message };
      await setStatus(work.reel, patch).catch(() => {});
    }
  }
}

main().catch((e) => {
  console.error(`[ai-edit] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
