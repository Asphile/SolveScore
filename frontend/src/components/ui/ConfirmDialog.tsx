import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex gap-2" style={{ alignItems: "flex-start" }}>
            {tone === "danger" && (
              <span className="state-icon error-tone" style={{ width: 36, height: 36, marginBottom: 0, flexShrink: 0 }}>
                <AlertTriangle size={18} />
              </span>
            )}
            <div>
              <h3 id="confirm-dialog-title" style={{ marginBottom: 4 }}>
                {title}
              </h3>
              {description && <p className="text-muted" style={{ fontSize: "0.87rem", margin: 0 }}>{description}</p>}
            </div>
          </div>
        </div>
        {children}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
