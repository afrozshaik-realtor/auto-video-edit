/** URL- and folder-safe slug: "First-time buyer mistakes!" → "first-time-buyer-mistakes". */
export function slugify(title: string, maxLength = 48): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/g, '') || 'reel';
}

/** Local date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Reel folder name: YYYY-MM-DD_<BUSINESS>_<slug>. */
export function reelFolderName(date: Date, shortCode: string, title: string): string {
  return `${localDate(date)}_${shortCode.toUpperCase()}_${slugify(title)}`;
}

/** Short, sortable, collision-resistant id, e.g. "r-lq3k2m-8f2a". */
export function newReelId(now: Date = new Date()): string {
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `r-${now.getTime().toString(36)}-${rand}`;
}
