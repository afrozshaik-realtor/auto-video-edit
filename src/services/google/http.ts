import { AuthExpiredError, getAccessToken, markExpired } from './auth';

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

function friendlyMessage(status: number, apiMessage: string): string {
  if (status === 403) return `Google refused this (no permission). Ask the owner to share the Reels folder and Reel Tracker sheet with you as Editor. (${apiMessage})`;
  if (status === 404) return `Google couldn’t find that file or folder. It may have been moved, deleted or not shared with you. (${apiMessage})`;
  if (status === 429) return 'Google is rate-limiting requests. Wait a few seconds and try again.';
  return apiMessage || `Google request failed (${status}).`;
}

/** fetch() against a Google REST API with the signed-in user's token. */
export async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new GoogleApiError('Couldn’t reach Google. Check your connection and try again.', 0);
  }
  if (res.status === 401) {
    markExpired();
    throw new AuthExpiredError();
  }
  if (!res.ok) {
    let apiMessage = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      apiMessage = body.error?.message ?? '';
    } catch {
      // Non-JSON error body.
    }
    throw new GoogleApiError(friendlyMessage(res.status, apiMessage), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
