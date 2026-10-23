import { useState } from 'react';
import { useAuth } from '../state/auth';

export function SignInScreen() {
  const { signIn, gisReady, gisError } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-page">
      <div className="center-card">
        <Wordmark />
        <h1 className="center-title">Take every reel from raw clip to posted.</h1>
        <p className="muted">
          Sign in with the Google account the Reels folder and Reel Tracker sheet are shared with.
        </p>
        <button type="button" className="btn btn-primary btn-large" onClick={onClick} disabled={!gisReady || busy}>
          {busy ? 'Waiting for Google…' : gisReady ? 'Sign in with Google' : 'Loading Google sign-in…'}
        </button>
        {(error || gisError) && (
          <p className="form-error" role="alert">
            {error || gisError}
          </p>
        )}
        <p className="fine-print">
          Google will ask to let Reel Studio see and edit your Drive files and Sheets. It only works with the Reels folder
          and Reel Tracker sheet shared with you.
        </p>
        <LegalLinks />
      </div>
    </main>
  );
}

export function LegalLinks() {
  return (
    <p className="legal-links">
      <a href="./privacy.html">Privacy Policy</a>
      <a href="./terms.html">Terms of Service</a>
    </p>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="2" y="6" width="11" height="4.5" rx="1.2" fill="currentColor" opacity=".85" />
        <rect x="7" y="13.5" width="15" height="4.5" rx="1.2" fill="currentColor" opacity=".85" />
        <rect x="11" y="2" width="2" height="20" rx="1" fill="var(--playhead)" />
      </svg>
      Reel Studio
    </span>
  );
}
