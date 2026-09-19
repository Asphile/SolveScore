import { Eye, Trash2 } from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import type { ResourceItem } from "../../types";

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function FileCard({ resource, removable, onRemove, onView, showAiStatus = true }: {
  resource: ResourceItem;
  removable?: boolean;
  onRemove?: () => void;
  onView: (resource: ResourceItem) => void;
  showAiStatus?: boolean;
}) {
  return (
    <div className="file-card">
      <span className="file-card-icon">{resource.file_type.slice(0, 4).toUpperCase()}</span>
      <div className="file-card-body">
        <button
          className="file-card-name"
          style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit" }}
          onClick={() => onView(resource)}
        >
          {resource.original_filename}
        </button>
        <div className="file-card-meta">
          <span>{formatSize(resource.file_size)}</span>
          {showAiStatus && (resource.resource_type === "DOCUMENT" || resource.resource_type === "PRESENTATION") && (
            <StatusBadge status={resource.ai_analysis_status} />
          )}
        </div>
      </div>
      <div className="file-card-actions">
        <button className="icon-btn" onClick={() => onView(resource)} aria-label="View file">
          <Eye size={15} />
        </button>
        {removable && (
          <button className="icon-btn" onClick={onRemove} aria-label="Remove file">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
