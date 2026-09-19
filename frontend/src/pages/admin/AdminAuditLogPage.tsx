import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonBlock } from "../../components/ui/Skeleton";

interface AuditLogRow {
  id: string;
  user_id: string | null;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

function actionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function groupByDay(logs: AuditLogRow[]): Record<string, AuditLogRow[]> {
  const groups: Record<string, AuditLogRow[]> = {};
  for (const log of logs) {
    const day = new Date(log.timestamp).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    (groups[day] ??= []).push(log);
  }
  return groups;
}

export function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    api
      .get<AuditLogRow[]>("/api/admin/audit-logs")
      .then((res) => setLogs(res.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const actions = Array.from(new Set((logs ?? []).map((l) => l.action))).sort();
  const filtered = (logs ?? []).filter((l) => !actionFilter || l.action === actionFilter);
  const grouped = groupByDay(filtered);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1">Audit Log</h1>
          <p className="text-muted" style={{ margin: 0 }}>A complete, tamper-evident record of every significant action in SolveScore.</p>
        </div>
        {logs && logs.length > 0 && (
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {logs === null && !error && <SkeletonBlock height={320} />}

      {logs && logs.length === 0 && (
        <EmptyState icon={<ScrollText size={24} />} title="No activity yet" description="System actions will be recorded here as they happen." />
      )}

      {Object.entries(grouped).map(([day, dayLogs]) => (
        <div className="card" key={day}>
          <h3 className="text-h3">{day}</h3>
          <div className="timeline">
            {dayLogs.map((log) => (
              <div className="timeline-item" key={log.id}>
                <span className="timeline-dot" />
                <div className="timeline-time">
                  {new Date(log.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {log.role || "SYSTEM"}
                </div>
                <div className="timeline-text">
                  {actionLabel(log.action)}
                  {log.entity_type && <span className="text-muted"> · {log.entity_type}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
