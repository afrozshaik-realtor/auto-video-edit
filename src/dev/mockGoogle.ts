// DEV ONLY. An in-memory fake of Google sign-in, Drive v3 and Sheets v4,
// enough to exercise the real app code end to end without a Google account.
// State is kept in localStorage so two tabs share it, like two teammates.
//
//   http://localhost:5173/?mock            empty Drive: start at first-run setup
//   http://localhost:5173/?mock&seed       pre-filled demo reels
//   ...&user=sam                           sign in as a different teammate
//   ...&reset                              wipe the fake Drive

import { DRIVE_FOLDER_NAMES, REEL_SUBFOLDERS, SEED_BUSINESSES } from '../config/defaults';
import { workflow } from '../config/workflow';
import { SCHEMA_VERSION, TABS, businessToRecord, recordToRow } from '../data/schema';

const STORE_KEY = 'reel-studio.mock-store';
const IDS_KEY = 'reel-studio.ids';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

interface MockFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}
interface Store {
  files: Record<string, MockFile>;
  sheets: Record<string, Record<string, string[][]>>;
  seq: number;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // fall through
  }
  return { files: {}, sheets: {}, seq: 1 };
}
function save(s: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}
function newId(s: Store, prefix: string) {
  return `${prefix}${(s.seq++).toString(36).padStart(4, '0')}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function err(status: number, message: string): Response {
  return json({ error: { code: status, message } }, status);
}

function parseA1(range: string): { tab: string; row: number } {
  const [tab, cells = 'A1'] = decodeURIComponent(range).split('!');
  const m = /^[A-Z]+(\d+)/.exec(cells);
  return { tab, row: m ? Number(m[1]) : 1 };
}

function writeAt(grid: string[][], startRow: number, values: string[][]) {
  values.forEach((row, i) => {
    grid[startRow - 1 + i] = [...row];
  });
  for (let i = 0; i < grid.length; i++) grid[i] ??= [];
}

function handle(method: string, url: URL, body: unknown, user: { email: string; name: string }): Response {
  const s = load();
  const p = url.pathname;

  // ----- Drive -----
  if (p === '/drive/v3/about') return json({ user: { emailAddress: user.email, displayName: user.name } });
  if (p === '/drive/v3/files' && method === 'POST') {
    const b = body as { name: string; mimeType: string; parents?: string[] };
    const f: MockFile = { id: newId(s, 'fld_'), name: b.name, mimeType: b.mimeType, parents: b.parents ?? ['root'] };
    s.files[f.id] = f;
    save(s);
    return json(f);
  }
  const fm = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
  if (fm) {
    const f = s.files[decodeURIComponent(fm[1])];
    if (!f) return err(404, 'File not found.');
    if (method === 'PATCH') {
      const add = url.searchParams.get('addParents');
      const remove = (url.searchParams.get('removeParents') ?? '').split(',').filter(Boolean);
      f.parents = f.parents.filter((x) => !remove.includes(x));
      if (add && !f.parents.includes(add)) f.parents.push(add);
      if (f.parents.length > 1) return err(403, 'Increasing the number of parents is not allowed.');
      save(s);
    }
    return json(f);
  }

  // ----- Sheets -----
  if (p === '/v4/spreadsheets' && method === 'POST') {
    const b = body as { properties: { title: string }; sheets: { properties: { title: string } }[] };
    const id = newId(s, 'sht_');
    s.sheets[id] = Object.fromEntries(b.sheets.map((t) => [t.properties.title, []]));
    s.files[id] = { id, name: b.properties.title, mimeType: 'application/vnd.google-apps.spreadsheet', parents: ['root'] };
    save(s);
    return json({ spreadsheetId: id });
  }
  const sm = /^\/v4\/spreadsheets\/([^/]+)\/values(?::(batchGet|batchUpdate)|\/(.+))?$/.exec(p);
  if (sm) {
    const book = s.sheets[decodeURIComponent(sm[1])];
    if (!book) return err(404, 'Requested entity was not found.');
    const op = sm[2];
    const rest = sm[3] ? decodeURIComponent(sm[3]) : '';
    if (op === 'batchGet') {
      const ranges = url.searchParams.getAll('ranges');
      return json({ valueRanges: ranges.map((r) => ({ range: r, values: book[r] ?? [] })) });
    }
    if (op === 'batchUpdate') {
      for (const d of (body as { data: { range: string; values: string[][] }[] }).data) {
        const { tab, row } = parseA1(d.range);
        writeAt((book[tab] ??= []), row, d.values);
      }
      save(s);
      return json({});
    }
    if (rest.endsWith(':append')) {
      const tab = rest.slice(0, -':append'.length);
      (book[tab] ??= []).push(...(body as { values: string[][] }).values);
      save(s);
      return json({});
    }
    if (method === 'PUT') {
      const { tab, row } = parseA1(rest);
      writeAt((book[tab] ??= []), row, (body as { values: string[][] }).values);
      save(s);
      return json({});
    }
  }
  return err(400, `Mock doesn’t handle ${method} ${p}`);
}

function seed() {
  localStorage.removeItem(STORE_KEY);
  const s = load();
  const mk = (name: string, parent: string) => {
    const f: MockFile = { id: newId(s, 'fld_'), name, mimeType: FOLDER_MIME, parents: [parent] };
    s.files[f.id] = f;
    return f.id;
  };
  const root = mk(DRIVE_FOLDER_NAMES.root, 'root');
  const folders = {
    root,
    raw: mk(DRIVE_FOLDER_NAMES.raw, root),
    working: mk(DRIVE_FOLDER_NAMES.working, root),
    completed: mk(DRIVE_FOLDER_NAMES.completed, root),
  };
  const sheetId = newId(s, 'sht_');
  const reels: string[][] = [[...TABS.Reels]];
  const checklist: string[][] = [[...TABS.Checklist]];
  const demo: [string, string, string, 'raw' | 'working' | 'completed', string, number][] = [
    ['First-time buyer mistakes', 'tce', 'buyers, tips', 'raw', 'afroz@example.com', 2],
    ['Is your basement legal? Permits 101', 'amb', 'permits, basements', 'raw', 'sam@example.com', 0],
    ['Phishing red flags in 30 seconds', 'drc', 'email, tips', 'working', 'sam@example.com', 7],
    ['Walkout basement before and after', 'amb', 'basements, before-after', 'working', 'afroz@example.com', 11],
    ['What closing costs really include', 'tce', 'buyers, money', 'working', 'afroz@example.com', 4],
    ['Password managers explained', 'drc', 'passwords, tips', 'completed', 'sam@example.com', workflow.steps.length],
    ['Pre-approval vs pre-qualification', 'tce', 'buyers, money', 'completed', 'afroz@example.com', workflow.steps.length],
  ];
  demo.forEach(([title, biz, tags, stage, assignee, doneCount], i) => {
    const id = `r-demo${i}`;
    const date = new Date(2026, 9, 10 + i);
    const folder = mk(`2026-10-${10 + i}_${biz.toUpperCase()}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, folders[stage]);
    for (const sub of REEL_SUBFOLDERS) mk(sub, folder);
    const iso = date.toISOString();
    reels.push([
      id, title, biz, tags, stage, assignee, 'afroz@example.com', iso, iso, folder, '',
      stage === 'completed' ? 'https://www.instagram.com/reel/demo' : '', stage === 'completed' ? '2026-10-18' : '', '',
    ]);
    workflow.steps.slice(0, doneCount).forEach((step) => checklist.push([id, step.id, 'TRUE', assignee, iso, '']));
  });
  s.sheets[sheetId] = {
    Reels: reels,
    Checklist: checklist,
    Businesses: [[...TABS.Businesses], ...SEED_BUSINESSES.map((b) => recordToRow([...TABS.Businesses], businessToRecord(b)))],
    Tags: [[...TABS.Tags], ...['buyers', 'tips', 'permits', 'basements', 'email', 'before-after', 'money', 'passwords'].map((t) => [t, ''])],
    Activity: [[...TABS.Activity]],
    Meta: [[...TABS.Meta], ['schema_version', String(SCHEMA_VERSION)]],
  };
  s.files[sheetId] = { id: sheetId, name: 'Reel Tracker', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [root] };
  save(s);
  localStorage.setItem(IDS_KEY, JSON.stringify({ sheetId, driveFolders: folders }));
}

export function installMockGoogle() {
  const params = new URLSearchParams(location.search);
  const who = params.get('user') ?? 'afroz';
  const user = { email: `${who}@example.com`, name: who[0].toUpperCase() + who.slice(1) };
  if (params.has('reset')) {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(IDS_KEY);
  }
  if (params.has('seed') && !localStorage.getItem(STORE_KEY)) seed();

  (window as { __reelStudioMock?: boolean }).__reelStudioMock = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!/googleapis\.com$/.test(url.hostname)) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, 120));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    return handle(init?.method ?? 'GET', url, body, user);
  };

  // Fake Google Identity Services: sign-in succeeds immediately.
  const oauth2 = {
    initTokenClient: (cfg: { callback: (r: unknown) => void }) => ({
      requestAccessToken: () =>
        setTimeout(() => cfg.callback({ access_token: `mock-token-${who}`, expires_in: 3600, scope: '' }), 50),
    }),
    hasGrantedAllScopes: () => true,
    revoke: (_t: string, done: () => void) => done(),
  };
  (window as unknown as { google: unknown }).google = { accounts: { oauth2 } };
  console.info(`[mock] Fake Google active, signed in as ${user.email}`);
}
