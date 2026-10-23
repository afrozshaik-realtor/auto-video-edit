import { useEffect, useId, useState } from 'react';
import { getPrompt, renderPrompt, type PromptContext } from '../config/prompts';
import type { WorkflowStep } from '../config/workflow';
import { AI_STAGES, editorHealth, progressFromDetail, reelProgress } from '../data/aiProgress';
import type { Reel } from '../data/types';
import { downloadFile, folderUrl } from '../services/google/drive';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyButton } from './CopyButton';
import { Icon } from './Icon';

export const AI_CHECK_EVERY = '10 minutes';

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(t).toLocaleDateString();
}

/** One-line AI status for the board and headers, or null when there's nothing to say. */
export function aiStatusLine(reel: Reel): string | null {
  switch (reel.aiStatus) {
    case 'queued':
      return 'AI edit queued';
    case 'running': {
      const p = progressFromDetail(reel.aiDetail);
      if (p.percent !== null) return `AI editing ${p.percent}%: ${AI_STAGES[p.stageIndex].label}`;
      return reel.aiDetail ? `AI editing: ${reel.aiDetail}` : 'AI editing';
    }
    case 'failed':
      return 'AI edit failed';
    default:
      if (reel.thumbStatus === 'queued' || reel.thumbStatus === 'running') return 'Making a new thumbnail';
      if (reel.thumbStatus === 'failed') return 'Thumbnail failed';
      return null;
  }
}

