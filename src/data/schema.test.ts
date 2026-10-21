import { describe, expect, it } from 'vitest';
import { prompts, renderPrompt, getPrompt } from '../config/prompts';
import { reelFolderName, slugify } from './naming';
import {
  TABS,
  businessFromRecord,
  checklistFromRecord,
  indexChecklist,
  recordToRow,
  reelFromRecord,
  reelToRecord,
  rowsToRecords,
} from './schema';

describe('naming', () => {
  it('slugifies titles', () => {
    expect(slugify('First-time buyer mistakes!')).toBe('first-time-buyer-mistakes');
    expect(slugify("Don't skip   the permit")).toBe('dont-skip-the-permit');
    expect(slugify('Café à la carte')).toBe('cafe-a-la-carte');
    expect(slugify('!!!')).toBe('reel');
  });
  it('builds the reel folder name', () => {
    expect(reelFolderName(new Date(2026, 9, 21), 'tce', 'First-time buyer mistakes')).toBe(
      '2026-10-21_TCE_first-time-buyer-mistakes',
    );
  });
});

describe('sheet rows', () => {
  it('reads rows by header name, whatever the column order', () => {
    const { records } = rowsToRecords([
      ['title', 'id', 'tags', 'stage'],
      ['Hello', 'r-1', 'a, b ,,c', 'Working'],
    ]);
    const r = reelFromRecord(records[0]);
    expect(r).toMatchObject({ id: 'r-1', title: 'Hello', tags: ['a', 'b', 'c'], stage: 'working', notes: '' });
  });

  it('round-trips a reel into the sheet header order', () => {
    const { records } = rowsToRecords([[...TABS.Reels], ['r-2', 'T', 'amb', 'x', 'raw']]);
    const reel = reelFromRecord(records[0]);
    const row = recordToRow([...TABS.Reels], reelToRecord(reel));
    expect(row.slice(0, 5)).toEqual(['r-2', 'T', 'amb', 'x', 'raw']);
    expect(row).toHaveLength(TABS.Reels.length);
  });

  it('treats unknown stages as raw and parses booleans', () => {
    expect(reelFromRecord({ stage: 'nonsense' }).stage).toBe('raw');
    expect(checklistFromRecord({ done: 'true' }).done).toBe(true);
    expect(checklistFromRecord({ done: 'FALSE' }).done).toBe(false);
    expect(businessFromRecord({ active: '' }).active).toBe(true);
    expect(businessFromRecord({ active: 'FALSE' }).active).toBe(false);
  });

  it('keeps the last checklist row for duplicate steps', () => {
    const idx = indexChecklist([
      { reelId: 'r', stepId: 's', done: true, doneBy: 'a', doneAt: '', note: '' },
      { reelId: 'r', stepId: 's', done: false, doneBy: 'b', doneAt: '', note: '' },
    ]);
    expect(idx.get('r')?.get('s')?.doneBy).toBe('b');
  });
});

describe('prompts', () => {
  it('leaves no template variables unfilled in any prompt', () => {
    const ctx = { businessName: 'AM Builders', styleRules: '# Rules', reelTitle: 'T', tags: ['a'] };
    for (const p of prompts) expect(renderPrompt(p, ctx), p.id).not.toMatch(/\{\{/);
    expect(renderPrompt(getPrompt('broll-plan')!, ctx)).toContain('AM Builders');
  });

  it('fills in business, rules, title and tags', () => {
    const text = renderPrompt(getPrompt('setup')!, {
      businessName: 'Dr Cyber',
      styleRules: '# Rules\n- one\n',
      reelTitle: 'Phishing red flags',
      tags: [],
    });
    expect(text).toContain('Dr Cyber');
    expect(text).toContain('# Rules\n- one');
    expect(text).toContain('Phishing red flags');
    expect(text).not.toContain('{{');
    expect(renderPrompt(getPrompt('caption')!, { businessName: '', styleRules: '', reelTitle: '', tags: ['a', 'b'] })).toContain(
      'Topics: a, b',
    );
  });
});
