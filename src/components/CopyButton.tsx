import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older mobile browsers / non-secure contexts.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [
    copied,
    (text) => {
      void copyText(text).then(() => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1800);
      });
    },
  ];
}

export function CopyButton({ text, label = 'Copy', className = 'btn btn-secondary btn-small' }: { text: string; label?: string; className?: string }) {
  const [copied, copy] = useCopied();
  return (
    <button type="button" className={className} onClick={() => copy(text)}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

/** A one-tap copy chip (director notes). */
export function CopyChip({ text, label }: { text: string; label: string }) {
  const [copied, copy] = useCopied();
  return (
    <button type="button" className={`chip chip-copy${copied ? ' is-copied' : ''}`} onClick={() => copy(text)} title={text}>
      <Icon name={copied ? 'check' : 'copy'} size={14} />
      <span>{label}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}
