import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
import { App } from './App';
import { applyTheme } from './state/theme';

applyTheme();

async function start() {
  // Dev only: `?mock` runs the app against an in-memory fake of Drive and Sheets.
  // This branch is removed from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
    const { installMockGoogle } = await import('./dev/mockGoogle');
    installMockGoogle();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
