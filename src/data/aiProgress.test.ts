import { describe, expect, it } from 'vitest';
import { buildAiEditPrompt } from './aiEdit';
import { AI_HEARTBEAT_STALE_MS, AI_STAGES, CLAUDE_STAGE_LABELS, editorHealth, progressFromDetail, reelProgress } from './aiProgress';
import { makeReel } from './fixtures';

describe('AI edit progress', () => {
  it('uses the same stage names as the prompt headings Claude copies', () => {
    const prompt = buildAiEditPrompt({
      businessName: 'B', styleRules: '', reelTitle: 'T', tags: [], clipFileName: 'a.mp4',
      ownBrollFiles: [], notes: '', runNumber: 1, hasStockApi: false,
    });
    for (const label of CLAUDE_STAGE_LABELS) expect(prompt, label).toContain(`\n### ${label}\n`);
  });

  it('recognises every stage label and the job’s own status lines', () => {
    AI_STAGES.forEach((s, i) => expect(progressFromDetail(s.label).stageIndex, s.label).toBe(i));
    expect(progressFromDetail('Downloading the clip').stageIndex).toBe(0);
    expect(progressFromDetail('Retrying the edit').stageIndex).toBe(0);
    expect(progressFromDetail('Saving to Drive').stageIndex).toBe(AI_STAGES.length - 1);
    expect(progressFromDetail('Pass 03: captions').stageIndex).not.toBe(progressFromDetail('Caption and hashtags').stageIndex);
  });

  it('moves forward through the stages and within a stage', () => {
    const seq = AI_STAGES.map((s) => progressFromDetail(s.label).percent!);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    const a = progressFromDetail('Pass 02: cut-out 10%').percent!;
    const b = progressFromDetail('Pass 02: cut-out 90%').percent!;
    expect(b).toBeGreaterThan(a);
    expect(progressFromDetail('Pass 02: cut-out 90%')).toMatchObject({ stagePercent: 90, position: 'Step 3 of 12' });
    expect(progressFromDetail('Pass 05: sound').percent!).toBeLessThan(100);
  });

  it('shows text only for unknown status lines', () => {
    expect(progressFromDetail('Installing rembg')).toMatchObject({ stageIndex: -1, percent: null });
  });

  it('is 0% while queued and 100% when done', () => {
    expect(reelProgress(makeReel({ aiStatus: 'queued' })).percent).toBe(0);
    expect(reelProgress(makeReel({ aiStatus: 'done' })).percent).toBe(100);
    expect(reelProgress(makeReel({ aiStatus: 'running', aiDetail: 'Pass 01: transcribe' })).stageIndex).toBe(1);
  });
});

describe('AI editor health', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  it('knows if the editor has never checked in, is alive, or has gone quiet', () => {
    expect(editorHealth(undefined, now)).toBe('never');
    expect(editorHealth('', now)).toBe('never');
    expect(editorHealth('2026-10-23T11:50:00Z', now)).toBe('ok');
    expect(editorHealth(new Date(now.getTime() - AI_HEARTBEAT_STALE_MS - 1000).toISOString(), now)).toBe('stale');
  });
});
