import { describe, expect, it } from 'vitest';
import { workflow } from '../config/workflow';
import { prompts } from '../config/prompts';
import { tools } from '../config/tools';
import { makeReel as reel } from './fixtures';
import {
  autoStageAfterStep,
  completionBlockers,
  firstOpenStep,
  previousStage,
  requiredProgress,
  stepTickBlocker,
} from './stage';
import type { ChecklistEntry, ReelChecklist } from './types';

function checklist(doneIds: string[]): ReelChecklist {
  const m: ReelChecklist = new Map();
  for (const stepId of doneIds) {
    const e: ChecklistEntry = { reelId: 'r-1', stepId, done: true, doneBy: '', doneAt: '', note: '' };
    m.set(stepId, e);
  }
  return m;
}

const requiredIds = workflow.steps.filter((s) => s.required).map((s) => s.id);
const step = (id: string) => workflow.steps.find((s) => s.id === id)!;

describe('workflow config', () => {
  it('has 8 steps in order, 7 required, with the AI steps automatic', () => {
    expect(workflow.steps.map((s) => s.id)).toEqual([
      'shoot', 'upload', 'ai-edit', 'ai-caption', 'ai-thumbnail', 'polish', 'phone-check', 'post',
    ]);
    expect(requiredIds).toHaveLength(7);
    expect(workflow.steps.filter((s) => !s.required).map((s) => s.id)).toEqual(['polish']);
    expect(workflow.steps.filter((s) => s.auto).map((s) => s.id)).toEqual(['ai-edit', 'ai-caption', 'ai-thumbnail']);
  });

  it('only references prompts and tools that exist', () => {
    const promptIds = new Set(prompts.map((p) => p.id));
    const toolIds = new Set(tools.map((t) => t.id));
    for (const s of workflow.steps) {
      for (const p of s.prompts ?? []) expect(promptIds, `${s.id} → ${p}`).toContain(p);
      for (const t of s.tools ?? []) expect(toolIds, `${s.id} → ${t}`).toContain(t);
    }
    expect(workflow.steps.map((s) => s.id)).toContain(workflow.startsEditingStepId);
  });

  it('gives no step a prompt to copy by hand', () => {
    for (const s of workflow.steps) {
      const blocks = (s.prompts ?? []).filter((id) => prompts.find((p) => p.id === id)?.kind === 'block');
      expect(blocks, s.id).toEqual([]);
    }
  });
});

describe('requiredProgress', () => {
  it('counts only required steps', () => {
    expect(requiredProgress(workflow, checklist(['shoot', 'polish']))).toMatchObject({ done: 1, total: 7 });
    expect(requiredProgress(workflow, undefined)).toMatchObject({ done: 0, total: 7 });
    expect(requiredProgress(workflow, checklist(requiredIds)).missing).toEqual([]);
  });

  it('ignores unticked entries and steps no longer in the workflow', () => {
    const c = checklist(['shoot', 'setup', 'pass-01']);
    c.set('shoot', { ...c.get('shoot')!, done: false });
    expect(requiredProgress(workflow, c).done).toBe(0);
  });
});

describe('autoStageAfterStep', () => {
  it('moves Raw to Working when the AI edit step is ticked', () => {
    expect(autoStageAfterStep(workflow, 'raw', 'ai-edit', true)).toBe('working');
  });
  it('does nothing for other steps, unticks, or later stages', () => {
    expect(autoStageAfterStep(workflow, 'raw', 'shoot', true)).toBeNull();
    expect(autoStageAfterStep(workflow, 'raw', 'ai-edit', false)).toBeNull();
    expect(autoStageAfterStep(workflow, 'working', 'ai-edit', true)).toBeNull();
  });
});

describe('completionBlockers', () => {
  it('allows completion when all required steps are done and the URL is set', () => {
    expect(completionBlockers(workflow, reel({ postedUrl: 'https://instagram.com/reel/x' }), checklist(requiredIds))).toEqual([]);
  });
  it('requires the posted URL', () => {
    expect(completionBlockers(workflow, reel(), checklist(requiredIds))).toEqual(['Paste the posted URL.']);
  });
  it('names a single missing step', () => {
    const done = requiredIds.filter((id) => id !== 'phone-check');
    expect(completionBlockers(workflow, reel({ postedUrl: 'u' }), checklist(done))).toEqual(['Finish “Phone check”.']);
  });
  it('blocks Raw and already completed reels', () => {
    expect(completionBlockers(workflow, reel({ stage: 'raw', postedUrl: 'u' }), checklist(requiredIds))).toHaveLength(1);
    expect(completionBlockers(workflow, reel({ stage: 'completed', postedUrl: 'u' }), checklist(requiredIds))).toEqual([
      'This reel is already complete.',
    ]);
  });
});

describe('stepTickBlocker', () => {
  it('needs a posted URL before the post step can be ticked', () => {
    expect(stepTickBlocker(step('post'), reel())).toMatch(/posted URL/);
    expect(stepTickBlocker(step('post'), reel({ postedUrl: 'https://x' }))).toBeNull();
  });
  it('never lets people tick the automatic steps', () => {
    expect(stepTickBlocker(step('ai-edit'), reel())).toMatch(/AI editor/);
    expect(stepTickBlocker(step('ai-caption'), reel())).toMatch(/AI editor/);
    expect(stepTickBlocker(step('shoot'), reel())).toBeNull();
  });
});

describe('previousStage / firstOpenStep', () => {
  it('moves back one stage', () => {
    expect(previousStage('completed')).toBe('working');
    expect(previousStage('working')).toBe('raw');
    expect(previousStage('raw')).toBeNull();
  });
  it('opens the first required step that is not done', () => {
    expect(firstOpenStep(workflow, checklist(['shoot']))?.id).toBe('upload');
    expect(firstOpenStep(workflow, checklist(requiredIds))?.id).toBe('polish');
  });
});
