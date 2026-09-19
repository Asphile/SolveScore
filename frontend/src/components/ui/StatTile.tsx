import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface StatTileProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  trend?: { direction: "up" | "down"; text: string };
}

export function StatTile({ icon, value, label, trend }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-top">
        <span className="stat-tile-icon">{icon}</span>
        {trend && (
          <span className={`trend ${trend.direction === "up" ? "trend-up" : "trend-down"}`}>
            {trend.direction === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {trend.text}
          </span>
        )}
      </div>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
