// Sheet tabs, their headers, and conversion between rows and typed records.
// Rows are read by header name, so columns can be reordered or added in the
// Sheet without breaking the app. Any schema change must bump SCHEMA_VERSION
// and ship a migration (src/data/migrations.ts, Phase 2).

import type { ActivityEntry, Business, ChecklistEntry, Reel, Stage, Tag } from './types';

export const SCHEMA_VERSION = 1;

export const TABS = {
  Reels: [
    'id', 'title', 'business', 'tags', 'stage', 'assignee', 'created_by', 'created_at',
    'updated_at', 'drive_folder_id', 'final_video_link', 'posted_url', 'post_date', 'notes',
  ],
  Checklist: ['reel_id', 'step_id', 'done', 'done_by', 'done_at', 'note'],
  Businesses: ['id', 'name', 'short_code', 'accent_color', 'style_rules_md', 'active'],
  Tags: ['tag', 'color'],
  Activity: ['timestamp', 'user', 'reel_id', 'action', 'detail'],
  Meta: ['key', 'value'],
} as const;

export type TabName = keyof typeof TABS;
export type RowRecord = Record<string, string>;

const STAGES: Stage[] = ['raw', 'working', 'completed'];

function bool(v: string | undefined): boolean {
  return (v ?? '').trim().toUpperCase() === 'TRUE';
}

export function splitTags(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function reelFromRecord(r: RowRecord): Reel {
  const stage = (r.stage ?? '').trim().toLowerCase() as Stage;
  return {
    id: r.id ?? '',
    title: r.title ?? '',
    business: r.business ?? '',
    tags: splitTags(r.tags),
    stage: STAGES.includes(stage) ? stage : 'raw',
    assignee: r.assignee ?? '',
    createdBy: r.created_by ?? '',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
    driveFolderId: r.drive_folder_id ?? '',
    finalVideoLink: r.final_video_link ?? '',
    postedUrl: r.posted_url ?? '',
    postDate: r.post_date ?? '',
    notes: r.notes ?? '',
  };
}

export function reelToRecord(reel: Reel): RowRecord {
  return {
    id: reel.id,
    title: reel.title,
    business: reel.business,
    tags: reel.tags.join(', '),
    stage: reel.stage,
    assignee: reel.assignee,
    created_by: reel.createdBy,
    created_at: reel.createdAt,
    updated_at: reel.updatedAt,
    drive_folder_id: reel.driveFolderId,
    final_video_link: reel.finalVideoLink,
    posted_url: reel.postedUrl,
    post_date: reel.postDate,
    notes: reel.notes,
  };
}

export function checklistFromRecord(r: RowRecord): ChecklistEntry {
  return {
    reelId: r.reel_id ?? '',
    stepId: r.step_id ?? '',
    done: bool(r.done),
    doneBy: r.done_by ?? '',
    doneAt: r.done_at ?? '',
    note: r.note ?? '',
  };
}

export function checklistToRecord(e: ChecklistEntry): RowRecord {
  return {
    reel_id: e.reelId,
    step_id: e.stepId,
    done: e.done ? 'TRUE' : 'FALSE',
    done_by: e.doneBy,
    done_at: e.doneAt,
    note: e.note,
  };
}

export function businessFromRecord(r: RowRecord): Business {
  return {
    id: r.id ?? '',
    name: r.name ?? '',
    shortCode: r.short_code ?? '',
    accentColor: r.accent_color || '#888888',
    styleRulesMd: r.style_rules_md ?? '',
    // Blank counts as active so hand-added rows show up.
    active: (r.active ?? '').trim() === '' || bool(r.active),
  };
}

export function businessToRecord(b: Business): RowRecord {
  return {
    id: b.id,
    name: b.name,
    short_code: b.shortCode,
    accent_color: b.accentColor,
    style_rules_md: b.styleRulesMd,
    active: b.active ? 'TRUE' : 'FALSE',
  };
}

export function tagFromRecord(r: RowRecord): Tag {
  return { tag: r.tag ?? '', color: r.color ?? '' };
}

export function activityToRecord(a: ActivityEntry): RowRecord {
  return { timestamp: a.timestamp, user: a.user, reel_id: a.reelId, action: a.action, detail: a.detail };
}

/** Turn a 2D values array (first row = headers) into records. */
export function rowsToRecords(values: string[][]): { headers: string[]; records: RowRecord[] } {
  const [headerRow = [], ...rows] = values;
  const headers = headerRow.map((h) => h.trim());
  const records = rows.map((row) => {
    const rec: RowRecord = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = row[i] ?? '';
    });
    return rec;
  });
  return { headers, records };
}

/** Build a row in the Sheet's actual header order. Unknown columns are left blank. */
export function recordToRow(headers: string[], record: RowRecord): string[] {
  return headers.map((h) => record[h] ?? '');
}

/**
 * Latest checklist entry per (reel, step). If two people ticked the same step
 * at once there may be duplicate rows; the last row wins.
 */
export function indexChecklist(entries: ChecklistEntry[]): Map<string, Map<string, ChecklistEntry>> {
  const byReel = new Map<string, Map<string, ChecklistEntry>>();
  for (const e of entries) {
    if (!e.reelId || !e.stepId) continue;
    let m = byReel.get(e.reelId);
    if (!m) byReel.set(e.reelId, (m = new Map()));
    m.set(e.stepId, e);
  }
  return byReel;
}
