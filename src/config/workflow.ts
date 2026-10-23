// The guided checklist. Steps are data: add, reorder or edit them here
// without touching UI code. Bump WORKFLOW_VERSION when steps change.
// Step ids are stored in the Sheet, so never rename an existing id.

export type Who = 'Claude' | 'You' | 'Both';

/** Special content shown inside a step, driven by the reel's AI status. */
export type StepPanel = 'ai-edit' | 'ai-caption' | 'review';

export interface WorkflowStep {
  id: string;
  title: string;
  who: Who;
  required: boolean;
  instructions: string;
  doneWhen: string;
  /** Ticked by the AI editor job, not by people. */
  auto?: boolean;
  panel?: StepPanel;
  /** Prompt ids from prompts.ts. */
  prompts?: string[];
  /** Tool ids from tools.ts. */
  tools?: string[];
  /** Tips shown under a "Stuck?" disclosure. */
  stuck?: string[];
  /** A reel field that must be filled in before the step can be ticked. */
  requiresField?: 'postedUrl';
  /** A reel field edited inside this step (optional to fill). */
  field?: 'finalVideoLink' | 'postedUrl';
}

export interface Workflow {
  version: number;
  /** Ticking this step means editing has started: the reel moves to Working. */
  startsEditingStepId: string;
  steps: WorkflowStep[];
}

export const AI_EDITOR_NAME = 'Reel Studio AI';

export const workflow: Workflow = {
  // v1: 15 steps, each kit pass ticked by hand. v2: added two B-roll steps.
  // v3: the AI editor runs every pass (trim to save) and the caption automatically.
  version: 3,
  startsEditingStepId: 'ai-edit',
  steps: [
    {
      id: 'shoot',
      title: 'Shoot the clip',
      who: 'You',
      required: true,
      instructions:
        'Leave headroom above your head, use a clean background, and record clear audio. No need to trim: the AI edit cuts dead air.',
      doneWhen: 'You have a take you’re happy with.',
    },
    {
      id: 'upload',
      title: 'Upload the raw clip',
      who: 'You',
      required: true,
      instructions:
        'Upload the clip to the raw folder inside this reel’s Drive folder. Put any footage of your own for B-roll in its broll folder. The AI edit starts by itself, usually within 15 minutes.',
      doneWhen: 'The clip is in the reel’s raw folder.',
      tools: ['drive'],
      stuck: [
        'Upload one video file only to raw. If there are several, the AI uses the newest one.',
        'Keep it under about 2 minutes. Longer clips take much longer to edit.',
      ],
    },
    {
      id: 'ai-edit',
      title: 'AI edit',
      who: 'Claude',
      required: true,
      auto: true,
      panel: 'ai-edit',
      instructions:
        'The AI editor trims dead air, transcribes, cuts you out, plans and adds B-roll, then does captions, motion and sound. It reviews its own work like a director and saves the final MP4, cover frame and project files to the reel folder.',
      doneWhen: 'The final video is in the reel’s final folder.',
      tools: ['drive'],
    },
    {
      id: 'ai-caption',
      title: 'AI caption and hashtags',
      who: 'Claude',
      required: true,
      auto: true,
      panel: 'ai-caption',
      instructions: 'The AI editor writes the Instagram caption and hashtags from the transcript, the business and the tags.',
      doneWhen: 'The caption is ready to copy.',
    },
    {
      id: 'polish',
      title: 'Polish (optional)',
      who: 'You',
      required: false,
      instructions: 'Make any manual fixes or add brand assets.',
      doneWhen: 'Any fixes are done, or you skipped it.',
      tools: ['capcut', 'canva'],
    },
    {
      id: 'phone-check',
      title: 'Phone check',
      who: 'You',
      required: true,
      panel: 'review',
      instructions:
        'Watch it on a phone with sound on and off. Check nothing sits under Instagram’s buttons and the loudness is OK. If something’s wrong, pick notes below and re-run the AI edit.',
      doneWhen: 'It works with sound on and off, and nothing is hidden.',
      prompts: [
        'dn-outline', 'dn-face', 'dn-busy', 'dn-late', 'dn-captions-fast', 'dn-hook', 'dn-brand', 'dn-range',
        'dn-broll-match', 'dn-broll-much', 'dn-broll-hook', 'dn-broll-swap',
      ],
    },
    {
      id: 'post',
      title: 'Post it',
      who: 'You',
      required: true,
      instructions: 'Copy the caption, post the reel on Instagram, then paste the posted URL below.',
      doneWhen: 'The reel is live and its URL is saved here.',
      tools: ['instagram'],
      field: 'postedUrl',
      requiresField: 'postedUrl',
    },
  ],
};
