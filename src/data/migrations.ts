// Sheet migrations, keyed by the schema version they upgrade to.
// The app runs them on load when the sheet's Meta.schema_version is behind
// SCHEMA_VERSION; the first person with edit access applies them. Each
// migration must be safe to run twice (two people may load at once).

import type { AppIds } from '../config/app.config';
import * as sheets from '../services/google/sheets';
import { SCHEMA_VERSION, TABS, type TabName } from './schema';

interface Migration {
  description: string;
  run: (ids: AppIds) => Promise<void>;
}

/** Headers in `wanted` that the sheet's header row doesn't have yet, in order. */
export function missingHeaders(current: string[], wanted: readonly string[]): string[] {
  const have = new Set(current.map((h) => h.trim()));
  return wanted.filter((h) => !have.has(h));
}

/** Add any missing columns to the end of a tab's header row. Existing columns are never moved. */
async function addMissingColumns(ids: AppIds, tab: TabName) {
  const [header = []] = await sheets.readTab(ids.sheetId, tab);
  const add = missingHeaders(header, TABS[tab]);
  if (!add.length) return;
  const startCol = sheets.columnLetter(header.length + 1);
  await sheets.batchWrite(ids.sheetId, [{ range: `${tab}!${startCol}1`, values: [add] }]);
}

export const MIGRATIONS: Record<number, Migration> = {
  2: {
    description: 'Add AI edit columns to Reels',
    run: (ids) => addMissingColumns(ids, 'Reels'),
  },
  3: {
    description: 'Add AI thumbnail columns to Reels',
    run: (ids) => addMissingColumns(ids, 'Reels'),
  },
};

async function setSchemaVersion(ids: AppIds, version: number) {
  const rows = await sheets.readTab(ids.sheetId, 'Meta');
  const index = rows.findIndex((r, i) => i > 0 && r[0] === 'schema_version');
  if (index > 0) await sheets.updateRow(ids.sheetId, 'Meta', index + 1, ['schema_version', String(version)]);
  else await sheets.appendRows(ids.sheetId, 'Meta', [['schema_version', String(version)]]);
}

/** Run every migration after `fromVersion`. Returns the version the sheet is now at. */
export async function runMigrations(ids: AppIds, fromVersion: number): Promise<number> {
  let version = fromVersion;
  for (let v = fromVersion + 1; v <= SCHEMA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (m) await m.run(ids);
    await setSchemaVersion(ids, v);
    version = v;
  }
  return version;
}
