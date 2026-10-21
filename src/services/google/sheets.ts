// Google Sheets v4, kept generic: tabs of string rows. Domain logic lives in src/data.
// Values are written RAW so text like "=SUM(...)" in a title is never run as a formula.

import { googleFetch, qs } from './http';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ValueRange {
  range: string;
  values?: string[][];
}

/** A1 column letter for a 1-based column number (1 → A, 27 → AA). */
export function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Read whole tabs. Returns rows (header row first) per tab name. */
export async function readTabs(spreadsheetId: string, tabs: string[]): Promise<Record<string, string[][]>> {
  const params = new URLSearchParams();
  for (const t of tabs) params.append('ranges', t);
  params.set('valueRenderOption', 'FORMATTED_VALUE');
  const data = await googleFetch<{ valueRanges: ValueRange[] }>(
    `${API}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`,
  );
  const out: Record<string, string[][]> = {};
  tabs.forEach((t, i) => (out[t] = (data.valueRanges[i]?.values ?? []).map((r) => r.map(String))));
  return out;
}

export async function readTab(spreadsheetId: string, tab: string): Promise<string[][]> {
  return (await readTabs(spreadsheetId, [tab]))[tab];
}

export async function appendRows(spreadsheetId: string, tab: string, rows: string[][]): Promise<void> {
  await googleFetch(
    `${API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(tab)}:append${qs({
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
    })}`,
    { method: 'POST', body: JSON.stringify({ values: rows }) },
  );
}

/** Overwrite one row. rowNumber is 1-based (row 1 is the header). */
export async function updateRow(spreadsheetId: string, tab: string, rowNumber: number, row: string[]): Promise<void> {
  const range = `${tab}!A${rowNumber}:${columnLetter(row.length)}${rowNumber}`;
  await googleFetch(
    `${API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${qs({ valueInputOption: 'RAW' })}`,
    { method: 'PUT', body: JSON.stringify({ values: [row] }) },
  );
}

export async function batchWrite(spreadsheetId: string, data: { range: string; values: string[][] }[]): Promise<void> {
  await googleFetch(`${API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}

/** Create a spreadsheet with the given tabs (first row frozen on each). */
export async function createSpreadsheet(title: string, tabs: string[]): Promise<{ spreadsheetId: string }> {
  return googleFetch<{ spreadsheetId: string }>(`${API}${qs({ fields: 'spreadsheetId' })}`, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: tabs.map((t) => ({ properties: { title: t, gridProperties: { frozenRowCount: 1 } } })),
    }),
  });
}
