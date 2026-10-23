// Reel Studio's data operations. UI code calls these; only these touch
// src/services/google, so storage could move to another backend later.

import { appConfig, type AppIds } from '../config/app.config';
import { REEL_SUBFOLDERS } from '../config/defaults';
import { workflow } from '../config/workflow';
import * as drive from '../services/google/drive';
import * as sheets from '../services/google/sheets';
import { reelFolderName, newReelId, localDate } from './naming';
import {
  TABS,
  activityToRecord,
  businessFromRecord,
  checklistFromRecord,
  checklistToRecord,
  indexChecklist,
  recordToRow,
  reelFromRecord,
  reelToRecord,
  rowsToRecords,
  tagFromRecord,
  type TabName,
} from './schema';
import { autoStageAfterStep } from './stage';
import type { Business, ChecklistEntry, Reel, ReelChecklist, Stage, Tag } from './types';

const LOCAL_IDS_KEY = 'reel-studio.ids';

// ---------- IDs ----------

/** IDs from app.config.ts, or (before they're pasted in) the ones saved on this device by setup. */
export function getIds(): AppIds | null {
  const c = appConfig;
  // The dev-only fake Google (?mock) has its own sheet, so skip the real IDs there.
  // (import.meta.env is undefined when the automation job imports this under Node.)
  const mock = import.meta.env?.DEV && (window as { __reelStudioMock?: boolean }).__reelStudioMock;
  if (!mock && c.sheetId && c.driveFolders.raw && c.driveFolders.working && c.driveFolders.completed) {
    return { sheetId: c.sheetId, driveFolders: { ...c.driveFolders } };
  }
  try {
    const raw = localStorage.getItem(LOCAL_IDS_KEY);
    return raw ? (JSON.parse(raw) as AppIds) : null;
  } catch {
    return null;
  }
}

export function idsFromConfig(): boolean {
  return Boolean(appConfig.sheetId);
}

