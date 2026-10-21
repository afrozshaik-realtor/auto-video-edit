import { useEffect, useId, useState } from 'react';

interface Props {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: 'url' | 'email' | 'text';
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  /** Shows an "Open" link next to a saved URL. */
  openLabel?: string;
}

/** A text field that saves when you leave it (or press Enter on a single line). */
export function SaveOnBlurField({ label, value, onSave, type = 'text', multiline, placeholder, hint, openLabel }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Follow outside changes (e.g. a teammate's edit) unless we're mid-edit.
  useEffect(() => {
    if (state !== 'saving') setDraft(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  async function commit() {
    const next = draft.trim();
    if (next === value.trim()) return;
    setState('saving');
    try {
      await onSave(next);
      setState('saved');
      window.setTimeout(() => setState('idle'), 1500);
    } catch {
      setDraft(value);
      setState('idle');
    }
  }

  const common = {
    id,
    className: 'input',
    value: draft,
    placeholder,
    onBlur: () => void commit(),
    'aria-describedby': hint ? `${id}-hint` : undefined,
  };

  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <span className="save-state" aria-live="polite">
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}
        </span>
      </div>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <div className="input-row">
          <input
            {...common}
            type={type}
            inputMode={type === 'url' ? 'url' : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          {openLabel && /^https?:\/\//.test(value) && (
            <a className="btn btn-secondary btn-small" href={value} target="_blank" rel="noopener noreferrer">
              {openLabel}
            </a>
          )}
        </div>
      )}
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}
