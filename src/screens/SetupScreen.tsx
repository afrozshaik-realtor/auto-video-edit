import { useState } from 'react';
import type { AppIds } from '../config/app.config';
import { CopyButton } from '../components/CopyButton';
import { saveLocalIds } from '../data/repo';
import { runSetup, SETUP_STEP_LABELS, type SetupStep } from '../data/setup';
import { folderUrl, sheetUrl } from '../services/google/drive';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { Wordmark } from './SignInScreen';

const STEPS = Object.keys(SETUP_STEP_LABELS) as SetupStep[];

function configSnippet(ids: AppIds): string {
  return `  sheetId: '${ids.sheetId}',
  driveFolders: {
    root: '${ids.driveFolders.root}', // Reels/
    raw: '${ids.driveFolders.raw}', // Reels/01 Raw Videos/
    working: '${ids.driveFolders.working}', // Reels/02 Working Videos/
    completed: '${ids.driveFolders.completed}', // Reels/03 Completed Videos/
  },`;
}

export function SetupScreen({ onReady }: { onReady: (ids: AppIds) => void }) {
  const { session, signOut } = useAuth();
  const { fail } = useToast();
  const [current, setCurrent] = useState<SetupStep | null>(null);
  const [failedAt, setFailedAt] = useState<SetupStep | null>(null);
  const [ids, setIds] = useState<AppIds | null>(null);

  async function start() {
    setFailedAt(null);
    let step: SetupStep | null = null;
    try {
      const result = await runSetup((s) => {
        step = s;
        setCurrent(s);
      });
      setIds(result);
      setCurrent(null);
    } catch (e) {
      setFailedAt(step);
      setCurrent(null);
      fail(e);
    }
  }

  const doneIndex = ids ? STEPS.length : current ? STEPS.indexOf(current) : failedAt ? STEPS.indexOf(failedAt) : -1;

  return (
    <main className="center-page">
      <div className="center-card center-card-wide">
        <Wordmark />
        <h1 className="center-title">Set up Reel Studio</h1>

        {!ids && (
          <>
            <p>
              This app doesn’t have a Reel Tracker sheet yet. Setup creates these in <strong>{session?.email}</strong>’s
              Google Drive:
            </p>
            <ul className="plain-list">
              <li>
                A <code>Reels</code> folder with <code>01 Raw Videos</code>, <code>02 Working Videos</code> and{' '}
                <code>03 Completed Videos</code>
              </li>
              <li>
                A <code>Reel Tracker</code> sheet inside it, with AM Builders, TCE and Dr Cyber already added
              </li>
            </ul>
            <p className="muted">
              Only the owner runs this, once. Teammates should wait until the owner shares the folder and the app is
              updated.
            </p>
            <ol className="setup-steps">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={
                    failedAt === s ? 'is-failed' : i < doneIndex ? 'is-done' : current === s ? 'is-current' : ''
                  }
                >
                  {SETUP_STEP_LABELS[s]}
                  {failedAt === s && <span className="sr-only"> (failed)</span>}
                </li>
              ))}
            </ol>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={start} disabled={current !== null}>
                {current ? 'Setting up…' : failedAt ? 'Try setup again' : 'Create folders and sheet'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={signOut} disabled={current !== null}>
                Sign out
              </button>
            </div>
            {failedAt && (
              <p className="muted">
                If it stopped part-way, delete the half-made <code>Reels</code> folder in Drive before trying again.
              </p>
            )}
          </>
        )}

        {ids && (
          <>
            <p className="success-line">Folders and sheet created.</p>
            <h2 className="section-title">1. Paste the IDs into the app</h2>
            <p>
              In <code>src/config/app.config.ts</code>, replace the empty <code>sheetId</code> and{' '}
              <code>driveFolders</code> with this, then push to <code>main</code>:
            </p>
            <div className="code-block">
              <pre>{configSnippet(ids)}</pre>
              <CopyButton text={configSnippet(ids)} label="Copy config" />
            </div>
            <dl className="id-list">
              {(
                [
                  ['Sheet', ids.sheetId],
                  ['Reels folder', ids.driveFolders.root],
                  ['01 Raw Videos', ids.driveFolders.raw],
                  ['02 Working Videos', ids.driveFolders.working],
                  ['03 Completed Videos', ids.driveFolders.completed],
                ] as const
              ).map(([label, id]) => (
                <div key={label} className="id-row">
                  <dt>{label}</dt>
                  <dd>
                    <code>{id}</code>
                    <CopyButton text={id} label="Copy ID" className="btn btn-quiet btn-small" />
                  </dd>
                </div>
              ))}
            </dl>

            <h2 className="section-title">2. Share with the team</h2>
            <p>
              Share the <code>Reels</code> folder with each teammate as <strong>Editor</strong>. The Reel Tracker sheet
              is inside it, so it’s shared too.
            </p>
            <div className="row">
              <a className="btn btn-secondary" href={folderUrl(ids.driveFolders.root)} target="_blank" rel="noopener noreferrer">
                Open Reels folder in Drive
              </a>
              <a className="btn btn-secondary" href={sheetUrl(ids.sheetId)} target="_blank" rel="noopener noreferrer">
                Open Reel Tracker sheet
              </a>
            </div>

            <h2 className="section-title">3. Start using it</h2>
            <p className="muted">
              You can start now on this device. Everyone else gets it once the IDs are in <code>app.config.ts</code>.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveLocalIds(ids);
                onReady(ids);
              }}
            >
              Use these IDs on this device
            </button>
          </>
        )}
      </div>
    </main>
  );
}
