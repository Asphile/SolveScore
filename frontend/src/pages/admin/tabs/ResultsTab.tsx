import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, Search, Trophy } from "lucide-react";
import { api, apiErrorMessage } from "../../../api/client";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PlacementBadge } from "../../../components/ui/PlacementBadge";
import { SkeletonBlock } from "../../../components/ui/Skeleton";
import { useToast } from "../../../hooks/useToast";
import type { CommandCenterContext } from "../CompetitionCommandCenter";

interface ResultRow {
  application_id: string;
  school_name: string;
  project_title: string;
  judges_completed: number;
  judges_total: number;
  average_score: number | null;
  complete: boolean;
  rank: number | null;
}

export function ResultsTab() {
  const { competition } = useOutletContext<CommandCenterContext>();
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const toast = useToast();

  async function load() {
    try {
      const res = await api.get<ResultRow[]>(`/api/admin/results?competition_id=${competition.id}`);
      setResults(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id]);

  async function download(path: string, filename: string) {
    setDownloading(path);
    try {
      const response = await api.get(path, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.show("Report downloaded", "success");
    } catch (err) {
      toast.show(apiErrorMessage(err, "Could not generate report"), "error");
    } finally {
      setDownloading(null);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (results === null) return <SkeletonBlock height={320} />;

  const filtered = results.filter(
    (r) => r.school_name.toLowerCase().includes(query.toLowerCase()) || r.project_title.toLowerCase().includes(query.toLowerCase())
  );
  const complete = results.length > 0 && results.every((r) => r.complete);

  return (
    <div>
      <div className="card">
        <div className="page-header" style={{ marginBottom: 14 }}>
          <div>
            <h3 className="text-h3">Official Leaderboard</h3>
            <p className="text-caption" style={{ margin: 0 }}>{complete ? "Judging complete" : "Judging in progress — averages update live"}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" disabled={downloading !== null} onClick={() => download(`/api/admin/reports/score-report.csv?competition_id=${competition.id}`, "score_report.csv")}>
              <Download size={14} /> CSV
            </button>
            <button className="btn btn-outline btn-sm" disabled={downloading !== null} onClick={() => download(`/api/admin/reports/score-report.pdf?competition_id=${competition.id}`, "score_report.pdf")}>
              <Download size={14} /> PDF
            </button>
          </div>
        </div>

        <div className="form-group" style={{ maxWidth: 320, position: "relative", marginBottom: 16 }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-faint)" }}>
            <Search size={16} />
          </span>
          <input style={{ paddingLeft: 36 }} placeholder="Search school or project" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {results.length === 0 ? (
          <EmptyState icon={<Trophy size={24} />} title="No approved schools yet" description="Approve applications to start seeing results here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>School</th>
                  <th>Project</th>
                  <th>Judges Completed</th>
                  <th>Average Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.application_id}>
                    <td style={{ fontWeight: 700 }}>
                      {r.rank !== null ? (r.rank <= 3 ? <PlacementBadge rank={r.rank} /> : r.rank) : "—"}
                    </td>
                    <td>{r.school_name}</td>
                    <td>{r.project_title || "—"}</td>
                    <td>
                      {r.judges_completed}/{r.judges_total}{" "}
                      {!r.complete && <span className="badge badge-orange">Incomplete</span>}
                    </td>
                    <td style={{ fontWeight: 700 }}>{r.average_score !== null ? r.average_score.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-h3">Additional Reports</h3>
        <div className="grid grid-3">
          <div className="card" style={{ margin: 0 }}>
            <h4 style={{ marginTop: 0 }}>Competition Report</h4>
            <p className="text-caption">Applications, statuses and participation overview.</p>
            <button
              className="btn btn-outline btn-sm"
              disabled={downloading !== null}
              onClick={() => download(`/api/admin/reports/competition-report.csv?competition_id=${competition.id}`, "competition_report.csv")}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <h4 style={{ marginTop: 0 }}>Audit Report</h4>
            <p className="text-caption">Full system activity log.</p>
            <button className="btn btn-outline btn-sm" disabled={downloading !== null} onClick={() => download("/api/admin/reports/audit-report.csv", "audit_report.csv")}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
