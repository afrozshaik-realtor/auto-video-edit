// The guided checklist. Steps are data: add, reorder or edit them here
// without touching UI code. Bump WORKFLOW_VERSION when steps change.
// Step ids are stored in the Sheet, so never rename an existing id.

import type { Stage } from '../data/types';

export type Who = 'Claude' | 'You' | 'Both';

/** Special content shown inside a step, driven by the reel's AI status. */
export type StepPanel = 'ai-edit' | 'ai-caption' | 'ai-thumbnail' | 'review';

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
  /** Checklists a person works through before marking the step done (not saved). */
  checklists?: { title: string; items: string[] }[];
  /** Where the step's output file goes: a subfolder of the reel and a file name ({{slug}} = reel slug). */
  saveTo?: { folder: string; fileName: string };
}

export interface StageMove {
  /** Ticking this step done… */
  stepId: string;
  /** …on a reel in one of these stages… */
  from: Stage[];
  /** …moves its folder to this stage. */
  to: Stage;
}

export interface Workflow {
  version: number;
  /** Automatic stage moves when a step is ticked. (The AI editor also moves reels to Working when it starts.) */
  stageMoves: StageMove[];
  /** Ticking this step again after the AI edit asked for a re-trim restarts the AI edit. */
  retrimStepId: string;
  steps: WorkflowStep[];
}

export const AI_EDITOR_NAME = 'Reel Studio AI';

export const workflow: Workflow = {
  // v1: 15 steps, each kit pass ticked by hand. v2: added two B-roll steps.
  // v3: the AI editor runs every pass (trim to save) and the caption automatically.
  // v4: added the AI thumbnail (Claude writes the prompt, OpenAI's image model draws it).
  // v5: trimming is done by hand (Manual trim step, Trimmed stage); the AI never cuts footage.
  version: 5,
  stageMoves: [
    { stepId: 'manual-trim', from: ['raw'], to: 'trimmed' },
    { stepId: 'ai-edit', from: ['raw', 'trimmed'], to: 'working' },
  ],
  retrimStepId: 'manual-trim',
  steps: [
    {
      id: 'shoot',
      title: 'Film the clip',
      who: 'You',
      required: true,
      instructions: 'Leave headroom above your head, use a clean background, and record clear audio.',
      doneWhen: 'You have a take you’re happy with.',
    },
    {
      id: 'upload',
      title: 'Upload the raw clip',
      who: 'You',
      required: true,
      instructions:
        'Upload the untouched clip to the raw folder inside this reel’s Drive folder. Put any footage of your own for B-roll in its broll folder.',
      doneWhen: 'The original clip is in the reel’s raw folder.',
      tools: ['drive'],
    },
    {
      id: 'manual-trim',
      title: 'Manual trim',
      who: 'You',
      required: true,
      instructions:
        'Trim the clip yourself in CapCut or any editor, then export it to the reel’s trimmed folder. Marking this done moves the reel to Trimmed, and the AI edit starts on your trimmed clip, usually within 15 minutes. The AI never cuts footage.',
      doneWhen: 'The trimmed export is in the reel’s trimmed folder.',
      tools: ['capcut', 'drive'],
      checklists: [
        {
          title: 'Trim',
          items: [
            'Cut filler words, false starts, repeated takes and dead air. Cut on the silence or breath between words, never inside a word.',
            'Keep about 0.15–0.25 s of natural pause between sentences and keep the breaths, so it doesn’t sound robotic.',
            'Leave about 0.3 s of quiet at the very end (room for the closing chime).',
            'Hard cuts only. No transitions at jump cuts; the Motion pass hides them with punch-ins.',
          ],
        },
        {
          title: 'Export settings',
          items: [
            'Native vertical 1080x1920 (or 4K vertical) from the original clip. Never vertical video inside a 16:9 frame with black bars.',
            'Constant 30 fps, highest quality.',
            'No captions, music, zooms, filters, colour grading, noise reduction or volume levelling. Audio gets mastered in Pass 05.',
          ],
        },
      ],
      saveTo: { folder: 'trimmed', fileName: '{{slug}}_trimmed.mp4' },
      stuck: [
        'Put one video only in the trimmed folder. If there are several, the AI uses the newest one.',
        'Keep it under about 2 minutes. Longer clips take much longer to edit.',
        'If the AI edit stops with “Needs a re-trim”, fix the listed timecodes, export again to the trimmed folder, and mark this step done again.',
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
        'The AI editor works on your trimmed clip as it is: it transcribes, cuts you out from the background, adds captions, plans and mixes B-roll, then does motion and sound. It reviews its own work like a director and saves the final MP4, cover frame and project files to the reel folder. If it finds a cut inside a word or breath, it stops and asks for a re-trim.',
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
      id: 'ai-thumbnail',
      title: 'AI thumbnail',
      who: 'Claude',
      required: true,
      auto: true,
      panel: 'ai-thumbnail',
      instructions:
        'Claude picks the best frame of you and writes the image prompt, then ChatGPT’s image model makes a 9:16 cover with a short headline in the brand colours. It’s saved to the reel’s final folder.',
      doneWhen: 'The thumbnail is in the final folder and you’re happy with it.',
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
      instructions:
        'Copy the caption, post the reel on Instagram with the thumbnail as its cover, then paste the posted URL below.',
      doneWhen: 'The reel is live and its URL is saved here.',
      tools: ['instagram'],
      field: 'postedUrl',
      requiresField: 'postedUrl',
    },
  ],
};
