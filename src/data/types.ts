export type Stage = 'raw' | 'working' | 'completed';

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
