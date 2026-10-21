import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Wordmark } from '../screens/SignInScreen';
import { useAuth } from '../state/auth';
import { useTheme, type ThemePref } from '../state/theme';
import { Icon } from './Icon';

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
const THEME_ICON: Record<ThemePref, string> = { system: 'monitor', light: 'sun', dark: 'moon' };

export function AppShell({ children }: { children: ReactNode }) {
  const { session, expired, signIn, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const [signInError, setSignInError] = useState<string | null>(null);
  const { pathname } = useLocation();

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="topbar-home" aria-label="Reel Studio board">
          <Wordmark />
        </Link>
        <nav className="topbar-nav" aria-label="Main">
          <NavLink to="/" end className="navlink">
            Board
          </NavLink>
          <NavLink to="/new" className="btn btn-primary btn-small">
            <Icon name="plus" size={16} />
            New reel
          </NavLink>
        </nav>
        <div className="topbar-right">
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={() => setTheme(NEXT_THEME[theme])}
            aria-label={`${THEME_LABEL[theme]}. Change theme`}
            title={THEME_LABEL[theme]}
          >
            <Icon name={THEME_ICON[theme]} />
          </button>
          <details className="account">
            <summary className="btn btn-quiet btn-small" aria-label={`Account: ${session?.email ?? ''}`}>
              <span className="avatar" aria-hidden="true">
                {(session?.name || session?.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="account-email">{session?.email}</span>
            </summary>
            <div className="account-menu">
              <p className="muted small">Signed in as {session?.email}</p>
              <button type="button" className="btn btn-secondary btn-small" onClick={signOut}>
                Sign out
              </button>
            </div>
          </details>
        </div>
      </header>

      {expired && (
        <div className="banner" role="alert">
          <span>Your Google sign-in expired. Sign in again to keep saving changes.</span>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => {
              setSignInError(null);
              signIn().catch((e: Error) => setSignInError(e.message));
            }}
          >
            Sign in again
          </button>
          {signInError && <span className="form-error">{signInError}</span>}
        </div>
      )}

      <main id="main" className="page" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
