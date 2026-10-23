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
  createdTime?: string;
  size?: string;
  /** File contents, base64 (uploaded files only). */
  content?: string;
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

function parseA1(range: string): { tab: string; row: number; col: number } {
  const [tab, cells = 'A1'] = decodeURIComponent(range).split('!');
  const m = /^([A-Z]+)(\d+)/.exec(cells);
  if (!m) return { tab, row: 1, col: 0 };
  const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return { tab, row: Number(m[2]), col };
}

function writeAt(grid: string[][], startRow: number, startCol: number, values: string[][]) {
  values.forEach((row, i) => {
    const target = [...(grid[startRow - 1 + i] ?? [])];
    row.forEach((v, j) => (target[startCol + j] = v));
    for (let k = 0; k < target.length; k++) target[k] ??= '';
    grid[startRow - 1 + i] = target;
  });
  for (let i = 0; i < grid.length; i++) grid[i] ??= [];
}

function toBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Dev/test helper: put a file with contents into the fake Drive. */
export function mockPutFile(name: string, parentId: string, mimeType: string, data: ArrayBuffer): string {
  const s = load();
  const id = newId(s, 'fil_');
  s.files[id] = {
    id, name, mimeType, parents: [parentId], createdTime: new Date().toISOString(),
    size: String(data.byteLength), content: toBase64(data),
  };
  save(s);
  return id;
}

/** Dev/test helper: the fake Drive and sheets, for checking results. */
export function mockStore(): Store {
  return load();
}

const meta = ({ content: _content, ...f }: MockFile) => f;

async function handle(method: string, url: URL, init: RequestInit | undefined, user: { email: string; name: string }): Promise<Response> {
  const s = load();
  const p = url.pathname;
  const isJson = typeof init?.body === 'string';
  const body: unknown = isJson ? JSON.parse(init!.body as string) : undefined;

  // ----- OAuth (the AI editor job refreshing its token) -----
  if (url.hostname === 'oauth2.googleapis.com' && p === '/token') return json({ access_token: 'mock-job-token', expires_in: 3600 });

  // ----- Drive uploads -----
  if (p === '/upload/drive/v3/files' && method === 'POST') {
    const b = body as { name: string; mimeType: string; parents?: string[] };
    const f: MockFile = { id: newId(s, 'fil_'), name: b.name, mimeType: b.mimeType, parents: b.parents ?? ['root'], createdTime: new Date().toISOString() };
    s.files[f.id] = f;
    save(s);
    return new Response(null, { status: 200, headers: { Location: `https://www.googleapis.com/upload/mock-session/${f.id}` } });
  }
  const um = /^\/upload\/mock-session\/([^/]+)$/.exec(p);
  if (um && method === 'PUT') {
    const f = s.files[um[1]];
    if (!f) return err(404, 'Upload session not found.');
    const buf = await new Response(init?.body as BodyInit).arrayBuffer();
    f.content = toBase64(buf);
    f.size = String(buf.byteLength);
    save(s);
    return json(meta(f));
  }

  // ----- Drive -----
  if (p === '/drive/v3/about') return json({ user: { emailAddress: user.email, displayName: user.name } });
  if (p === '/drive/v3/files' && method === 'GET') {
    const parent = /'([^']+)' in parents/.exec(url.searchParams.get('q') ?? '')?.[1];
    return json({ files: Object.values(s.files).filter((f) => !parent || f.parents.includes(parent)).map(meta) });
  }
  if (p === '/drive/v3/files' && method === 'POST') {
    const b = body as { name: string; mimeType: string; parents?: string[] };
    const f: MockFile = { id: newId(s, 'fld_'), name: b.name, mimeType: b.mimeType, parents: b.parents ?? ['root'], createdTime: new Date().toISOString() };
    s.files[f.id] = f;
    save(s);
    return json(f);
  }
  const fm = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
  if (fm) {
    const f = s.files[decodeURIComponent(fm[1])];
    if (!f) return err(404, 'File not found.');
    if (url.searchParams.get('alt') === 'media') {
      const bin = atob(f.content ?? '');
      return new Response(Uint8Array.from(bin, (c) => c.charCodeAt(0)), { status: 200 });
    }
    if (method === 'PATCH') {
      const add = url.searchParams.get('addParents');
      const remove = (url.searchParams.get('removeParents') ?? '').split(',').filter(Boolean);
      f.parents = f.parents.filter((x) => !remove.includes(x));
      if (add && !f.parents.includes(add)) f.parents.push(add);
      if (f.parents.length > 1) return err(403, 'Increasing the number of parents is not allowed.');
      save(s);
    }
    return json(meta(f));
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
        const { tab, row, col } = parseA1(d.range);
        writeAt((book[tab] ??= []), row, col, d.values);
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
      const { tab, row, col } = parseA1(rest);
      writeAt((book[tab] ??= []), row, col, (body as { values: string[][] }).values);
      save(s);
      return json({});
    }
  }
  return err(400, `Mock doesn’t handle ${method} ${p}`);
}

