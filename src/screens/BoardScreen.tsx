import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipCard } from '../components/ClipCard';
import { FilterBar } from '../components/FilterBar';
import { EMPTY_FILTERS, filterReels, type ReelFilters } from '../data/filters';
import { STAGES, STAGE_LABELS } from '../data/stage';
import type { Reel, Stage } from '../data/types';
import { useData } from '../state/data';

const COMPLETED_PREVIEW = 10;

// Filters survive going into a reel and back. (Saving them in the URL comes in Phase 2.)
let lastFilters: ReelFilters = EMPTY_FILTERS;

const EMPTY_TEXT: Record<Stage, string> = {
  raw: 'No reels in Raw.',
  trimmed: 'No reels in Trimmed. Trim a Raw reel by hand and mark Manual trim done.',
  working: 'No reels in Working. The AI edit moves Trimmed reels here when it starts.',
  completed: 'Nothing completed yet. Finish one from Working.',
};

export function BoardScreen() {
  const { data, loading, loadError, refresh } = useData();
  const [filters, setFiltersState] = useState<ReelFilters>(lastFilters);
  const setFilters = (f: ReelFilters) => {
    lastFilters = f;
    setFiltersState(f);
  };
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedAll, setCompletedAll] = useState(false);

  const businessById = useMemo(() => new Map(data?.businesses.map((b) => [b.id, b])), [data]);
  const assignees = useMemo(
    () => [...new Set((data?.reels ?? []).map((r) => r.assignee).filter(Boolean))].sort(),
    [data],
  );
  const tagNames = useMemo(() => {
    const all = new Set([...(data?.tags ?? []).map((t) => t.tag), ...(data?.reels ?? []).flatMap((r) => r.tags)]);
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [data]);

  if (loading && !data) return <p className="loading">Loading reels…</p>;
  if (!data)
    return (
      <div className="empty-page">
        <h1>Couldn’t load the Reel Tracker</h1>
        <p className="muted">{loadError}</p>
        <button type="button" className="btn btn-primary" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );

  const visible = filterReels(data.reels, filters);
  const byStage = (s: Stage): Reel[] => {
    const rs = visible.filter((r) => r.stage === s);
    // Raw and Working read left to right, oldest first. Completed shows most recent first.
    return s === 'completed'
      ? rs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : rs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };
  const stages = filters.stages.length ? STAGES.filter((s) => filters.stages.includes(s)) : STAGES;
  const filtering = visible.length !== data.reels.length;

  return (
    <div className="board">
      <div className="board-head">
        <h1 className="page-title">Board</h1>
        <p className="muted small">
          {filtering
            ? `${visible.length} of ${data.reels.length} reels match`
            : `${data.reels.length} ${data.reels.length === 1 ? 'reel' : 'reels'}`}
          {loadError && <span className="form-error"> · Couldn’t refresh: {loadError}</span>}
        </p>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        businesses={data.businesses.filter((b) => b.active)}
        tags={tagNames}
        assignees={assignees}
      />

      <div className="timeline">
        {stages.map((stage, i) => {
          const reels = byStage(stage);
          const isCompleted = stage === 'completed';
          const shown = isCompleted && !completedAll ? reels.slice(0, COMPLETED_PREVIEW) : reels;
          const collapsed = isCompleted && !completedOpen;
          const headId = `track-${stage}`;
          return (
            <section key={stage} className={`track track-${stage}`} aria-labelledby={headId}>
              <header className="track-head">
                <span className="track-id" aria-hidden="true">
                  V{i + 1}
                </span>
                <h2 id={headId} className="track-name">
                  {STAGE_LABELS[stage]}
                </h2>
                <span className="track-count">{reels.length}</span>
                {isCompleted && reels.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-quiet btn-small track-toggle"
                    aria-expanded={completedOpen}
                    onClick={() => setCompletedOpen((o) => !o)}
                  >
                    {completedOpen ? 'Hide' : 'Show'}
                  </button>
                )}
              </header>
              {!collapsed && (
                <div className="track-lane" role={shown.length ? 'list' : undefined} aria-labelledby={headId}>
                  {shown.map((r) => (
                    <ClipCard key={r.id} reel={r} business={businessById.get(r.business)} checklist={data.checklists.get(r.id)} />
                  ))}
                  {reels.length === 0 && (
                    <p className="track-empty">
                      {filtering ? `No ${STAGE_LABELS[stage]} reels match these filters.` : EMPTY_TEXT[stage]}
                      {stage === 'raw' && !filtering && (
                        <>
                          {' '}
                          <Link to="/new">Create a new reel</Link>
                        </>
                      )}
                    </p>
                  )}
                  {isCompleted && !completedAll && reels.length > COMPLETED_PREVIEW && (
                    <button type="button" className="clip clip-more" onClick={() => setCompletedAll(true)}>
                      Show all {reels.length}
                    </button>
                  )}
                </div>
              )}
              {collapsed && reels.length > 0 && (
                <p className="track-collapsed muted small">
                  {reels.length} completed {reels.length === 1 ? 'reel' : 'reels'}, hidden.
                </p>
              )}
              {collapsed && reels.length === 0 && <p className="track-empty">{filtering ? 'No Completed reels match these filters.' : EMPTY_TEXT.completed}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
