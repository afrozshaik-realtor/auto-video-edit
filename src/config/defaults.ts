// Seed data written to the Sheet by the first-run setup screen.
// After setup, businesses live in the Sheet's `Businesses` tab.

import type { Business } from '../data/types';

export const DEFAULT_STYLE_RULES = `# Reel Style Rules
## Canvas
- 1080x1920, 30 fps.
- Safe area: keep text out of the top 220px, the bottom 380px and the right 140px.
## Type
- Key words: a serif italic, big, one per sentence.
- Support words: a clean sans, semibold, small.
- Max 3 words on screen. Never over my face.
## Color
- Brand colors: [replace with this business's hex codes]
## Motion
- Fast in (0.2-0.35s), hold, clean out. One idea per scene, fired on its word.
- Text behind me (cut-out) for hooks and big words. Push-ins max 6%.
## Sound
- Hit on the hook, tap on clicks, whoosh on scene changes, chime to close.
- Voice always on top. Master to -14 LUFS, peaks under -1 dB.
## Don't
- No white sticker outline. No emoji captions. Max 2 fonts on screen.
`;

export const SEED_BUSINESSES: Business[] = [
  { id: 'amb', name: 'AM Builders', shortCode: 'AMB', accentColor: '#C2571A', styleRulesMd: DEFAULT_STYLE_RULES, active: true },
  { id: 'tce', name: 'TCE (Real Estate)', shortCode: 'TCE', accentColor: '#2F5FD0', styleRulesMd: DEFAULT_STYLE_RULES, active: true },
  { id: 'drc', name: 'Dr Cyber', shortCode: 'DRC', accentColor: '#14835F', styleRulesMd: DEFAULT_STYLE_RULES, active: true },
];

export const DRIVE_FOLDER_NAMES = {
  root: 'Reels',
  raw: '01 Raw Videos',
  working: '02 Working Videos',
  completed: '03 Completed Videos',
} as const;

/** Subfolders created inside every reel folder. */
export const REEL_SUBFOLDERS = ['raw', 'broll', 'project', 'final'] as const;

export const SHEET_TITLE = 'Reel Tracker';
