import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Loader2,
  Lock,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";

const COLORS: Record<string, string> = {
  DRAFT: "badge-gray",
  SUBMITTED: "badge-blue",
  UNDER_REVIEW: "badge-blue",
  CHANGES_REQUESTED: "badge-orange",
  APPROVED: "badge-green",
  REJECTED: "badge-red",
  JUDGING: "badge-cyan",
  COMPLETED: "badge-green",
  IN_PROGRESS: "badge-orange",
  NOT_STARTED: "badge-gray",
  LOW: "badge-green",
  MEDIUM: "badge-orange",
  HIGH: "badge-red",
  NOT_CHECKED: "badge-gray",
  PROCESSING: "badge-blue",
  LOW_INDICATION: "badge-green",
  REVIEW_REQUIRED: "badge-orange",
  REVIEWED: "badge-green",
  ERROR: "badge-red",
  PUBLISHED: "badge-blue",
  APPLICATIONS_OPEN: "badge-green",
  APPLICATIONS_CLOSED: "badge-orange",
  JUDGING_OPEN: "badge-cyan",
  JUDGING_CLOSED: "badge-orange",
  RESULTS_FINALIZED: "badge-green",
  ARCHIVED: "badge-gray",
};

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  DRAFT: CircleDashed,
  SUBMITTED: CheckCircle2,
  UNDER_REVIEW: Eye,
  CHANGES_REQUESTED: AlertTriangle,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  JUDGING: Lock,
  COMPLETED: CheckCircle2,
  IN_PROGRESS: Clock,
  NOT_STARTED: CircleDashed,
  LOW: CheckCircle2,
  MEDIUM: AlertTriangle,
  HIGH: ShieldAlert,
  NOT_CHECKED: CircleDashed,
  PROCESSING: Loader2,
  LOW_INDICATION: CheckCircle2,
  REVIEW_REQUIRED: ShieldAlert,
  REVIEWED: CheckCircle2,
  ERROR: XCircle,
};

export function StatusBadge({ status, withIcon = true }: { status: string; withIcon?: boolean }) {
  const cls = COLORS[status] || "badge-gray";
  const Icon = ICONS[status];
  return (
    <span className={`badge ${cls}`}>
      {withIcon && Icon && <Icon size={12} />}
      {status.replace(/_/g, " ")}
    </span>
  );
}
