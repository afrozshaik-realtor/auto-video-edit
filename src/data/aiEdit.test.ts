import { describe, expect, it } from 'vitest';
import { AI_FILES, AI_STALE_MS, buildAiEditPrompt, cleanStatus, orderCandidates, runnableWithoutClipCheck, waitingForClip } from './aiEdit';
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

  it('waits for a clip on reels that have never been edited', () => {
    expect(waitingForClip(makeReel({ stage: 'raw' }))).toBe(true);
    expect(waitingForClip(makeReel({ stage: 'raw', driveFolderId: '' }))).toBe(false);
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

describe('the AI edit prompt', () => {
  const base = {
    businessName: 'AM Builders',
    styleRules: '# Reel Style Rules\n- Brand colors: #C2571A',
    reelTitle: 'Basement egress windows',
    tags: ['basements'],
    rawFileName: 'take1.mp4',
    ownBrollFiles: [],
    notes: '',
    runNumber: 1,
    hasStockApi: false,
  };

  it('runs every pass in order with no human in the loop', () => {
    const p = buildAiEditPrompt(base);
    const order = ['Trim', 'Pass 01', 'Tighten the cut', 'Pass 02', 'B-roll: shot list', 'B-roll: build and mix', 'Pass 03', 'Pass 04', 'Pass 05', 'Director review', 'Caption and hashtags', 'Save'].map((h) => `\n### ${h}`);
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
    expect(p).toContain(`${AI_FILES.rawDir}/take1.mp4`);
    for (const f of [AI_FILES.final, AI_FILES.cover, AI_FILES.caption, AI_FILES.status]) expect(p).toContain(f);
  });

  it('only uses stock footage when a stock API key is available', () => {
    expect(buildAiEditPrompt(base)).toContain('Plan BUILD and OWN shots only');
    expect(buildAiEditPrompt({ ...base, hasStockApi: true })).toContain('PEXELS_API_KEY');
  });

  it('puts re-run notes first and lists the team’s own footage', () => {
    const p = buildAiEditPrompt({ ...base, notes: '- Hook harder', runNumber: 2, ownBrollFiles: ['site.mp4'] });
    expect(p).toContain('edit number 2');
    expect(p.indexOf('- Hook harder')).toBeLessThan(p.indexOf('### Trim'));
    expect(p).toContain('site.mp4');
    expect(buildAiEditPrompt(base)).not.toContain('Changes the team asked for');
  });

  it('cleans the status line Claude writes', () => {
    expect(cleanStatus('  Pass 02: cut-out  \nextra')).toBe('Pass 02: cut-out');
    expect(cleanStatus('x'.repeat(200))).toHaveLength(80);
  });
});

describe('schema v2', () => {
  it('round-trips the AI fields', () => {
    const r = makeReel({ aiStatus: 'running', aiDetail: 'Pass 03', aiRuns: 2, aiNotes: 'n', caption: 'c' });
    expect(reelFromRecord(reelToRecord(r))).toEqual(r);
    expect(reelFromRecord({ ai_status: 'nonsense', ai_runs: 'x' })).toMatchObject({ aiStatus: '', aiRuns: 0 });
  });

  it('finds the columns a v1 sheet is missing, in order', () => {
    const v1 = TABS.Reels.slice(0, 14);
    expect(missingHeaders([...v1], TABS.Reels)).toEqual(['ai_status', 'ai_detail', 'ai_updated_at', 'ai_runs', 'ai_notes', 'caption']);
    expect(missingHeaders([...TABS.Reels], TABS.Reels)).toEqual([]);
    expect(missingHeaders([...v1, 'my_extra', 'caption'], TABS.Reels)).not.toContain('caption');
  });
});
