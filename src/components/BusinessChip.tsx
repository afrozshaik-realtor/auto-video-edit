import type { Business } from '../data/types';

/** The only place a business's accent colour appears, besides the clip stripe. */
export function BusinessChip({ business, full = false }: { business: Business | undefined; full?: boolean }) {
  if (!business) return <span className="biz-chip">Unknown business</span>;
  return (
    <span className="biz-chip" style={{ ['--biz' as string]: business.accentColor }} title={business.name}>
      <span className="biz-dot" aria-hidden="true" />
      {full ? business.name : business.shortCode}
    </span>
  );
}
