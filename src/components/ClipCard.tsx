import { Link } from 'react-router-dom';
import { workflow } from '../config/workflow';
import { requiredProgress } from '../data/stage';
import type { Business, Reel, ReelChecklist } from '../data/types';

export function shortName(email: string): string {
  return email.split('@')[0] || email;
}

/** A reel drawn as a clip on its timeline track. */
export function ClipCard({ reel, business, checklist }: { reel: Reel; business?: Business; checklist?: ReelChecklist }) {
  const { done, total } = requiredProgress(workflow, checklist);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Link
      to={`/reel/${encodeURIComponent(reel.id)}`}
      className="clip"
      style={{ ['--biz' as string]: business?.accentColor ?? 'var(--line-strong)' }}
      role="listitem"
    >
      <span className="clip-top">
        <span className="clip-code">{business?.shortCode ?? '???'}</span>
        <span className="clip-progress" aria-label={`${done} of ${total} required steps done`}>
          {done}/{total}
        </span>
      </span>
      <span className="clip-title">{reel.title}</span>
      {reel.tags.length > 0 && (
        <span className="clip-tags">
          {reel.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          {reel.tags.length > 3 && <span className="tag tag-more">+{reel.tags.length - 3}</span>}
        </span>
      )}
      <span className="clip-foot">
        <span className="clip-assignee">{reel.assignee ? shortName(reel.assignee) : 'Unassigned'}</span>
      </span>
      <span className="clip-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}
