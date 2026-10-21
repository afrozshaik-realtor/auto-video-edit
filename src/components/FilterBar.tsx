import { useId, useState } from 'react';
import { activeFilterCount, EMPTY_FILTERS, type ReelFilters } from '../data/filters';
import { STAGES, STAGE_LABELS } from '../data/stage';
import type { Business, Stage } from '../data/types';
import { shortName } from './ClipCard';
import { Icon } from './Icon';

interface Props {
  filters: ReelFilters;
  onChange: (f: ReelFilters) => void;
  businesses: Business[];
  tags: string[];
  assignees: string[];
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterBar({ filters, onChange, businesses, tags, assignees }: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const count = activeFilterCount({ ...filters, search: '' });
  const set = (patch: Partial<ReelFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Search reels</span>
          <input
            type="search"
            placeholder="Search titles, tags, notes"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="sliders" size={16} />
          Filters{count > 0 && <span className="count-badge">{count}</span>}
        </button>
        {(count > 0 || filters.search) && (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>

      <div id={panelId} className="filter-panel" hidden={!open}>
        <fieldset className="filter-group">
          <legend>Business</legend>
          <div className="chips">
            {businesses.map((b) => (
              <button
                key={b.id}
                type="button"
                className="chip"
                aria-pressed={filters.businesses.includes(b.id)}
                onClick={() => set({ businesses: toggle(filters.businesses, b.id) })}
                style={{ ['--biz' as string]: b.accentColor }}
              >
                <span className="biz-dot" aria-hidden="true" />
                {b.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend>Stage</legend>
          <div className="chips">
            {STAGES.map((s: Stage) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={filters.stages.includes(s)}
                onClick={() => set({ stages: toggle(filters.stages, s) })}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend>Tags</legend>
          {tags.length === 0 ? (
            <p className="muted small">No tags yet. Add them when you create a reel.</p>
          ) : (
            <>
              <div className="chips">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    aria-pressed={filters.tags.includes(t)}
                    onClick={() => set({ tags: toggle(filters.tags, t) })}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {filters.tags.length > 1 && (
                <div className="segmented" role="radiogroup" aria-label="Tag matching">
                  {(['any', 'all'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={filters.tagMode === m}
                      onClick={() => set({ tagMode: m })}
                    >
                      {m === 'any' ? 'Match any tag' : 'Match all tags'}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </fieldset>

        <div className="filter-group">
          <label className="field-label" htmlFor={`${panelId}-assignee`}>
            Assignee
          </label>
          <select
            id={`${panelId}-assignee`}
            className="input input-small"
            value={filters.assignee}
            onChange={(e) => set({ assignee: e.target.value })}
          >
            <option value="">Anyone</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {shortName(a)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
