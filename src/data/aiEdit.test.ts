import { describe, expect, it } from 'vitest';
import { driveFileId } from '../components/AiPanels';
import { AS_IS_LINE, prompts } from '../config/prompts';
import {
  AI_FILES,
  AI_STALE_MS,
  THUMB_REQUEST_SIZE,
  buildAiEditPrompt,
  buildThumbnailRewritePrompt,
  cleanStatus,
  orderCandidates,
  parseRetrim,
  RETRIM_STATUS,
  runnableWithoutClipCheck,
  thumbnailQueued,
  waitingForClip,
} from './aiEdit';
import { makeReel } from './fixtures';
import { missingHeaders } from './migrations';
import { TABS, reelFromRecord, reelToRecord } from './schema';

const now = new Date('2026-10-23T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe('which reels the AI editor picks up', () => {
  it('runs queued reels and crashed runs, without checking Drive', () => {
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'queued' }), now)).toBe(true);
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'running', aiUpdatedAt: hoursAgo(1) }), now)).toBe(false);
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'running', aiUpdatedAt: hoursAgo(AI_STALE_MS / 3600_000 + 1) }), now)).toBe(true);
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'running', aiUpdatedAt: '' }), now)).toBe(true);
  });

  it('never re-runs finished or failed reels, or completed ones, by itself', () => {
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'done' }), now)).toBe(false);
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'failed' }), now)).toBe(false);
    expect(runnableWithoutClipCheck(makeReel({ aiStatus: 'queued', stage: 'completed' }), now)).toBe(false);
    expect(waitingForClip(makeReel({ aiStatus: 'failed' }))).toBe(false);
  });

  it('waits for a trimmed clip on Trimmed reels that have never been edited', () => {
    expect(waitingForClip(makeReel({ stage: 'trimmed' }))).toBe(true);
    expect(waitingForClip(makeReel({ stage: 'trimmed', driveFolderId: '' }))).toBe(false);
    // Raw reels wait for the person to trim them, even if a clip is uploaded.
    expect(waitingForClip(makeReel({ stage: 'raw' }))).toBe(false);
    // A reel waiting for a re-trim is restarted by marking Manual trim done, not automatically.
    expect(waitingForClip(makeReel({ stage: 'trimmed', aiStatus: 'retrim' }))).toBe(false);
    expect(runnableWithoutClipCheck(makeReel({ stage: 'trimmed', aiStatus: 'retrim' }), now)).toBe(false);
    expect(waitingForClip(makeReel({ stage: 'completed' }))).toBe(false);
  });

  it('puts queued reels first, oldest first', () => {
    const order = orderCandidates([
      makeReel({ id: 'new', createdAt: '2026-10-22' }),
      makeReel({ id: 'q2', aiStatus: 'queued', aiUpdatedAt: '2026-10-23T10:00' }),
      makeReel({ id: 'old', createdAt: '2026-10-20' }),
      makeReel({ id: 'q1', aiStatus: 'queued', aiUpdatedAt: '2026-10-23T09:00' }),
    ]).map((r) => r.id);
    expect(order).toEqual(['q1', 'q2', 'old', 'new']);
  });
});

