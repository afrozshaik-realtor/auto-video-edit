export type Stage = 'raw' | 'working' | 'completed';

/** Where the automated AI edit is for a reel. Empty means it hasn't been picked up yet. */
export type AiStatus = '' | 'queued' | 'running' | 'done' | 'failed';

export interface Reel {
  id: string;
  title: string;
  business: string; // Business id
  tags: string[];
  stage: Stage;
  assignee: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  driveFolderId: string;
  finalVideoLink: string;
  postedUrl: string;
  postDate: string;
  notes: string;
  aiStatus: AiStatus;
  /** What the AI editor is doing now, or why it failed. */
  aiDetail: string;
  aiUpdatedAt: string;
  /** How many AI edits have finished for this reel. */
  aiRuns: number;
  /** Notes for the next AI edit (a re-run). */
  aiNotes: string;
  /** Instagram caption and hashtags written by the AI. */
  caption: string;
  /** Drive link to the latest AI thumbnail. */
  thumbnailLink: string;
  thumbStatus: AiStatus;
  thumbDetail: string;
  /** The image prompt Claude wrote for the latest thumbnail. */
  thumbPrompt: string;
  /** Notes for the next thumbnail (a redo). */
  thumbNotes: string;
}

export interface ChecklistEntry {
  reelId: string;
  stepId: string;
  done: boolean;
  doneBy: string;
  doneAt: string;
  note: string;
}

export interface Business {
  id: string;
  name: string;
  shortCode: string;
  accentColor: string;
  styleRulesMd: string;
  active: boolean;
}

export interface Tag {
  tag: string;
  color: string;
}

export interface ActivityEntry {
  timestamp: string;
  user: string;
  reelId: string;
  action: string;
  detail: string;
}

/** Checklist entries for one reel, keyed by step id. */
export type ReelChecklist = Map<string, ChecklistEntry>;
