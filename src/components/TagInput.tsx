import { useId, useState } from 'react';

interface Props {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

function clean(t: string): string {
  return t.replace(/,/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Tags as removable chips. Type-ahead from existing tags; Enter or comma adds a new one. */
export function TagInput({ id, value, onChange, suggestions }: Props) {
  const listId = useId();
  const [text, setText] = useState('');

  function add(raw: string) {
    const t = clean(raw);
    if (t && !value.some((v) => v.toLowerCase() === t)) onChange([...value, t]);
    setText('');
  }

  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="tag-input">
      {value.length > 0 && (
        <ul className="chips" aria-label="Selected tags">
          {value.map((t) => (
            <li key={t}>
              <button
                type="button"
                className="chip chip-removable"
                onClick={() => onChange(value.filter((v) => v !== t))}
                aria-label={`Remove tag ${t}`}
              >
                {t}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="input"
        list={listId}
        value={text}
        placeholder={value.length ? 'Add another tag' : 'Type a tag and press Enter'}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          // Browsers report a datalist pick as a replacement (or with no input type at all).
          const inputType = (e.nativeEvent as InputEvent).inputType;
          const picked = (!inputType || inputType === 'insertReplacementText') && remaining.includes(v);
          // Picking a suggestion or typing a comma adds the tag straight away.
          if (v.endsWith(',')) add(v.slice(0, -1));
          else if (picked) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => text && add(text)}
      />
      <datalist id={listId}>
        {remaining.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="hint">Press Enter or type a comma to add each tag.</p>
    </div>
  );
}