/** Drive file id from a https://drive.google.com/file/d/<id>/view link. */
export function driveFileId(link: string): string | null {
  return /\/file\/d\/([^/?#]+)/.exec(link)?.[1] ?? null;
}

/** Shows a Drive image using the viewer's own Google sign-in (Drive files aren't public). */
function DriveImage({ fileId, alt }: { fileId: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setFailed(false);
    downloadFile(fileId)
      .then((buf) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  if (failed) return <p className="muted small">Couldn’t load the preview. Open it in Drive instead.</p>;
  if (!src) return <div className="thumb-preview thumb-loading" aria-label="Loading thumbnail" />;
  return <img className="thumb-preview" src={src} alt={alt} />;
}

export function ThumbnailPanel({ reel, onQueue }: { reel: Reel; onQueue: (notes: string) => Promise<void> }) {
  const id = useId();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const editing = reel.aiStatus === 'queued' || reel.aiStatus === 'running';
  const fileId = driveFileId(reel.thumbnailLink);

  const queue = async () => {
    setBusy(true);
    try {
      await onQueue(notes);
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  const redo = (
    <details className="stuck" open={reel.thumbStatus === 'failed' || undefined}>
      <summary>{reel.thumbStatus === 'failed' ? 'Try again' : 'Not right? Make a new one'}</summary>
      <div className="thumb-redo">
        <label className="field-label" htmlFor={`${id}-notes`}>
          What should change? <span className="optional">optional</span>
        </label>
        <textarea
          id={`${id}-notes`}
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="For example: headline “Permit first”, darker background, me smiling."
        />
        <button type="button" className="btn btn-secondary btn-small" onClick={queue} disabled={busy}>
          {busy ? 'Queuing…' : 'Make a new thumbnail'}
        </button>
      </div>
    </details>
  );

  let body;
  if (reel.thumbStatus === 'queued') {
    body = <p>Queued. The AI editor checks for work every {AI_CHECK_EVERY}; a thumbnail takes about a minute.</p>;
  } else if (reel.thumbStatus === 'running') {
    body = (
      <p className="ai-now">
        <span className="ai-dot" aria-hidden="true" />
        {reel.thumbDetail || 'Making the thumbnail'}
      </p>
    );
  } else if (reel.thumbStatus === 'done' || (reel.thumbnailLink && reel.thumbStatus !== 'failed')) {
    body = (
      <>
        {fileId && <DriveImage fileId={fileId} alt={`Thumbnail for ${reel.title}`} />}
        <div className="tool-row">
          <a className="btn btn-secondary btn-small" href={reel.thumbnailLink} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={16} />
            Open thumbnail in Drive
          </a>
        </div>
        {redo}
      </>
    );
  } else if (reel.thumbStatus === 'failed') {
    body = (
      <>
        <p className="form-error">{reel.thumbDetail || 'Making the thumbnail failed.'}</p>
        {redo}
      </>
    );
  } else {
    body = <p>{editing ? 'Made as soon as the AI edit finishes.' : 'Made after the AI edit.'}</p>;
  }

  return (
    <>
      <div className="ai-panel" aria-live="polite">
        {body}
      </div>
      {reel.thumbPrompt && (
        <details className="stuck">
          <summary>Image prompt Claude wrote</summary>
          <div className="prompt">
            <div className="prompt-head">
              <span className="muted small">Paste it into ChatGPT with a photo of you to try it by hand.</span>
              <CopyButton text={reel.thumbPrompt} label="Copy prompt" />
            </div>
            <pre className="prompt-text" tabIndex={0} aria-label="Thumbnail image prompt">
              {reel.thumbPrompt}
            </pre>
          </div>
        </details>
      )}
    </>
  );
}

/** Is the AI editor job alive? Based on the heartbeat it writes on every check. */
export function EditorHealthNote({ lastCheck }: { lastCheck: string | undefined }) {
  const health = editorHealth(lastCheck);
  if (health === 'ok') return <p className="muted small">The AI editor last checked for work {timeAgo(lastCheck!)}.</p>;
  if (health === 'stale')
    return (
      <p className="ai-warning">
        The AI editor last checked for work {timeAgo(lastCheck!)}, so it may have stopped. Ask the owner to look at the
        repo’s Actions tab. GitHub pauses scheduled jobs after 60 days without a commit.
      </p>
    );
  return (
    <p className="ai-warning">
      The AI editor hasn’t checked in yet, so nothing will start. The owner needs to finish setting it up: add the Google
      and Claude secrets on GitHub (README, “Set up the AI editor”).
    </p>
  );
}

/** Overall progress through the AI edit, with the current stage and the full stage list. */
export function AiProgressBar({ reel }: { reel: Reel }) {
  const p = reelProgress(reel);
  const running = reel.aiStatus === 'running';
  const unknown = running && p.percent === null;
  const current = p.stageIndex >= 0 && p.stageIndex < AI_STAGES.length ? AI_STAGES[p.stageIndex] : null;
  const label =
    reel.aiStatus === 'done'
      ? 'Finished'
      : reel.aiStatus === 'queued'
        ? 'Waiting to start'
        : current
          ? current.label + (p.stagePercent !== null ? ` (${p.stagePercent}% of this step)` : '')
          : reel.aiDetail || 'Working';

  return (
    <div className="ai-progress">
      <div className="ai-progress-head">
        <span className="ai-progress-label">
          {running && <span className="ai-dot" aria-hidden="true" />}
          {label}
        </span>
        <span className="mono ai-progress-pct">{unknown ? '' : `${p.percent ?? 0}%`}</span>
      </div>
      <div
        className={`ai-progress-bar${unknown ? ' is-unknown' : ''}${reel.aiStatus === 'done' ? ' is-done' : ''}`}
        role="progressbar"
        aria-label="AI edit progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={unknown ? undefined : (p.percent ?? 0)}
        aria-valuetext={unknown ? label : `${p.percent ?? 0}%, ${label}`}
      >
        <span style={{ width: unknown ? undefined : `${p.percent ?? 0}%` }} />
      </div>
      {p.position && <p className="muted small">{p.position}</p>}
      {(running || reel.aiStatus === 'queued') && (
        <details className="stuck">
          <summary>All steps</summary>
          <ol className="ai-stage-list">
            {AI_STAGES.map((s, i) => {
              const state = i < p.stageIndex ? 'done' : i === p.stageIndex ? 'current' : 'todo';
              return (
                <li key={s.label} className={`is-${state}`}>
                  <span className="sr-only">{state === 'done' ? 'Done: ' : state === 'current' ? 'Now: ' : ''}</span>
                  {s.label}
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </div>
  );
}

export function AiEditPanel({
  reel,
  lastCheck,
  onQueue,
}: {
  reel: Reel;
  lastCheck: string | undefined;
  onQueue: (notes: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const queue = async () => {
    setBusy(true);
    try {
      await onQueue(reel.aiNotes);
    } finally {
      setBusy(false);
    }
  };

  let body;
  switch (reel.aiStatus) {
    case 'queued':
      body = (
        <>
          <AiProgressBar reel={reel} />
          <p>
            Queued. The AI editor checks for work every {AI_CHECK_EVERY} (GitHub sometimes runs it late), then the bar
            starts moving.
          </p>
          <EditorHealthNote lastCheck={lastCheck} />
        </>
      );
      break;
    case 'running':
      body = (
        <>
          <AiProgressBar reel={reel} />
          <p className="muted small">
            Last update {timeAgo(reel.aiUpdatedAt)}. A full edit usually takes 30–90 minutes. You can close this page;
            it keeps going.
          </p>
        </>
      );
      break;
    case 'done':
      body = (
        <>
          <AiProgressBar reel={reel} />
          <p className="success-line">{reel.aiDetail || 'Finished'}.</p>
          <div className="tool-row">
            {reel.finalVideoLink && (
              <a className="btn btn-secondary btn-small" href={reel.finalVideoLink} target="_blank" rel="noopener noreferrer">
                <Icon name="film" size={16} />
                Open final video
              </a>
            )}
            <a className="btn btn-secondary btn-small" href={folderUrl(reel.driveFolderId)} target="_blank" rel="noopener noreferrer">
              <Icon name="folder" size={16} />
              Open reel folder in Drive
            </a>
          </div>
        </>
      );
      break;
    case 'failed':
      body = (
        <>
          <p className="form-error">{reel.aiDetail || 'The AI edit stopped.'}</p>
          <button type="button" className="btn btn-primary btn-small" onClick={queue} disabled={busy}>
            {busy ? 'Queuing…' : 'Try the AI edit again'}
          </button>
        </>
      );
      break;
    default:
      body = (
        <>
          <p>
            Waiting for the raw clip. Once it’s in the reel’s raw folder, the AI edit starts by itself within about{' '}
            {AI_CHECK_EVERY}.
          </p>
          <EditorHealthNote lastCheck={lastCheck} />
          <button type="button" className="btn btn-secondary btn-small" onClick={queue} disabled={busy}>
            {busy ? 'Queuing…' : 'I’ve uploaded it: start the AI edit'}
          </button>
        </>
      );
  }

  return (
    <div className="ai-panel" aria-live="polite">
      {body}
    </div>
  );
}

export function CaptionPanel({ reel }: { reel: Reel }) {
  if (!reel.caption)
    return <p className="ai-panel muted">The AI edit writes the caption. It shows here when the edit finishes.</p>;
  return (
    <div className="prompt">
      <div className="prompt-head">
        <span className="prompt-label">Caption and hashtags</span>
        <CopyButton text={reel.caption} label="Copy caption" />
      </div>
      <pre className="prompt-text" tabIndex={0} aria-label="Caption text">
        {reel.caption}
      </pre>
    </div>
  );
}

interface ReviewProps {
  reel: Reel;
  step: WorkflowStep;
  promptContext: PromptContext;
  onRerun: (notes: string) => Promise<void>;
}

/** Director notes for the phone check: build a note list, then re-run the AI edit with it. */
export function ReviewPanel({ reel, step, promptContext, onRerun }: ReviewProps) {
  const id = useId();
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const busy = reel.aiStatus === 'queued' || reel.aiStatus === 'running';
  const chips = (step.prompts ?? []).map(getPrompt).filter((p) => p !== undefined);

  const add = (text: string) => setNotes((n) => (n.trim() ? `${n.trim()}\n- ${text}` : `- ${text}`));

  return (
    <div className="prompt">
      <div className="prompt-head">
        <span className="prompt-label">Something to fix?</span>
        <span className="muted small">Tap a note to add it, then edit any [brackets]</span>
      </div>
      <div className="chips">
        {chips.map((c) => (
          <button key={c.id} type="button" className="chip" onClick={() => add(renderPrompt(c, promptContext))} title={c.text}>
            <Icon name="plus" size={14} />
            {c.label}
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor={`${id}-notes`}>
        Notes for the AI editor
      </label>
      <textarea
        id={`${id}-notes`}
        className="input"
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="For example: the B-roll at “permit” should show a city permit form."
      />
      <div className="row">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !notes.trim()}
          onClick={() => setConfirm(true)}
        >
          Re-run AI edit with these notes
        </button>
        {busy && <span className="muted small">An AI edit is already queued or running.</span>}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Re-run the AI edit?"
        confirmLabel="Re-run AI edit"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await onRerun(notes);
          setNotes('');
        }}
      >
        <p>
          The AI editor makes a new version with your notes and saves it as <code>final-v{reel.aiRuns + 1}.mp4</code>. The
          current video stays in Drive. The AI steps and the phone check are unticked when the new edit starts.
        </p>
      </ConfirmDialog>
    </div>
  );
}
