import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, Eye, FileText, XCircle } from "lucide-react";
import { api, apiErrorMessage } from "../../../api/client";
import type { Application, ResourceItem } from "../../../types";
import { StatusBadge } from "../../../components/StatusBadge";
import { AIReportPanel } from "../../../components/ui/AIReportPanel";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ResourceViewerModal } from "../../../components/ui/ResourceViewerModal";
import { SkeletonCard } from "../../../components/ui/Skeleton";
import { useToast } from "../../../hooks/useToast";
import type { CommandCenterContext } from "../CompetitionCommandCenter";

export function ApplicationsTab() {
  const { competition } = useOutletContext<CommandCenterContext>();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewerResource, setViewerResource] = useState<ResourceItem | null>(null);
  const toast = useToast();

  async function load() {
    try {
      const res = await api.get<Application[]>(`/api/admin/applications?competition_id=${competition.id}`);
      setApplications(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id]);

  async function expand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setNotes("");
    try {
      const res = await api.get<ResourceItem[]>(`/api/applications/${id}/resources`);
      setResources(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function decide(id: string, action: "approve" | "reject" | "request-changes") {
    setBusy(true);
    try {
      await api.post(`/api/admin/applications/${id}/${action}`, { notes });
      setExpandedId(null);
      await load();
      toast.show(
        action === "approve" ? "Application approved" : action === "reject" ? "Application rejected" : "Changes requested",
        action === "reject" ? "info" : "success"
      );
    } catch (err) {
      toast.show(apiErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (applications === null) {
    return (
      <div className="grid grid-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (applications.length === 0) {
    return <EmptyState icon={<FileText size={26} />} title="No applications yet" description="Applications will appear here once schools submit them." />;
  }

  return (
    <div>
      {applications.map((app) => (
        <div className="card" key={app.id}>
          <div className="flex-between">
            <div>
              <strong>{app.project_title || "(untitled project)"}</strong>
              <div className="text-caption">Updated {new Date(app.updated_at).toLocaleString()}</div>
            </div>
            <StatusBadge status={app.status} />
          </div>

          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => expand(app.id)}>
            {expandedId === app.id ? "Hide Details" : "Review"}
          </button>

          {expandedId === app.id && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <p>
                <strong>Problem:</strong> {app.problem_description || "—"}
              </p>
              <p>
                <strong>Solution:</strong> {app.solution_description || "—"}
              </p>

              <h4>Resources</h4>
              {resources.length === 0 && <p className="helper-text">No resources uploaded.</p>}
              {resources.map((r) => (
                <button key={r.id} className="btn btn-outline btn-sm" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => setViewerResource(r)}>
                  <Eye size={13} /> {r.original_filename}
                </button>
              ))}

              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <AIReportPanel applicationId={app.id} canManage />
              </div>

              {(app.status === "SUBMITTED" || app.status === "UNDER_REVIEW") && (
                <div style={{ marginTop: 16 }}>
                  <div className="form-group">
                    <label>Review Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Required for 'Request Changes'" />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(app.id, "approve")}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => decide(app.id, "request-changes")}>
                      Request Changes
                    </button>
                    <button className="btn btn-danger-outline btn-sm" disabled={busy} onClick={() => decide(app.id, "reject")}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <ResourceViewerModal resource={viewerResource} onClose={() => setViewerResource(null)} />
    </div>
  );
}
