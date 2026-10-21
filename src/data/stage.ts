// Pure workflow rules: progress, automatic stage moves, completion checks.
// No Google calls here, so it's easy to test.

import type { Workflow, WorkflowStep } from '../config/workflow';
import type { Reel, ReelChecklist, Stage } from './types';

export const STAGES: Stage[] = ['raw', 'working', 'completed'];

export const STAGE_LABELS: Record<Stage, string> = {
  raw: 'Raw',
  working: 'Working',
  completed: 'Completed',
};

export function isDone(checklist: ReelChecklist | undefined, stepId: string): boolean {
  return checklist?.get(stepId)?.done ?? false;
}

export function requiredProgress(workflow: Workflow, checklist: ReelChecklist | undefined) {
  const required = workflow.steps.filter((s) => s.required);
  const missing = required.filter((s) => !isDone(checklist, s.id));
  return { done: required.length - missing.length, total: required.length, missing };
}

/** Why a step can't be ticked yet, or null if it can. */
export function stepTickBlocker(step: WorkflowStep, reel: Reel): string | null {
  if (step.requiresField === 'postedUrl' && !reel.postedUrl.trim()) {
    return 'Paste the posted URL first.';
  }
  return null;
}

/**
 * The stage a reel should move to after a step is ticked or unticked,
 * or null if it stays put. Only forward auto-moves happen: ticking the
 * "starts editing" step on a Raw reel moves it to Working.
 */
export function autoStageAfterStep(
  workflow: Workflow,
  stage: Stage,
  stepId: string,
  done: boolean,
): Stage | null {
  if (done && stepId === workflow.startsEditingStepId && stage === 'raw') return 'working';
  return null;
}

/** Everything stopping "Mark reel complete". Empty means it can be completed. */
export function completionBlockers(workflow: Workflow, reel: Reel, checklist: ReelChecklist | undefined): string[] {
  const blockers: string[] = [];
  if (reel.stage === 'completed') return ['This reel is already complete.'];
  if (reel.stage === 'raw') blockers.push('Start editing first: tick the setup step.');
  const { missing } = requiredProgress(workflow, checklist);
  if (missing.length === 1) blockers.push(`Finish “${missing[0].title}”.`);
  else if (missing.length > 1) blockers.push(`Finish ${missing.length} required steps.`);
  if (!reel.postedUrl.trim()) blockers.push('Paste the posted URL.');
  return blockers;
}

export function previousStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i > 0 ? STAGES[i - 1] : null;
}

/** The step to open first: the first required step not yet done, else the first undone step. */
export function firstOpenStep(workflow: Workflow, checklist: ReelChecklist | undefined): WorkflowStep | undefined {
  return (
    workflow.steps.find((s) => s.required && !isDone(checklist, s.id)) ??
    workflow.steps.find((s) => !isDone(checklist, s.id))
  );
}
