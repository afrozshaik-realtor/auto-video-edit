// First-run setup: create the Drive folder tree and the Reel Tracker sheet.

import type { AppIds } from '../config/app.config';
import { DRIVE_FOLDER_NAMES, SEED_BUSINESSES, SHEET_TITLE } from '../config/defaults';
import * as drive from '../services/google/drive';
import * as sheets from '../services/google/sheets';
import { SCHEMA_VERSION, TABS, businessToRecord, recordToRow, type TabName } from './schema';

export type SetupStep = 'folders' | 'sheet' | 'seed' | 'file';

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  folders: 'Create the Reels folders in your Drive',
  sheet: 'Create the Reel Tracker sheet',
  seed: 'Add tab headers and the three businesses',
  file: 'Put the sheet inside the Reels folder',
};

export async function runSetup(onStep: (step: SetupStep) => void): Promise<AppIds> {
  onStep('folders');
  const root = await drive.createFolder(DRIVE_FOLDER_NAMES.root);
  const raw = await drive.createFolder(DRIVE_FOLDER_NAMES.raw, root.id);
  const working = await drive.createFolder(DRIVE_FOLDER_NAMES.working, root.id);
  const completed = await drive.createFolder(DRIVE_FOLDER_NAMES.completed, root.id);

  onStep('sheet');
  const tabNames = Object.keys(TABS) as TabName[];
  const { spreadsheetId } = await sheets.createSpreadsheet(SHEET_TITLE, tabNames);

  onStep('seed');
  const headerWrites = tabNames.map((t) => ({ range: `${t}!A1`, values: [[...TABS[t]]] }));
  const businessRows = SEED_BUSINESSES.map((b) => recordToRow([...TABS.Businesses], businessToRecord(b)));
  await sheets.batchWrite(spreadsheetId, [
    ...headerWrites,
    { range: 'Businesses!A2', values: businessRows },
    { range: 'Meta!A2', values: [['schema_version', String(SCHEMA_VERSION)]] },
  ]);

  // Keeping the sheet in the Reels folder means sharing that one folder shares everything.
  onStep('file');
  await drive.moveTo(spreadsheetId, root.id);

  return {
    sheetId: spreadsheetId,
    driveFolders: { root: root.id, raw: raw.id, working: working.id, completed: completed.id },
  };
}
