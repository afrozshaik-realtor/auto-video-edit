// Turns the AI editor's status text into a progress bar: which stage it's on,
// roughly how far through the whole edit, and whether the editor is alive.
// The stage labels match the step headings in the AI edit prompt (aiEdit.ts),
// which Claude copies into status.txt.

import type { Reel } from './types';

export interface AiStage {
  /** Shown to the team. For Claude's steps, also the prompt heading. */
  label: string;
  /** Lowercase prefixes of status text that mean this stage. */
  match: string[];
  /** Rough share of the total edit time. */
  weight: number;
}

export const AI_STAGES: AiStage[] = [
  { label: 'Getting ready', match: ['getting ready', 'downloading', 'starting', 'retrying'], weight: 2 },
  { label: 'Pass 01: transcribe', match: ['pass 01'], weight: 10 },
  { label: 'Pass 02: cut-out', match: ['pass 02'], weight: 19 },
  { label: 'Pass 03: captions', match: ['pass 03'], weight: 8 },
  { label: 'B-roll: shot list', match: ['b-roll: shot', 'b-roll shot'], weight: 4 },
  { label: 'B-roll: build and mix', match: ['b-roll: build', 'b-roll build', 'b-roll: mix'], weight: 14 },
  { label: 'Pass 04: motion', match: ['pass 04'], weight: 14 },
  { label: 'Pass 05: sound', match: ['pass 05'], weight: 6 },
  { label: 'Director review', match: ['director'], weight: 8 },
  { label: 'Caption and hashtags', match: ['caption'], weight: 2 },
  { label: 'Thumbnail', match: ['thumbnail'], weight: 2 },
  { label: 'Save', match: ['save', 'saving', 'done'], weight: 7 },
];

/** Stages Claude reports itself (everything after "Getting ready"). */
export const CLAUDE_STAGE_LABELS = AI_STAGES.slice(1).map((s) => s.label);

const TOTAL = AI_STAGES.reduce((n, s) => n + s.weight, 0);

export interface AiProgress {
  /** Index into AI_STAGES, or -1 when the status text isn't a known stage. */
  stageIndex: number;
  /** 0–100, or null when unknown (the bar shows the text only). */
  percent: number | null;
  /** Stage-level percentage Claude reported, if any. */
  stagePercent: number | null;
  /** "Step 5 of 14" style position for a known stage. */
  position: string | null;
}

/** Where a running edit is, from its status text (e.g. "Pass 02: cut-out 40%"). */
export function progressFromDetail(detail: string): AiProgress {
  const text = detail.trim().toLowerCase();
  const stageIndex = AI_STAGES.findIndex((s) => s.match.some((m) => text.startsWith(m)));
  if (stageIndex < 0) return { stageIndex, percent: null, stagePercent: null, position: null };

  const pct = /(\d{1,3})\s*%/.exec(text);
  const stagePercent = pct ? Math.min(100, Number(pct[1])) : null;
  const before = AI_STAGES.slice(0, stageIndex).reduce((n, s) => n + s.weight, 0);
  // Without a stage percentage, count the current stage as a third done.
  const within = AI_STAGES[stageIndex].weight * (stagePercent === null ? 1 / 3 : stagePercent / 100);
  const percent = text === 'done' ? 99 : Math.max(1, Math.min(99, Math.round(((before + within) / TOTAL) * 100)));
  return { stageIndex, percent, stagePercent, position: `Step ${stageIndex + 1} of ${AI_STAGES.length}` };
}

/** Progress for any reel state: queued is 0%, done is 100%. */
export function reelProgress(reel: Reel): AiProgress {
  if (reel.aiStatus === 'done') return { stageIndex: AI_STAGES.length, percent: 100, stagePercent: null, position: null };
  if (reel.aiStatus === 'queued' || reel.aiStatus === '') return { stageIndex: -1, percent: 0, stagePercent: null, position: null };
  return progressFromDetail(reel.aiDetail);
}

/** The AI editor job writes Meta.ai_last_check on every check. */
export const AI_HEARTBEAT_KEY = 'ai_last_check';
/** Older than this, the editor probably isn't running (checks are every 10 minutes, often late). */
export const AI_HEARTBEAT_STALE_MS = 45 * 60 * 1000;

export type EditorHealth = 'ok' | 'stale' | 'never';

export function editorHealth(lastCheck: string | undefined, now: Date = new Date()): EditorHealth {
  const t = Date.parse(lastCheck ?? '');
  if (!Number.isFinite(t)) return 'never';
  return now.getTime() - t > AI_HEARTBEAT_STALE_MS ? 'stale' : 'ok';
}
