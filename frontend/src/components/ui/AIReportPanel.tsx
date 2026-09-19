import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { AIApplicationReport } from "../../types";
import { StatusBadge } from "../StatusBadge";
import { useToast } from "../../hooks/useToast";

export function AIReportPanel({ applicationId, canManage = false }: { applicationId: string; canManage?: boolean }) {
  const [report, setReport] = useState<AIApplicationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    try {
      const res = await api.get<AIApplicationReport>(`/api/applications/${applicationId}/ai-report`);
      setReport(res.data);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load AI content report"));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function reanalyze(resourceId: string) {
    setBusyId(resourceId);
    try {
      await api.post(`/api/resources/${resourceId}/analyze`);
      toast.show("AI analysis re-run", "success");
      await load();
    } catch (err) {
      toast.show(apiErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function markReviewed(analysisId: string) {
    setBusyId(analysisId);
    try {
      await api.post(`/api/resources/analysis/${analysisId}/review`, { admin_notes: "" });
      toast.show("Marked as reviewed", "success");
      await load();
    } catch (err) {
      toast.show(apiErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!report) return <p className="helper-text">Loading AI content report...</p>;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 10 }}>
        <h3 className="text-h3 flex gap-1" style={{ alignItems: "center", margin: 0 }}>
          <Sparkles size={15} style={{ color: "var(--ai)" }} /> AI Content Report
        </h3>
        {report.overall_risk && <StatusBadge status={report.overall_risk} />}
      </div>

      {report.items.length === 0 && <p className="helper-text">No resources uploaded yet.</p>}

      {report.items.map((item) => (
        <div key={item.resource_id} className="card" style={{ padding: 12, marginBottom: 8 }}>
          <div className="flex-between">
            <strong style={{ fontSize: "0.9rem" }}>{item.filename}</strong>
            <StatusBadge status={item.ai_status} />
          </div>
          <div className="text-caption" style={{ marginTop: 2 }}>{item.resource_type}</div>

          {item.latest_analysis ? (
            <div style={{ marginTop: 8 }}>
              {item.latest_analysis.confidence !== null && (
                <div className="text-caption">
                  Estimated AI-content likelihood: <strong>{item.latest_analysis.confidence.toFixed(0)}%</strong>
                  {item.latest_analysis.risk_level && (
                    <>
                      {" "}
                      · <StatusBadge status={item.latest_analysis.risk_level} withIcon={false} />
                    </>
                  )}
                </div>
              )}
              {item.latest_analysis.analysis_summary && (
                <p className="text-body" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
                  {item.latest_analysis.analysis_summary}
                </p>
              )}
              {item.latest_analysis.status === "REVIEWED" && (
                <p className="text-caption" style={{ marginTop: 4 }}>
                  Reviewed {item.latest_analysis.reviewed_at ? new Date(item.latest_analysis.reviewed_at).toLocaleString() : ""}
                  {item.latest_analysis.admin_notes && ` — "${item.latest_analysis.admin_notes}"`}
                </p>
              )}
            </div>
          ) : (
            <p className="helper-text" style={{ marginTop: 6 }}>Not yet analyzed.</p>
          )}

          {canManage && (item.resource_type === "DOCUMENT" || item.resource_type === "PRESENTATION" || item.resource_type === "VIDEO") && (
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <button className="btn btn-outline btn-sm" disabled={busyId === item.resource_id} onClick={() => reanalyze(item.resource_id)}>
                <RefreshCw size={13} /> Re-analyze
              </button>
              {item.latest_analysis && item.latest_analysis.status === "REVIEW_REQUIRED" && (
                <button
                  className="btn btn-outline btn-sm"
                  disabled={busyId === item.latest_analysis.id}
                  onClick={() => markReviewed(item.latest_analysis!.id)}
                >
                  Mark Reviewed
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="helper-text" style={{ marginTop: 4 }}>
        AI results are indicators only, requiring human review — they never automatically reject, disqualify, or affect a score.
      </p>
    </div>
  );
}
