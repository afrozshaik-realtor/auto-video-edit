import { describe, expect, it } from 'vitest';
import { workflow } from '../config/workflow';
import { prompts } from '../config/prompts';
import { tools } from '../config/tools';
import {
  autoStageAfterStep,
  completionBlockers,
  firstOpenStep,
  previousStage,
  requiredProgress,
  stepTickBlocker,
} from './stage';
import type { ChecklistEntry, Reel, ReelChecklist } from './types';

function reel(over: Partial<Reel> = {}): Reel {
  return {
    id: 'r-1', title: 'Test', business: 'tce', tags: [], stage: 'working', assignee: '',
    createdBy: '', createdAt: '', updatedAt: '', driveFolderId: 'f', finalVideoLink: '',
    postedUrl: '', postDate: '', notes: '', ...over,
  };
}

function checklist(doneIds: string[]): ReelChecklist {
  const m: ReelChecklist = new Map();
  for (const stepId of doneIds) {
    const e: ChecklistEntry = { reelId: 'r-1', stepId, done: true, doneBy: '', doneAt: '', note: '' };
    m.set(stepId, e);
  }
  return m;
}

const requiredIds = workflow.steps.filter((s) => s.required).map((s) => s.id);

describe('workflow config', () => {
  it('has 15 steps with unique ids, 14 required', () => {
    expect(workflow.steps).toHaveLength(15);
    expect(new Set(workflow.steps.map((s) => s.id)).size).toBe(15);
    expect(requiredIds).toHaveLength(14);
    expect(workflow.steps.find((s) => !s.required)?.id).toBe('polish');
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
});

describe('requiredProgress', () => {
  it('counts only required steps', () => {
    expect(requiredProgress(workflow, checklist(['shoot', 'polish']))).toMatchObject({ done: 1, total: 14 });
    expect(requiredProgress(workflow, undefined)).toMatchObject({ done: 0, total: 14 });
    expect(requiredProgress(workflow, checklist(requiredIds)).missing).toEqual([]);
  });

  it('ignores unticked entries', () => {
    const c = checklist(['shoot']);
    c.set('shoot', { ...c.get('shoot')!, done: false });
    expect(requiredProgress(workflow, c).done).toBe(0);
  });
});

describe('autoStageAfterStep', () => {
  it('moves Raw to Working when setup is ticked', () => {
    expect(autoStageAfterStep(workflow, 'raw', 'setup', true)).toBe('working');
  });
  it('does nothing for other steps, unticks, or later stages', () => {
    expect(autoStageAfterStep(workflow, 'raw', 'shoot', true)).toBeNull();
    expect(autoStageAfterStep(workflow, 'raw', 'setup', false)).toBeNull();
    expect(autoStageAfterStep(workflow, 'working', 'setup', true)).toBeNull();
    expect(autoStageAfterStep(workflow, 'completed', 'setup', true)).toBeNull();
  });
});

describe('completionBlockers', () => {
  it('allows completion when all required steps are done and the URL is set', () => {
    expect(completionBlockers(workflow, reel({ postedUrl: 'https://instagram.com/reel/x' }), checklist(requiredIds))).toEqual([]);
  });
  it('does not need the optional step', () => {
    const done = requiredIds.filter((id) => id !== 'polish');
    expect(completionBlockers(workflow, reel({ postedUrl: 'u' }), checklist(done))).toEqual([]);
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
  const post = workflow.steps.find((s) => s.id === 'post')!;
  it('needs a posted URL before the post step can be ticked', () => {
    expect(stepTickBlocker(post, reel())).toMatch(/posted URL/);
    expect(stepTickBlocker(post, reel({ postedUrl: '  ' }))).toMatch(/posted URL/);
    expect(stepTickBlocker(post, reel({ postedUrl: 'https://x' }))).toBeNull();
  });
});

describe('previousStage / firstOpenStep', () => {
  it('moves back one stage', () => {
    expect(previousStage('completed')).toBe('working');
    expect(previousStage('working')).toBe('raw');
    expect(previousStage('raw')).toBeNull();
  });
  it('opens the first required step that is not done', () => {
    expect(firstOpenStep(workflow, checklist(['shoot', 'trim']))?.id).toBe('upload');
    expect(firstOpenStep(workflow, checklist(requiredIds))?.id).toBe('polish');
  });
});