describe('manual trim: the AI never cuts footage', () => {
  const input = {
    businessName: 'AM Builders', styleRules: '', reelTitle: 'T', tags: [], clipFileName: 't_trimmed.mp4',
    ownBrollFiles: [], notes: '', runNumber: 1, hasStockApi: false,
  };

  it('has no trim or tighten step, and no prompt tells Claude to cut, trim or tighten', () => {
    const p = buildAiEditPrompt(input);
    expect(p).not.toMatch(/### Trim|Tighten the cut|dead air|filler/i);
    expect(prompts.find((x) => x.id === 'tighten')).toBeUndefined();
    for (const x of prompts) {
      // The only cut/trim/tighten wording allowed is the instruction NOT to do it
      // (or Pass 01 describing the problems to flag).
      // ("cut-out" is the name of Pass 02, not an instruction to cut.)
      const lines = x.text.split('\n').filter((l) => /\b(cut|cuts|trim|tighten)\b(?!-)/i.test(l));
      for (const l of lines) expect(l, x.id).toMatch(/\b(do not|don.t|never)\b|clipped at a cut|cut that lands/i);
    }
  });

  it('uses the new Pass 01 text exactly', () => {
    const pass01 = prompts.find((x) => x.id === 'pass-01')!;
    expect(pass01.text).toBe(
      [
        'Pass 01 — Transcribe.',
        "I've uploaded a clip that I have ALREADY TRIMMED by hand. Do not cut, trim or tighten anything, and do not suggest cuts.",
        "First confirm the clip's length, resolution and frame rate.",
        'Then transcribe it with word-level timestamps, save them as words.json, and show me the transcript as a table (word, start, end) so I can fix misheard words.',
        "Only flag problems I may have missed: a word that sounds clipped at a cut, or a cut that lands inside a word or a breath. Give me the timecode for each one and I'll fix it in my editor and re-upload.",
      ].join('\n'),
    );
  });

  it('starts every later pass with the as-is line', () => {
    for (const id of ['pass-02', 'pass-03', 'broll-plan', 'broll-mix', 'pass-04', 'pass-05']) {
      expect(prompts.find((x) => x.id === id)!.text.startsWith(AS_IS_LINE), id).toBe(true);
    }
    expect(AS_IS_LINE).toBe('Work on the manually trimmed clip as-is. Never re-trim or remove footage.');
  });

  it('stops for a re-trim instead of fixing bad cuts itself', () => {
    const p = buildAiEditPrompt(input);
    expect(p).toContain(AI_FILES.retrim);
    expect(p).toContain(RETRIM_STATUS);
    expect(p.indexOf(AI_FILES.retrim)).toBeLessThan(p.indexOf('\n### Pass 02'));
    expect(parseRetrim('- 00:12.4 — clipped\n\n• 00:31.0 — breath\n')).toEqual(['00:12.4 — clipped', '00:31.0 — breath']);
    expect(parseRetrim('\n  \n')).toEqual([]);
  });
});

describe('the AI edit prompt', () => {
  const base = {
    businessName: 'AM Builders',
    styleRules: '# Reel Style Rules\n- Brand colors: #C2571A',
    reelTitle: 'Basement egress windows',
    tags: ['basements'],
    clipFileName: 'take1_trimmed.mp4',
    ownBrollFiles: [],
    notes: '',
    runNumber: 1,
    hasStockApi: false,
  };

  it('runs every pass in order with no human in the loop', () => {
    const p = buildAiEditPrompt(base);
    const order = ['Pass 01', 'Pass 02', 'Pass 03', 'B-roll: shot list', 'B-roll: build and mix', 'Pass 04', 'Pass 05', 'Director review', 'Caption and hashtags', 'Thumbnail', 'Save'].map((h) => `\n### ${h}`);
    const positions = order.map((h) => p.indexOf(h));
    expect(positions.every((x) => x >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(p).toMatch(/nobody will answer questions/i);
    expect(p).not.toContain('{{');
  });

  it('fills in the reel, the style rules and the file contract', () => {
    const p = buildAiEditPrompt(base);
    expect(p).toContain('AM Builders');
    expect(p).toContain('Brand colors: #C2571A');
    expect(p).toContain(`${AI_FILES.clipDir}/take1_trimmed.mp4`);
    for (const f of [AI_FILES.final, AI_FILES.cover, AI_FILES.caption, AI_FILES.status]) expect(p).toContain(f);
  });

  it('only uses stock footage when a stock API key is available', () => {
    expect(buildAiEditPrompt(base)).toContain('Plan BUILD and OWN shots only');
    expect(buildAiEditPrompt({ ...base, hasStockApi: true })).toContain('PEXELS_API_KEY');
  });

  it('puts re-run notes first and lists the team’s own footage', () => {
    const p = buildAiEditPrompt({ ...base, notes: '- Hook harder', runNumber: 2, ownBrollFiles: ['site.mp4'] });
    expect(p).toContain('edit number 2');
    expect(p.indexOf('- Hook harder')).toBeLessThan(p.indexOf('\n### Pass 01'));
    expect(p).toContain('site.mp4');
    expect(buildAiEditPrompt(base)).not.toContain('Changes the team asked for');
  });

  it('cleans the status line Claude writes', () => {
    expect(cleanStatus('  Pass 02: cut-out  \nextra')).toBe('Pass 02: cut-out');
    expect(cleanStatus('x'.repeat(200))).toHaveLength(80);
  });
});

describe('thumbnails', () => {
  const base = {
    businessName: 'TCE (Real Estate)',
    styleRules: '- Brand colors: #2F5FD0',
    reelTitle: 'First-time buyer mistakes',
    tags: ['buyers'],
    clipFileName: 'take1_trimmed.mp4',
    ownBrollFiles: [],
    notes: '',
    runNumber: 1,
    hasStockApi: false,
  };

  it('has Claude write the image prompt and pick the reference photo during the edit', () => {
    const p = buildAiEditPrompt(base);
    expect(p).toContain('\n### Thumbnail');
    expect(p).toContain(AI_FILES.thumbPrompt);
    expect(p).toContain(AI_FILES.thumbFace);
    expect(p.indexOf('\n### Thumbnail')).toBeLessThan(p.indexOf('\n### Save'));
    expect(p).toMatch(/keep the person from the reference photo exactly/i);
    expect(AI_FILES.thumbFace.endsWith(AI_FILES.thumbFaceName)).toBe(true);
    expect(AI_FILES.thumbFace.startsWith(AI_FILES.projectDir)).toBe(true);
  });

  it('asks for a model-friendly size that crops to 1080x1920', () => {
    const [w, h] = THUMB_REQUEST_SIZE.split('x').map(Number);
    expect(w % 16).toBe(0);
    expect(h % 16).toBe(0);
    expect(w).toBeGreaterThanOrEqual(1080);
    expect(h).toBeGreaterThanOrEqual(1920);
  });

  it('only redoes a queued thumbnail when no full edit is pending', () => {
    expect(thumbnailQueued(makeReel({ thumbStatus: 'queued', aiStatus: 'done' }))).toBe(true);
    expect(thumbnailQueued(makeReel({ thumbStatus: 'queued', aiStatus: 'running' }))).toBe(false);
    expect(thumbnailQueued(makeReel({ thumbStatus: 'queued', aiStatus: 'queued' }))).toBe(false);
    expect(thumbnailQueued(makeReel({ thumbStatus: 'done', aiStatus: 'done' }))).toBe(false);
  });

  it('rewrites the prompt from the team’s notes', () => {
    const p = buildThumbnailRewritePrompt({
      ...base,
      caption: 'Three mistakes to avoid.\n\n#realestate',
      previousPrompt: 'OLD PROMPT',
      notes: 'Headline “Don’t overpay”',
    });
    expect(p).toContain('OLD PROMPT');
    expect(p).toContain('Headline “Don’t overpay”');
    expect(p).toContain('Three mistakes to avoid.');
    expect(p).not.toContain('#realestate');
    expect(p).toMatch(/Reply with the new prompt only/);
    expect(p).not.toContain('{{');
  });

  it('reads the Drive file id from a link', () => {
    expect(driveFileId('https://drive.google.com/file/d/abc_123-X/view')).toBe('abc_123-X');
    expect(driveFileId('')).toBeNull();
  });
});

describe('schema v3', () => {
  it('round-trips the AI and thumbnail fields', () => {
    const r = makeReel({
      aiStatus: 'running', aiDetail: 'Pass 03', aiRuns: 2, aiNotes: 'n', caption: 'c',
      thumbnailLink: 'l', thumbStatus: 'failed', thumbDetail: 'd', thumbPrompt: 'p', thumbNotes: 'tn',
    });
    expect(reelFromRecord(reelToRecord(r))).toEqual(r);
    expect(reelFromRecord({ ai_status: 'nonsense', ai_runs: 'x', thumb_status: '??' })).toMatchObject({
      aiStatus: '', aiRuns: 0, thumbStatus: '',
    });
  });

  it('finds the columns an older sheet is missing, in order', () => {
    const v1 = TABS.Reels.slice(0, 14);
    const v2 = TABS.Reels.slice(0, 20);
    expect(missingHeaders([...v1], TABS.Reels)).toEqual([
      'ai_status', 'ai_detail', 'ai_updated_at', 'ai_runs', 'ai_notes', 'caption',
      'thumbnail_link', 'thumb_status', 'thumb_detail', 'thumb_prompt', 'thumb_notes',
    ]);
    expect(missingHeaders([...v2], TABS.Reels)).toEqual(['thumbnail_link', 'thumb_status', 'thumb_detail', 'thumb_prompt', 'thumb_notes']);
    expect(missingHeaders([...TABS.Reels], TABS.Reels)).toEqual([]);
    expect(missingHeaders([...v1, 'my_extra', 'caption'], TABS.Reels)).not.toContain('caption');
  });
});
