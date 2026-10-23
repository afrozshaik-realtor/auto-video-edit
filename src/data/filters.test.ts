import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeFilterCount, filterReels } from './filters';
import { makeReel } from './fixtures';
import type { Reel } from './types';

const base: Reel = makeReel({ id: '', business: '', stage: 'raw', driveFolderId: '', title: '' });
const reels: Reel[] = [
  { ...base, id: 'a', title: 'First-time buyer mistakes', business: 'tce', tags: ['buyers', 'tips'], stage: 'raw', assignee: 'sam@x.com' },
  { ...base, id: 'b', title: 'Basement permits', business: 'amb', tags: ['permits'], stage: 'working', assignee: 'afroz@x.com' },
  { ...base, id: 'c', title: 'Phishing red flags', business: 'drc', tags: ['tips', 'email'], stage: 'completed', assignee: 'sam@x.com' },
];
const ids = (rs: Reel[]) => rs.map((r) => r.id);

describe('filterReels', () => {
  it('returns everything with no filters', () => {
    expect(ids(filterReels(reels, EMPTY_FILTERS))).toEqual(['a', 'b', 'c']);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });
  it('filters by business and stage', () => {
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, businesses: ['tce', 'drc'] }))).toEqual(['a', 'c']);
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, stages: ['working'] }))).toEqual(['b']);
  });
  it('matches tags with any or all, case-insensitively', () => {
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, tags: ['Tips', 'permits'] }))).toEqual(['a', 'b', 'c']);
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, tags: ['tips', 'email'], tagMode: 'all' }))).toEqual(['c']);
  });
  it('filters by assignee and search text', () => {
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, assignee: 'SAM@x.com' }))).toEqual(['a', 'c']);
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, search: 'basement' }))).toEqual(['b']);
    expect(ids(filterReels(reels, { ...EMPTY_FILTERS, search: 'email' }))).toEqual(['c']);
  });
  it('combines filters', () => {
    const f = { ...EMPTY_FILTERS, tags: ['tips'], assignee: 'sam@x.com', stages: ['raw' as const] };
    expect(ids(filterReels(reels, f))).toEqual(['a']);
    expect(activeFilterCount(f)).toBe(3);
  });
});
