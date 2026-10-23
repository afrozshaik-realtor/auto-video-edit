// Test helper: a reel with every field filled in, overridable per test.

import type { Reel } from './types';

export function makeReel(over: Partial<Reel> = {}): Reel {
  return {
    id: 'r-1', title: 'Test', business: 'tce', tags: [], stage: 'working', assignee: '',
    createdBy: '', createdAt: '', updatedAt: '', driveFolderId: 'f', finalVideoLink: '',
    postedUrl: '', postDate: '', notes: '', aiStatus: '', aiDetail: '', aiUpdatedAt: '',
    aiRuns: 0, aiNotes: '', caption: '', ...over,
  };
}
