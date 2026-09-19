import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "empty" | "error";
}

export function EmptyState({ icon, title, description, action, tone = "empty" }: EmptyStateProps) {
  return (
    <div className="state-panel">
      <span className={`state-icon ${tone === "error" ? "error-tone" : ""}`}>
        {icon ?? (tone === "error" ? <AlertCircle size={26} /> : <Inbox size={26} />)}
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
