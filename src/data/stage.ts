// Pure workflow rules: progress, automatic stage moves, completion checks.
// No Google calls here, so it's easy to test.

import type { Workflow, WorkflowStep } from '../config/workflow';
import type { Reel, ReelChecklist, Stage } from './types';

export const STAGES: Stage[] = ['raw', 'trimmed', 'working', 'completed'];

export const STAGE_LABELS: Record<Stage, string> = {
  raw: 'Raw',
  trimmed: 'Trimmed',
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
  if (step.auto) return 'The AI editor ticks this step when it finishes.';
  if (step.requiresField === 'postedUrl' && !reel.postedUrl.trim()) {
    return 'Paste the posted URL first.';
  }
  return null;
}

/**
 * The stage a reel should move to after a step is ticked or unticked,
 * or null if it stays put. Only forward auto-moves happen, as listed in
 * workflow.stageMoves (e.g. ticking Manual trim moves Raw → Trimmed).
 */
export function autoStageAfterStep(
  workflow: Workflow,
  stage: Stage,
  stepId: string,
  done: boolean,
): Stage | null {
  if (!done) return null;
  const move = workflow.stageMoves.find((m) => m.stepId === stepId && m.from.includes(stage));
  return move ? move.to : null;
}

/** Everything stopping "Mark reel complete". Empty means it can be completed. */
export function completionBlockers(workflow: Workflow, reel: Reel, checklist: ReelChecklist | undefined): string[] {
  const blockers: string[] = [];
  if (reel.stage === 'completed') return ['This reel is already complete.'];
  if (reel.stage === 'raw') blockers.push('Trim the clip by hand and mark Manual trim done.');
  if (reel.stage === 'trimmed') blockers.push('Wait for the AI edit to start.');
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
