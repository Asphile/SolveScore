import { Trophy } from "lucide-react";

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function PlacementBadge({ rank, withIcon = true }: { rank: number; withIcon?: boolean }) {
  const cls = rank === 1 ? "badge-gold" : rank === 2 ? "badge-silver" : rank === 3 ? "badge-bronze" : "badge-gray";
  return (
    <span className={`badge ${cls}`}>
      {withIcon && <Trophy size={12} />}
      {ordinal(rank)} Place
    </span>
  );
}

export function PlacementBanner({ rank }: { rank: number }) {
  if (rank > 3) return null;
  const title = rank === 1 ? `${ordinal(rank)} Place — Winner!` : `${ordinal(rank)} Place`;
  const sub =
    rank === 1
      ? "Congratulations — your project ranked highest across all judges in this competition."
      : "Congratulations on a top-3 finish in this competition.";
  return (
    <div className={`placement-banner place-${rank}`}>
      <span className="placement-banner-icon">
        <Trophy size={26} />
      </span>
      <div>
        <p className="placement-banner-title">{title}</p>
        <p className="placement-banner-sub">{sub}</p>
      </div>
    </div>
  );
}
