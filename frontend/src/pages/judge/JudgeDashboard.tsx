import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, Gavel, X } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProgressCircle } from "../../components/ui/ProgressCircle";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { useAuth } from "../../auth/AuthContext";
import type { Rubric } from "../../types";

interface AssignmentSchool {
  application_id: string;
  project_title: string;
  status: "SUBMITTED" | "IN_PROGRESS" | "NOT_STARTED";
}

interface Assignment {
  competition_id: string;
  competition_name: string;
  schools_assigned: number;
  completed: number;
  in_progress: number;
  not_started: number;
  completion_pct: number;
  schools: AssignmentSchool[];
}

export function JudgeDashboard() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rubricModalFor, setRubricModalFor] = useState<{ competitionId: string; competitionName: string } | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Assignment[]>("/api/judge/assignments")
      .then((res) => setAssignments(res.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  function openRubric(competitionId: string, competitionName: string) {
    setRubricModalFor({ competitionId, competitionName });
    setRubric(null);
    setRubricError(null);
    api
      .get<Rubric>(`/api/judge/competitions/${competitionId}/rubric`)
      .then((res) => setRubric(res.data))
      .catch((err) => setRubricError(apiErrorMessage(err, "No rubric has been configured for this competition yet.")));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1">Good to see you, {user?.first_name}</h1>
          <p className="text-muted" style={{ margin: 0 }}>Your independent evaluations, ready when you are.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {assignments === null && !error && (
        <div className="grid grid-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {assignments?.length === 0 && (
        <EmptyState icon={<Gavel size={26} />} title="No assignments yet" description="You'll see your assigned schools here once an administrator adds you to a competition." />
      )}

      {assignments?.map((a) => (
        <div className="card" key={a.competition_id}>
          <div className="flex-between" style={{ marginBottom: 22, flexWrap: "wrap", gap: 16 }}>
            <div className="flex gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <ProgressCircle value={a.completion_pct} color="var(--success)" label="complete" />
              <div>
                <h2 className="text-h2" style={{ marginBottom: 4 }}>{a.competition_name}</h2>
                <p className="text-muted" style={{ margin: 0 }}>
                  {a.completed} of {a.schools_assigned} evaluations completed
                  {a.in_progress > 0 && ` · ${a.in_progress} in progress`}
                  {a.not_started > 0 && ` · ${a.not_started} not started`}
                </p>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => openRubric(a.competition_id, a.competition_name)}>
              <ClipboardList size={14} /> View Rubric
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>School / Project</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {a.schools.map((s) => (
                  <tr key={s.application_id}>
                    <td>{s.project_title || "(untitled project)"}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      <Link className="btn btn-primary btn-sm" to={`/judge/applications/${s.application_id}`}>
                        {s.status === "NOT_STARTED" ? "Start Evaluation" : s.status === "SUBMITTED" ? "View" : "Continue"}
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {rubricModalFor && (
        <div className="modal-overlay" onClick={() => setRubricModalFor(null)} role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ marginBottom: 2 }}>Judging Rubric</h3>
                <p className="text-caption" style={{ margin: 0 }}>{rubricModalFor.competitionName}</p>
              </div>
              <button className="icon-btn" aria-label="Close" onClick={() => setRubricModalFor(null)}>
                <X size={18} />
              </button>
            </div>

            {!rubric && !rubricError && <p className="text-muted">Loading...</p>}
            {rubricError && <p className="error-text">{rubricError}</p>}

            {rubric && (
              <div style={{ marginTop: 8 }}>
                {rubric.criteria.map((c) => (
                  <div className="criterion-block" key={c.id}>
                    <div className="criterion-top">
                      <strong style={{ fontSize: "0.92rem" }}>{c.name}</strong>
                      <span className="text-caption">Weight {(c.weight * 100).toFixed(0)}%</span>
                    </div>
                    {c.description && <p className="text-caption" style={{ margin: "0 0 4px" }}>{c.description}</p>}
                    <p className="text-caption" style={{ margin: 0 }}>
                      Score range: {c.minimum_score}–{c.maximum_score}
                    </p>
                  </div>
                ))}
                <div className="flex-between" style={{ paddingTop: 10, marginTop: 4, borderTop: "1px solid var(--border)" }}>
                  <strong>Total weight</strong>
                  <strong>{rubric.criteria.reduce((sum, c) => sum + c.weight, 0) * 100}%</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
