// The guided checklist. Steps are data: add, reorder or edit them here
// without touching UI code. Bump WORKFLOW_VERSION when steps change.
// Step ids are stored in the Sheet, so never rename an existing id.

export type Who = 'Claude' | 'You' | 'Both';

export interface WorkflowStep {
  id: string;
  title: string;
  who: Who;
  required: boolean;
  instructions: string;
  doneWhen: string;
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

const SAVE_TIP =
  'Ask Claude to save key files to its outputs folder after each pass. The sandbox can reset during long gaps. Download them and add them to the reel’s project folder.';

export const workflow: Workflow = {
  // v2: added the B-roll steps after Pass 02.
  version: 2,
  startsEditingStepId: 'setup',
  steps: [
    {
      id: 'shoot',
      title: 'Shoot the clip',
      who: 'You',
      required: true,
      instructions: 'Leave headroom above your head, use a clean background, and record clear audio.',
      doneWhen: 'You have a take you’re happy with.',
    },
    {
      id: 'trim',
      title: 'Trim dead air and export',
      who: 'You',
      required: true,
      instructions: 'Cut the dead air at the start and end. Export at 1080p, under 30 MB.',
      doneWhen: 'You have a 1080p file under 30 MB.',
      tools: ['capcut'],
    },
    {
      id: 'upload',
      title: 'Upload the raw clip',
      who: 'You',
      required: true,
      instructions: 'Upload the exported clip to the raw folder inside this reel’s Drive folder.',
      doneWhen: 'The clip is in the reel’s raw folder.',
      tools: ['drive'],
    },
    {
      id: 'setup',
      title: 'Set up the Claude chat',
      who: 'Both',
      required: true,
      instructions:
        'Start a new Claude chat with Opus 5.5 and code execution on. Upload the clip, then paste the setup prompt. It already includes this business’s style rules. Ticking this step moves the reel to Working.',
      doneWhen: 'Claude has confirmed the clip’s length, resolution and frame rate.',
      prompts: ['setup'],
      tools: ['claude'],
      stuck: [SAVE_TIP],
    },
    {
      id: 'pass-01',
      title: 'Pass 01: transcribe',
      who: 'Both',
      required: true,
      instructions: 'Run Pass 01. Fix any misheard words in the table, then ask Claude to tighten the cut.',
      doneWhen: 'The transcript is correct and the cut is tight.',
      prompts: ['pass-01', 'tighten'],
      tools: ['claude'],
      stuck: [
        'If a speech model won’t download, ask Claude to use a Whisper or Parakeet model from the sherpa-onnx GitHub releases.',
        SAVE_TIP,
      ],
    },
    {
      id: 'pass-02',
      title: 'Pass 02: cut-out',
      who: 'Both',
      required: true,
      instructions: 'Run Pass 02. Check the hair edges: no outline and no holes.',
      doneWhen: 'The cut-out looks clean on all three check frames.',
      prompts: ['pass-02'],
      tools: ['claude'],
      stuck: [
        'Rough edges? Ask Claude to use RobustVideoMatting (ONNX) from its GitHub releases. The sandbox is CPU-only, so ask it to process frames in chunks and keep clips under about 30 seconds.',
        SAVE_TIP,
      ],
    },
    {
      id: 'broll-plan',
      title: 'B-roll: plan and gather shots',
      who: 'Both',
      required: true,
      instructions:
        'Ask Claude for a B-roll shot list matched to your words. Approve it, then gather the shots it marks as stock or your own footage. Put them in the reel’s broll folder and upload them to the Claude chat. Claude builds the graphic shots itself.',
      doneWhen: 'The shot list is approved and every stock or own-footage clip is uploaded to the chat.',
      prompts: ['broll-plan'],
      tools: ['claude', 'pexels', 'pixabay', 'canva', 'drive'],
      stuck: [
        'Search stock sites in portrait (vertical) orientation and download 1080p, not 4K. Trim each clip to under 6 seconds so uploads stay small.',
        'Claude’s sandbox usually can’t download from stock sites, so download the clips yourself and upload them to the chat.',
        'Reels created before B-roll was added have no broll folder. Make one inside the reel folder in Drive.',
        SAVE_TIP,
      ],
    },
    {
      id: 'broll-mix',
      title: 'B-roll: build and mix',
      who: 'Both',
      required: true,
      instructions:
        'Have Claude build the graphic shots and cut all the B-roll in on its trigger words. Watch it through and check each shot matches what you’re saying.',
      doneWhen: 'Every shot lands on its word, the hook stays on your face, and B-roll is under 40% of the reel.',
      prompts: ['broll-mix'],
      tools: ['claude'],
      stuck: [
        'If rendering is slow, ask Claude to build and check one shot at a time, then join them.',
        SAVE_TIP,
      ],
    },
    {
      id: 'pass-03',
      title: 'Pass 03: captions',
      who: 'Both',
      required: true,
      instructions: 'Run Pass 03 and approve the key words before Claude renders.',
      doneWhen: 'You’ve approved the key words and the captions are rendered.',
      prompts: ['pass-03'],
      tools: ['claude'],
      stuck: [SAVE_TIP],
    },
    {
      id: 'pass-04',
      title: 'Pass 04: motion',
      who: 'Both',
      required: true,
      instructions: 'Run Pass 04. Read the scene plan and approve it before Claude builds anything.',
      doneWhen: 'The approved scene plan is built.',
      prompts: ['pass-04'],
      tools: ['claude'],
      stuck: [SAVE_TIP],
    },
    {
      id: 'pass-05',
      title: 'Pass 05: sound',
      who: 'Both',
      required: true,
      instructions: 'Run Pass 05, then listen on a phone, not just on a laptop.',
      doneWhen: 'It sounds right on a phone speaker.',
      prompts: ['pass-05'],
      tools: ['claude'],
      stuck: [SAVE_TIP],
    },
    {
      id: 'direct',
      title: 'Direct the edit',
      who: 'Both',
      required: true,
      instructions: 'Watch the render and send notes until it’s right. Tap a note to copy it, fill in any [brackets], and paste it into Claude.',
      doneWhen: 'You’d post it as it is.',
      prompts: [
        'dn-outline', 'dn-face', 'dn-busy', 'dn-late', 'dn-captions-fast', 'dn-hook', 'dn-brand', 'dn-range',
        'dn-broll-match', 'dn-broll-much', 'dn-broll-hook', 'dn-broll-swap',
      ],
      tools: ['claude'],
    },
    {
      id: 'save',
      title: 'Save the final files',
      who: 'You',
      required: true,
      instructions: 'Ask Claude to save the outputs. Put the final MP4 and cover frame in the reel’s final folder, and the project files in its project folder. Paste the final video link below.',
      doneWhen: 'The final MP4, cover frame and project files are in the reel folder.',
      prompts: ['save-outputs'],
      tools: ['drive'],
      field: 'finalVideoLink',
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
      instructions: 'Watch it on a phone with sound on and off. Check nothing sits under Instagram’s buttons and the loudness is OK.',
      doneWhen: 'It works with sound on and off, and nothing is hidden.',
    },
    {
      id: 'caption',
      title: 'Write the caption and hashtags',
      who: 'Both',
      required: true,
      instructions: 'Copy the caption prompt into ChatGPT or Claude and pick the best option.',
      doneWhen: 'The caption and hashtags are ready to paste.',
      prompts: ['caption'],
      tools: ['chatgpt', 'claude'],
    },
    {
      id: 'post',
      title: 'Post it',
      who: 'You',
      required: true,
      instructions: 'Post the reel on Instagram, then paste the posted URL below.',
      doneWhen: 'The reel is live and its URL is saved here.',
      tools: ['instagram'],
      field: 'postedUrl',
      requiresField: 'postedUrl',
    },
  ],
};
