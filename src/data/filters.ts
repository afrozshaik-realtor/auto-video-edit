import type { Reel, Stage } from './types';

export interface ReelFilters {
  businesses: string[];
  tags: string[];
  tagMode: 'any' | 'all';
  stages: Stage[];
  assignee: string;
  search: string;
}

export const EMPTY_FILTERS: ReelFilters = {
  businesses: [],
  tags: [],
  tagMode: 'any',
  stages: [],
  assignee: '',
  search: '',
};

export function activeFilterCount(f: ReelFilters): number {
  return (
    (f.businesses.length ? 1 : 0) +
    (f.tags.length ? 1 : 0) +
    (f.stages.length ? 1 : 0) +
    (f.assignee ? 1 : 0) +
    (f.search.trim() ? 1 : 0)
  );
}

const norm = (s: string) => s.trim().toLowerCase();

export function filterReels(reels: Reel[], f: ReelFilters): Reel[] {
  const wantTags = f.tags.map(norm);
  const q = norm(f.search);
  return reels.filter((r) => {
    if (f.businesses.length && !f.businesses.includes(r.business)) return false;
    if (f.stages.length && !f.stages.includes(r.stage)) return false;
    if (f.assignee && norm(r.assignee) !== norm(f.assignee)) return false;
    if (wantTags.length) {
      const has = new Set(r.tags.map(norm));
      const ok = f.tagMode === 'all' ? wantTags.every((t) => has.has(t)) : wantTags.some((t) => has.has(t));
      if (!ok) return false;
    }
    if (q) {
      const hay = [r.title, r.notes, r.assignee, ...r.tags].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
