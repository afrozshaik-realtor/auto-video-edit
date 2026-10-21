import { useId } from 'react';
import { getPrompt, renderPrompt, type PromptContext } from '../config/prompts';
import { getTool } from '../config/tools';
import type { WorkflowStep } from '../config/workflow';
import { stepTickBlocker } from '../data/stage';
import type { ChecklistEntry, Reel } from '../data/types';
import { folderUrl } from '../services/google/drive';
import { shortName } from './ClipCard';
import { CopyButton, CopyChip } from './CopyButton';
import { Icon } from './Icon';
import { SaveOnBlurField } from './SaveOnBlurField';

interface Props {
  step: WorkflowStep;
  index: number;
  reel: Reel;
  entry: ChecklistEntry | undefined;
  open: boolean;
  isLast: boolean;
  promptContext: PromptContext;
  onToggleOpen: () => void;
  onSetDone: (done: boolean) => void;
  onNext: () => void;
  onSaveNote: (note: string) => Promise<void>;
  onSaveField: (field: 'finalVideoLink' | 'postedUrl', value: string) => Promise<void>;
  onBlocked: (message: string) => void;
}

const FIELD_LABELS = {
  finalVideoLink: { label: 'Final video link', hint: 'Paste the Drive link to the final MP4.', open: 'Open video' },
  postedUrl: { label: 'Posted URL', hint: 'Paste the Instagram link after it’s live.', open: 'Open post' },
} as const;

export function StepItem(p: Props) {
  const { step, index, reel, entry, open } = p;
  const bodyId = useId();
  const done = entry?.done ?? false;
  const num = String(index + 1).padStart(2, '0');
  const blocker = stepTickBlocker(step, reel);

  function toggleDone(next: boolean) {
    if (next && blocker) {
      p.onBlocked(blocker);
      return;
    }
    p.onSetDone(next);
  }

  const blockPrompts = (step.prompts ?? []).map(getPrompt).filter((x) => x && x.kind === 'block');
  const chipPrompts = (step.prompts ?? []).map(getPrompt).filter((x) => x && x.kind === 'chip');

  return (
    <li id={`step-${step.id}`} className={`step${open ? ' is-open' : ''}${done ? ' is-done' : ''}`}>
      <div className="step-row">
        <input
          type="checkbox"
          className="step-check"
          checked={done}
          onChange={(e) => toggleDone(e.target.checked)}
          aria-label={`${step.title}: ${done ? 'done' : 'not done'}`}
        />
        <button type="button" className="step-toggle" aria-expanded={open} aria-controls={bodyId} onClick={p.onToggleOpen}>
          <span className="step-num">{num}</span>
          <span className="step-title">{step.title}</span>
          <span className="step-meta">
            {!step.required && <span className="pill">Optional</span>}
            <span className={`pill pill-who who-${step.who.toLowerCase()}`}>{step.who}</span>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      {open && (
        <div id={bodyId} className="step-body">
          <p>{step.instructions}</p>
          <p className="done-when">
            <span>Done when</span> {step.doneWhen}
          </p>

          {blockPrompts.map((prompt) => {
            const text = renderPrompt(prompt!, p.promptContext);
            return (
              <div key={prompt!.id} className="prompt">
                <div className="prompt-head">
                  <span className="prompt-label">{prompt!.label}</span>
                  {prompt!.draft && (
                    <span className="pill pill-draft" title="Replace with the exact text from the kit in src/config/prompts.ts">
                      Draft text
                    </span>
                  )}
                  <CopyButton text={text} label="Copy prompt" />
                </div>
                <pre className="prompt-text" tabIndex={0} aria-label={`${prompt!.label} text`}>
                  {text}
                </pre>
              </div>
            );
          })}

          {chipPrompts.length > 0 && (
            <div className="prompt">
              <div className="prompt-head">
                <span className="prompt-label">Director notes</span>
                <span className="muted small">Tap to copy</span>
              </div>
              <div className="chips">
                {chipPrompts.map((c) => (
                  <CopyChip key={c!.id} label={c!.label} text={renderPrompt(c!, p.promptContext)} />
                ))}
              </div>
            </div>
          )}

          {(step.tools ?? []).length > 0 && (
            <div className="tool-row">
              {(step.tools ?? []).map((id) => {
                const tool = getTool(id);
                if (!tool) return null;
                const href = tool.url ?? (reel.driveFolderId ? folderUrl(reel.driveFolderId) : null);
                if (!href) return null;
                return (
                  <a key={id} className="btn btn-secondary btn-small" href={href} target="_blank" rel="noopener noreferrer">
                    <Icon name={tool.icon} size={16} />
                    {tool.label}
                  </a>
                );
              })}
            </div>
          )}

          {step.field && (
            <SaveOnBlurField
              label={FIELD_LABELS[step.field].label}
              hint={FIELD_LABELS[step.field].hint}
              openLabel={FIELD_LABELS[step.field].open}
              type="url"
              value={reel[step.field]}
              placeholder="https://"
              onSave={(v) => p.onSaveField(step.field!, v)}
            />
          )}

          {step.stuck && step.stuck.length > 0 && (
            <details className="stuck">
              <summary>Stuck?</summary>
              <ul>
                {step.stuck.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </details>
          )}

          <SaveOnBlurField label="Note for this step" multiline value={entry?.note ?? ''} onSave={p.onSaveNote} />

          <div className="step-actions">
            {!done ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (blocker) return p.onBlocked(blocker);
                  p.onSetDone(true);
                  if (!p.isLast) p.onNext();
                }}
              >
                {p.isLast ? 'Mark step done' : 'Mark done and open next step'}
              </button>
            ) : (
              !p.isLast && (
                <button type="button" className="btn btn-secondary" onClick={p.onNext}>
                  Next step
                </button>
              )
            )}
            {done && entry?.doneBy && (
              <span className="muted small">
                Done by {shortName(entry.doneBy)}
                {entry.doneAt && ` · ${new Date(entry.doneAt).toLocaleDateString()}`}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
