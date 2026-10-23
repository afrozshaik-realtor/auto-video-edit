import { useId, useState } from 'react';
import { getPrompt, renderPrompt, type PromptContext } from '../config/prompts';
import type { WorkflowStep } from '../config/workflow';
import type { Reel } from '../data/types';
import { folderUrl } from '../services/google/drive';
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
    case 'running':
      return reel.aiDetail ? `AI editing: ${reel.aiDetail}` : 'AI editing';
    case 'failed':
      return 'AI edit failed';
    default:
      return null;
  }
}

export function AiEditPanel({ reel, onQueue }: { reel: Reel; onQueue: (notes: string) => Promise<void> }) {
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
        <p>
          Queued. The AI editor checks for work every {AI_CHECK_EVERY}, so it should start soon.
        </p>
      );
      break;
    case 'running':
      body = (
        <>
          <p className="ai-now">
            <span className="ai-dot" aria-hidden="true" />
            {reel.aiDetail || 'Editing'}
          </p>
          <p className="muted small">
            Updated {timeAgo(reel.aiUpdatedAt)}. A full edit usually takes 30–90 minutes. You can close this page.
          </p>
        </>
      );
      break;
    case 'done':
      body = (
        <>
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
