export function SkeletonText({ width = "100%" }: { width?: string }) {
  return <div className="skeleton skeleton-text" style={{ width }} />;
}

export function SkeletonTitle({ width = "40%" }: { width?: string }) {
  return <div className="skeleton skeleton-title" style={{ width }} />;
}

export function SkeletonBlock({ height = 90 }: { height?: number }) {
  return <div className="skeleton skeleton-block" style={{ height }} />;
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <div className="skeleton skeleton-circle" style={{ width: size, height: size }} />;
}

export function SkeletonCard() {
  return (
    <div className="card">
      <SkeletonTitle />
      <SkeletonText />
      <SkeletonText width="80%" />
      <SkeletonText width="60%" />
    </div>
  );
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-tile" key={i}>
          <SkeletonCircle size={34} />
          <div className="skeleton skeleton-text" style={{ width: "50%", height: 22 }} />
          <SkeletonText width="70%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <SkeletonText />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