export function saveLocalIds(ids: AppIds) {
  try {
    localStorage.setItem(LOCAL_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore: the owner can still paste the IDs into app.config.ts.
  }
}

export function forgetLocalIds() {
  try {
    localStorage.removeItem(LOCAL_IDS_KEY);
  } catch {
    // Ignore.
  }
}

// ---------- Loading ----------

export interface AppData {
  reels: Reel[];
  checklists: Map<string, ReelChecklist>;
  businesses: Business[];
  tags: Tag[];
  schemaVersion: number;
}

export async function loadAll(ids: AppIds): Promise<AppData> {
  const tabs = await sheets.readTabs(ids.sheetId, ['Reels', 'Checklist', 'Businesses', 'Tags', 'Meta']);
  const reels = rowsToRecords(tabs.Reels).records.map(reelFromRecord).filter((r) => r.id);
  const checklists = indexChecklist(rowsToRecords(tabs.Checklist).records.map(checklistFromRecord));
  const businesses = rowsToRecords(tabs.Businesses).records.map(businessFromRecord).filter((b) => b.id);
  const tags = rowsToRecords(tabs.Tags).records.map(tagFromRecord).filter((t) => t.tag);
  const meta = rowsToRecords(tabs.Meta).records;
  const schemaVersion = Number(meta.find((m) => m.key === 'schema_version')?.value ?? 0);
  return { reels, checklists, businesses, tags, schemaVersion };
}

// ---------- Helpers ----------

async function readTable(ids: AppIds, tab: TabName) {
  const values = await sheets.readTab(ids.sheetId, tab);
  const { headers, records } = rowsToRecords(values);
  return { headers: headers.length ? headers : [...TABS[tab]], records };
}

async function appendRecord(ids: AppIds, tab: TabName, headers: string[] | null, record: Record<string, string>) {
  const h = headers ?? (await readTable(ids, tab)).headers;
  await sheets.appendRows(ids.sheetId, tab, [recordToRow(h, record)]);
}

export async function logActivity(ids: AppIds, user: string, reelId: string, action: string, detail = '') {
  try {
    await appendRecord(ids, 'Activity', [...TABS.Activity], activityToRecord({
      timestamp: new Date().toISOString(),
      user,
      reelId,
      action,
      detail,
    }));
  } catch (e) {
    // The activity log must never block real work.
    console.warn('Activity log failed', e);
  }
}

// ---------- Reels ----------

export interface NewReelInput {
  title: string;
  business: Business;
  tags: string[];
  assignee: string;
}

export async function createReel(ids: AppIds, user: string, input: NewReelInput, knownTags: Tag[]): Promise<Reel> {
  const now = new Date();
  const folder = await drive.createFolder(reelFolderName(now, input.business.shortCode, input.title), ids.driveFolders.raw);
  for (const sub of REEL_SUBFOLDERS) await drive.createFolder(sub, folder.id);

  const iso = now.toISOString();
  const reel: Reel = {
    id: newReelId(now),
    title: input.title.trim(),
    business: input.business.id,
    tags: input.tags,
    stage: 'raw',
    assignee: input.assignee.trim(),
    createdBy: user,
    createdAt: iso,
    updatedAt: iso,
    driveFolderId: folder.id,
    finalVideoLink: '',
    postedUrl: '',
    postDate: '',
    notes: '',
    aiStatus: '',
    aiDetail: '',
    aiUpdatedAt: '',
    aiRuns: 0,
    aiNotes: '',
    caption: '',
  };
  await appendRecord(ids, 'Reels', null, reelToRecord(reel));

  const known = new Set(knownTags.map((t) => t.tag.toLowerCase()));
  const fresh = input.tags.filter((t) => !known.has(t.toLowerCase()));
  if (fresh.length) await sheets.appendRows(ids.sheetId, 'Tags', fresh.map((t) => [t, '']));

  await logActivity(ids, user, reel.id, 'created', reel.title);
  return reel;
}

export type ReelPatch = Partial<
  Pick<
    Reel,
    | 'title' | 'tags' | 'stage' | 'assignee' | 'finalVideoLink' | 'postedUrl' | 'postDate' | 'notes'
    | 'aiStatus' | 'aiDetail' | 'aiUpdatedAt' | 'aiRuns' | 'aiNotes' | 'caption'
  >
>;

/** Update a reel's row. Re-reads the tab first so other people's edits to other reels are never overwritten. */
export async function updateReel(ids: AppIds, reelId: string, patch: ReelPatch): Promise<Reel> {
  const { headers, records } = await readTable(ids, 'Reels');
  const index = records.findIndex((r) => r.id === reelId);
  if (index < 0) throw new Error('This reel isn’t in the Reel Tracker sheet any more.');
  const existing = records[index];
  const merged: Reel = { ...reelFromRecord(existing), ...patch, updatedAt: new Date().toISOString() };
  await sheets.updateRow(ids.sheetId, 'Reels', index + 2, recordToRow(headers, { ...existing, ...reelToRecord(merged) }));
  return merged;
}

/** Move the reel's Drive folder to the stage's folder, then record the new stage. */
export async function moveReel(ids: AppIds, user: string, reel: Reel, to: Stage, extra: ReelPatch = {}): Promise<Reel> {
  if (!reel.driveFolderId) throw new Error('This reel has no Drive folder id in the sheet.');
  await drive.moveTo(reel.driveFolderId, ids.driveFolders[to]);
  const updated = await updateReel(ids, reel.id, { ...extra, stage: to });
  await logActivity(ids, user, reel.id, 'moved', `${reel.stage} → ${to}`);
  return updated;
}

export async function completeReel(ids: AppIds, user: string, reel: Reel): Promise<Reel> {
  return moveReel(ids, user, reel, 'completed', { postDate: reel.postDate || localDate() });
}

/**
 * Ask the AI editor to (re-)run on this reel. The GitHub Actions job picks
 * queued reels up on its next check. Notes are added to the edit prompt.
 */
export async function queueAiEdit(ids: AppIds, user: string, reel: Reel, notes: string): Promise<Reel> {
  const updated = await updateReel(ids, reel.id, {
    aiStatus: 'queued',
    aiNotes: notes.trim(),
    aiDetail: 'Waiting for the AI editor to start',
    aiUpdatedAt: new Date().toISOString(),
  });
  await logActivity(ids, user, reel.id, 'AI edit queued', notes.trim() ? 'with notes' : '');
  return updated;
}

// ---------- Checklist ----------

/** Insert or update the checklist row for one step. */
export async function saveStep(
  ids: AppIds,
  reelId: string,
  stepId: string,
  update: Partial<Pick<ChecklistEntry, 'done' | 'note'>>,
  user: string,
): Promise<ChecklistEntry> {
  const { headers, records } = await readTable(ids, 'Checklist');
  let index = -1;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].reel_id === reelId && records[i].step_id === stepId) {
      index = i;
      break;
    }
  }
  const prev: ChecklistEntry =
    index >= 0
      ? checklistFromRecord(records[index])
      : { reelId, stepId, done: false, doneBy: '', doneAt: '', note: '' };
  const next: ChecklistEntry = { ...prev, ...update };
  if (update.done !== undefined && update.done !== prev.done) {
    next.doneBy = update.done ? user : '';
    next.doneAt = update.done ? new Date().toISOString() : '';
  }
  const record = { ...(index >= 0 ? records[index] : {}), ...checklistToRecord(next) };
  if (index >= 0) await sheets.updateRow(ids.sheetId, 'Checklist', index + 2, recordToRow(headers, record));
  else await sheets.appendRows(ids.sheetId, 'Checklist', [recordToRow(headers, record)]);
  return next;
}

/**
 * Tick or untick a step, applying automatic stage moves
 * (see autoStageAfterStep).
 */
export async function setStepDone(
  ids: AppIds,
  user: string,
  reel: Reel,
  stepId: string,
  done: boolean,
): Promise<{ entry: ChecklistEntry; reel: Reel }> {
  const entry = await saveStep(ids, reel.id, stepId, { done }, user);
  await logActivity(ids, user, reel.id, done ? 'step done' : 'step undone', stepId);
  const to = autoStageAfterStep(workflow, reel.stage, stepId, done);
  const updated = to ? await moveReel(ids, user, reel, to) : reel;
  return { entry, reel: updated };
}
