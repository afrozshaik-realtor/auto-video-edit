// Google Identity Services, OAuth token model. Runs entirely in the browser:
// each person signs in with their own Google account and acts with their own
// Drive and Sheets permissions. Access tokens last about an hour; when one
// expires the UI asks the person to sign in again (one click, no re-consent).

import { appConfig } from '../../config/app.config';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const STORAGE_KEY = 'reel-studio.session';

export const SCOPES = [
  // Full Drive access is needed to move folders that teammates created and
  // to open clips uploaded through the Drive website.
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

export class AuthExpiredError extends Error {
  constructor() {
    super('Your Google sign-in has expired. Sign in again to continue.');
    this.name = 'AuthExpiredError';
  }
}

export interface Session {
  accessToken: string;
  expiresAt: number; // epoch ms
  email: string;
  name: string;
}

type Listener = (s: Session | null, expired: boolean) => void;

let session: Session | null = readStoredSession();
let expired = false;
const listeners = new Set<Listener>();
let gisPromise: Promise<void> | null = null;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let pending: { resolve: (r: google.accounts.oauth2.TokenResponse) => void; reject: (e: Error) => void } | null = null;

function readStoredSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expiresAt > Date.now() + 60_000 ? s : null;
  } catch {
    return null;
  }
}

function storeSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode etc.: the session just won't survive a reload.
  }
}

function emit() {
  for (const l of listeners) l(session, expired);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSession(): Session | null {
  return session;
}

export function isExpired(): boolean {
  return expired;
}

/** Load the GIS script once. Call early so the sign-in click can open the popup synchronously. */
export function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Couldn’t load Google sign-in. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

function getTokenClient(): google.accounts.oauth2.TokenClient {
  if (tokenClient) return tokenClient;
  if (!appConfig.googleClientId) throw new Error('No Google Client ID in src/config/app.config.ts.');
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: appConfig.googleClientId,
    scope: SCOPES.join(' '),
    callback: (resp) => {
      const p = pending;
      pending = null;
      if (!p) return;
      if (resp.error) p.reject(new Error(resp.error_description || resp.error));
      else p.resolve(resp);
    },
    error_callback: (err) => {
      const p = pending;
      pending = null;
      if (!p) return;
      p.reject(
        new Error(
          err.type === 'popup_closed'
            ? 'Sign-in was closed before it finished.'
            : err.type === 'popup_failed_to_open'
              ? 'The sign-in window was blocked. Allow pop-ups for this site and try again.'
              : 'Sign-in failed. Try again.',
        ),
      );
    },
  });
  return tokenClient;
}

/**
 * Open Google sign-in. Must be called from a click handler (pop-up rules).
 * Make sure loadGis() has resolved first.
 */
export function signIn(): Promise<Session> {
  const client = getTokenClient();
  const hint = session?.email;
  return new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
    pending?.reject(new Error('Sign-in restarted.'));
    pending = { resolve, reject };
    client.requestAccessToken({ prompt: hint ? '' : 'select_account', login_hint: hint });
  }).then(async (resp) => {
    if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPES[0], ...SCOPES.slice(1))) {
      throw new Error('Reel Studio needs access to Google Drive and Google Sheets. Sign in again and tick both boxes.');
    }
    const accessToken = resp.access_token;
    const expiresAt = Date.now() + Number(resp.expires_in) * 1000;
    const user = await fetchUser(accessToken);
    session = { accessToken, expiresAt, ...user };
    expired = false;
    storeSession(session);
    emit();
    return session;
  });
}

async function fetchUser(token: string): Promise<{ email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Signed in, but couldn’t read your Google account details.');
  const data = (await res.json()) as { user: { emailAddress: string; displayName: string } };
  return { email: data.user.emailAddress, name: data.user.displayName };
}

/** Current access token, or throws AuthExpiredError. */
export function getAccessToken(): string {
  if (!session) throw new AuthExpiredError();
  if (session.expiresAt <= Date.now() + 30_000) {
    markExpired();
    throw new AuthExpiredError();
  }
  return session.accessToken;
}

export function markExpired() {
  if (expired) return;
  expired = true;
  emit();
}

export function signOut() {
  const token = session?.accessToken;
  session = null;
  expired = false;
  storeSession(null);
  emit();
  if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
}