let schemaV1 = false;

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
  const v1 = schemaV1; // ?seed&v1: an old sheet, to test the migration
  const reelHeaders = v1 ? TABS.Reels.slice(0, 14) : [...TABS.Reels];
  const reels: string[][] = [reelHeaders];
  const checklist: string[][] = [[...TABS.Checklist]];
  const caption = 'Three things nobody tells you before your first offer.\n\n#realestate #firsttimebuyer #homebuying';
  // [title, business, tags, stage, assignee, steps done, ai_status, ai_detail]
  const demo: [string, string, string, 'raw' | 'working' | 'completed', string, number, string, string][] = [
    ['First-time buyer mistakes', 'tce', 'buyers, tips', 'raw', 'afroz@example.com', 1, '', ''],
    ['Is your basement legal? Permits 101', 'amb', 'permits, basements', 'raw', 'sam@example.com', 0, '', ''],
    ['Phishing red flags in 30 seconds', 'drc', 'email, tips', 'working', 'sam@example.com', 2, 'running', 'Pass 02: cut-out'],
    ['Walkout basement before and after', 'amb', 'basements, before-after', 'working', 'afroz@example.com', 4, 'done', 'Finished edit 1'],
    ['What closing costs really include', 'tce', 'buyers, money', 'working', 'afroz@example.com', 2, 'failed', 'The AI editor ran out of turns.'],
    ['Password managers explained', 'drc', 'passwords, tips', 'completed', 'sam@example.com', workflow.steps.length, 'done', 'Finished edit 1'],
    ['Pre-approval vs pre-qualification', 'tce', 'buyers, money', 'completed', 'afroz@example.com', workflow.steps.length, 'done', 'Finished edit 2'],
  ];
  demo.forEach(([title, biz, tags, stage, assignee, doneCount, aiStatus, aiDetail], i) => {
    const id = `r-demo${i}`;
    const date = new Date(2026, 9, 10 + i);
    const folder = mk(`2026-10-${10 + i}_${biz.toUpperCase()}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, folders[stage]);
    for (const sub of REEL_SUBFOLDERS) mk(sub, folder);
    const iso = date.toISOString();
    const finished = aiStatus === 'done';
    const row = [
      id, title, biz, tags, stage, assignee, 'afroz@example.com', iso, iso, folder,
      finished ? 'https://drive.google.com/file/d/demo/view' : '',
      stage === 'completed' ? 'https://www.instagram.com/reel/demo' : '', stage === 'completed' ? '2026-10-18' : '', '',
    ];
    if (!v1) row.push(aiStatus, aiDetail, aiStatus ? new Date().toISOString() : '', finished ? '1' : '', '', finished ? caption : '');
    reels.push(row);
    workflow.steps.slice(0, doneCount).forEach((step) => checklist.push([id, step.id, 'TRUE', step.auto ? 'Reel Studio AI' : assignee, iso, '']));
  });
  s.sheets[sheetId] = {
    Reels: reels,
    Checklist: checklist,
    Businesses: [[...TABS.Businesses], ...SEED_BUSINESSES.map((b) => recordToRow([...TABS.Businesses], businessToRecord(b)))],
    Tags: [[...TABS.Tags], ...['buyers', 'tips', 'permits', 'basements', 'email', 'before-after', 'money', 'passwords'].map((t) => [t, ''])],
    Activity: [[...TABS.Activity]],
    Meta: [[...TABS.Meta], ['schema_version', v1 ? '1' : String(SCHEMA_VERSION)]],
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
  schemaV1 = params.has('v1');
  if (params.has('seed') && !localStorage.getItem(STORE_KEY)) seed();

  (window as { __reelStudioMock?: boolean }).__reelStudioMock = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!/googleapis\.com$/.test(url.hostname)) return realFetch(input, init);
    if (typeof document !== 'undefined') await new Promise((r) => setTimeout(r, 120));
    return handle(init?.method ?? 'GET', url, init, user);
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
