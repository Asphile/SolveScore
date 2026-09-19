import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, MessageSquareQuote, Trophy } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { PlacementBanner } from "../../components/ui/PlacementBadge";
import { ProgressCircle } from "../../components/ui/ProgressCircle";
import { SkeletonBlock } from "../../components/ui/Skeleton";

interface CriterionBreakdown {
  criterion_id: string;
  name: string;
  weight: number;
  maximum_score: number;
  average_score: number | null;
}

interface ApplicationResults {
  application_id: string;
  application_status: string;
  competition_status: string;
  judges_total: number;
  judges_completed: number;
  results_visible: boolean;
  average_score: number | null;
  rank: number | null;
  criteria_breakdown: CriterionBreakdown[];
  strengths: string[];
  improvements: string[];
}

export function ApplicationResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ApplicationResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<ApplicationResults>(`/api/school/applications/${id}/results`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <SkeletonBlock height={320} />;

  const completionPct = data.judges_total > 0 ? Math.round((data.judges_completed / data.judges_total) * 100) : 0;

  return (
    <div style={{ maxWidth: 820 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/school")}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <div className="page-header">
        <div>
          <h1 className="text-h1">Progress &amp; Scores</h1>
          <p className="text-muted" style={{ margin: 0 }}>Judging progress and results for your application.</p>
        </div>
        <StatusBadge status={data.application_status} />
      </div>

      <div className="card flex gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <ProgressCircle value={completionPct} color="var(--accent)" label="judged" />
        <div>
          <h3 className="text-h3">Judging Progress</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            {data.judges_completed} of {data.judges_total} assigned judges have submitted an evaluation for your
            project so far.
          </p>
        </div>
      </div>

      {!data.results_visible && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="Results not released yet"
          description="Your score, ranking and judge feedback will appear here automatically once the administrator finalizes results for this competition."
        />
      )}

      {data.results_visible && (
        <>
          {data.rank !== null && <PlacementBanner rank={data.rank} />}

          <div className="grid grid-2">
            <div className="card" style={{ textAlign: "center" }}>
              <div className="text-label">Average Score</div>
              <div className="text-display" style={{ fontSize: "2.6rem", color: "var(--accent)" }}>
                {data.average_score !== null ? data.average_score.toFixed(1) : "—"}
                <span className="text-muted" style={{ fontSize: "1.2rem" }}> / 100</span>
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="text-label">Rank</div>
              <div className="text-display flex gap-1" style={{ fontSize: "2.6rem", color: "var(--accent)", justifyContent: "center", alignItems: "center" }}>
                <Award size={30} />
                {data.rank ?? "—"}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-h3">Score Breakdown</h3>
            {data.criteria_breakdown.map((c) => {
              const pct = c.average_score !== null ? (c.average_score / c.maximum_score) * 100 : 0;
              return (
                <div className="criterion-block" key={c.criterion_id}>
                  <div className="criterion-top">
                    <strong style={{ fontSize: "0.92rem" }}>{c.name}</strong>
                    <span className="text-caption">Weight {(c.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 6 }}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <div className="criterion-contribution">
                    Average {c.average_score !== null ? c.average_score.toFixed(1) : "—"} / {c.maximum_score}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h3 className="text-h3 flex gap-1" style={{ alignItems: "center" }}>
              <MessageSquareQuote size={17} /> Judge Feedback
            </h3>
            <p className="text-caption" style={{ marginBottom: 16 }}>
              Anonymized comments from each judge who evaluated your project.
            </p>

            {data.strengths.length === 0 && data.improvements.length === 0 && (
              <p className="helper-text">No written feedback was provided.</p>
            )}

            {data.strengths.map((s, i) => (
              <div key={`s-${i}`} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                <div className="text-label" style={{ marginBottom: 4 }}>Judge {i + 1} · Strengths</div>
                <p className="text-body" style={{ margin: 0 }}>{s}</p>
                {data.improvements[i] && (
                  <>
                    <div className="text-label" style={{ margin: "8px 0 4px" }}>Areas for Improvement</div>
                    <p className="text-body" style={{ margin: 0 }}>{data.improvements[i]}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
