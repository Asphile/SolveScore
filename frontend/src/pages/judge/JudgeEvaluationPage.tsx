import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, CloudOff, RefreshCw, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { Application, Evaluation, ResourceItem, Rubric } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { AIReportPanel } from "../../components/ui/AIReportPanel";
import { FileCard } from "../../components/ui/FileCard";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { ResourceViewerModal } from "../../components/ui/ResourceViewerModal";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";

interface OfflineDraft {
  scores: Record<string, number>;
  strengths: string;
  improvements: string;
  comments: string;
  savedAt: string;
}

function draftKey(applicationId: string): string {
  return `solvescore_draft_${applicationId}`;
}
function readOfflineDraft(applicationId: string): OfflineDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(applicationId));
    return raw ? (JSON.parse(raw) as OfflineDraft) : null;
  } catch {
    return null;
  }
}
function writeOfflineDraft(applicationId: string, draft: OfflineDraft): void {
  try {
    localStorage.setItem(draftKey(applicationId), JSON.stringify(draft));
  } catch {
    // best-effort only -- browser storage may be unavailable (private mode, quota, etc.)
  }
}
function clearOfflineDraft(applicationId: string): void {
  try {
    localStorage.removeItem(draftKey(applicationId));
  } catch {
    // ignore
  }
}

export function JudgeEvaluationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [application, setApplication] = useState<Application | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [hasPendingLocalChanges, setHasPendingLocalChanges] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewerResource, setViewerResource] = useState<ResourceItem | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const appRes = await api.get<Application>(`/api/judge/applications/${id}`);
        setApplication(appRes.data);

        const [rubricRes, resourceRes, evalRes] = await Promise.all([
          api.get<Rubric>(`/api/judge/competitions/${appRes.data.competition_id}/rubric`),
          api.get<ResourceItem[]>(`/api/applications/${id}/resources`),
          api.get<Evaluation | null>(`/api/judge/applications/${id}/evaluation`),
        ]);
        setRubric(rubricRes.data);
        setResources(resourceRes.data);
        if (evalRes.data) {
          setEvaluation(evalRes.data);
          setStrengths(evalRes.data.strengths);
          setImprovements(evalRes.data.improvements);
          setComments(evalRes.data.comments);
          const initialScores: Record<string, number> = {};
          evalRes.data.scores.forEach((s) => (initialScores[s.criterion_id] = s.score));
          setScores(initialScores);
        }

        const offlineDraft = readOfflineDraft(id);
        if (offlineDraft && evalRes.data?.status !== "SUBMITTED") {
          setScores(offlineDraft.scores);
          setStrengths(offlineDraft.strengths);
          setImprovements(offlineDraft.improvements);
          setComments(offlineDraft.comments);
          setHasPendingLocalChanges(true);
        }
      } catch (err) {
        setLoadError(apiErrorMessage(err, "Could not load this evaluation"));
      } finally {
        hydrated.current = true;
      }
    })();
  }, [id]);

  useEffect(() => {
    function goOnline() {
      setIsOffline(false);
    }
    function goOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!id || !hydrated.current || evaluation?.status === "SUBMITTED") return;
    writeOfflineDraft(id, { scores, strengths, improvements, comments, savedAt: new Date().toISOString() });
  }, [id, scores, strengths, improvements, comments, evaluation?.status]);

  useEffect(() => {
    if (!isOffline && hasPendingLocalChanges && application) {
      saveDraft(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  useEffect(() => {
    if (evaluation?.status === "SUBMITTED") return;
    const interval = setInterval(() => {
      if (hasPendingLocalChanges && !isOffline && application) {
        saveDraft(true);
      }
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPendingLocalChanges, isOffline, application, evaluation?.status]);

  const locked = evaluation?.status === "SUBMITTED";
  const contributions = rubric
    ? rubric.criteria.map((c) => {
        const score = scores[c.id];
        const contribution = score !== undefined ? (score / c.maximum_score) * c.weight * 100 : 0;
        return { criterion: c, score, contribution };
      })
    : [];
  const weightedTotal = contributions.reduce((sum, c) => sum + c.contribution, 0);
  const allScored = rubric ? rubric.criteria.every((c) => scores[c.id] !== undefined) : false;

  async function saveDraft(silent = false) {
    if (!application || !rubric || !id) return;
    if (!silent) setSaving(true);
    setError(null);
    try {
      const response = await api.post<Evaluation>("/api/evaluations", {
        application_id: application.id,
        scores: Object.entries(scores).map(([criterion_id, score]) => ({ criterion_id, score })),
        strengths,
        improvements,
        comments,
      });
      setEvaluation(response.data);
      setSaved(new Date().toLocaleTimeString());
      setHasPendingLocalChanges(false);
      clearOfflineDraft(id);
      if (!silent) toast.show("Draft saved", "success");
    } catch (err) {
      const isNetworkFailure = !(err as { response?: unknown })?.response;
      if (isNetworkFailure) {
        setIsOffline(true);
        setHasPendingLocalChanges(true);
      } else if (!silent) {
        setError(apiErrorMessage(err, "Could not save draft"));
      }
    } finally {
      if (!silent) setSaving(false);
    }
  }

  async function submitEvaluation() {
    setSaving(true);
    setError(null);
    try {
      const draft = await api.post<Evaluation>("/api/evaluations", {
        application_id: application!.id,
        scores: Object.entries(scores).map(([criterion_id, score]) => ({ criterion_id, score })),
        strengths,
        improvements,
        comments,
      });
      const response = await api.post<Evaluation>(`/api/evaluations/${draft.data.id}/submit`);
      setEvaluation(response.data);
      setHasPendingLocalChanges(false);
      if (id) clearOfflineDraft(id);
      setConfirmOpen(false);
      toast.show("Evaluation submitted and locked", "success");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit evaluation"));
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/judge")}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
        <EmptyState
          tone="error"
          title="Couldn't load this evaluation"
          description={loadError}
          action={
            <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
              Try Again
            </button>
          }
        />
      </div>
    );
  }

  if (!application || !rubric) return <SkeletonBlock height={360} />;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/judge")}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <div className="page-header">
        <div>
          <h1 className="text-h1">{application.project_title || "(untitled project)"}</h1>
          <p className="text-muted" style={{ margin: 0 }}>{application.category || "Uncategorized"}</p>
        </div>
        {evaluation && <StatusBadge status={evaluation.status} />}
      </div>

      <div className="judging-layout">
        {/* LEFT: application content */}
        <div>
          <div className="card">
            <h3 className="text-h3">Problem</h3>
            <p className="text-body">{application.problem_description || "—"}</p>
            <h3 className="text-h3">Solution</h3>
            <p className="text-body">{application.solution_description || "—"}</p>
            <h3 className="text-h3">Innovation</h3>
            <p className="text-body">{application.innovation_description || "—"}</p>
            <h3 className="text-h3">Impact</h3>
            <p className="text-body">{application.impact_description || "—"}</p>
            <h3 className="text-h3">Implementation Plan</h3>
            <p className="text-body">{application.implementation_plan || "—"}</p>
          </div>

          <div className="card">
            <h3 className="text-h3 flex gap-1" style={{ alignItems: "center" }}>
              <Users size={16} /> Team
            </h3>
            {application.team_members.length === 0 && <p className="helper-text">No team members listed.</p>}
            {application.team_members.map((m, i) => (
              <div key={i} className="flex-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span>{m.name}</span>
                <span className="text-caption">{m.role} · {m.grade}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="text-h3">Resources</h3>
            {resources.map((r) => (
              <FileCard key={r.id} resource={r} onView={setViewerResource} />
            ))}
            {resources.length === 0 && <p className="helper-text">No resources uploaded.</p>}
          </div>

          <div className="card">
            {id && <AIReportPanel applicationId={id} />}
          </div>
        </div>

        {/* RIGHT: sticky evaluation panel */}
        <div className="judging-panel-sticky">
          <div className="card">
            <h3 className="text-h3">Evaluation</h3>

            {locked && (
              <div className="card" style={{ background: "var(--success-soft)", padding: 14 }}>
                <span className="success-text"><Check size={14} /> Submitted and locked.</span> Contact an administrator to reopen it.
              </div>
            )}

            {contributions.map(({ criterion, score, contribution }) => (
              <div className="criterion-block" key={criterion.id}>
                <div className="criterion-top">
                  <strong style={{ fontSize: "0.92rem" }}>{criterion.name}</strong>
                  <span className="text-caption">Weight {(criterion.weight * 100).toFixed(0)}%</span>
                </div>
                {criterion.description && <p className="text-caption" style={{ margin: "0 0 8px" }}>{criterion.description}</p>}
                <div className="score-selector">
                  {Array.from({ length: criterion.maximum_score - criterion.minimum_score + 1 }, (_, i) => criterion.minimum_score + i).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`score-pip ${score === v ? "selected" : ""}`}
                      disabled={locked}
                      onClick={() => {
                        setScores((s) => ({ ...s, [criterion.id]: v }));
                        setHasPendingLocalChanges(true);
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {score !== undefined && (
                  <div className="criterion-contribution">
                    {score} / {criterion.maximum_score} · contributes {contribution.toFixed(1)} points
                  </div>
                )}
              </div>
            ))}

            <div className="flex-between" style={{ padding: "14px 0", borderTop: "2px solid var(--border)", marginTop: 4 }}>
              <span className="text-h3" style={{ margin: 0 }}>Total</span>
              <span className="text-h1" style={{ margin: 0, color: allScored ? "var(--accent)" : "var(--text-faint)" }}>
                {allScored ? weightedTotal.toFixed(1) : "—"} / 100
              </span>
            </div>

            <div className="form-group">
              <label>Strengths</label>
              <textarea disabled={locked} value={strengths} onChange={(e) => { setStrengths(e.target.value); setHasPendingLocalChanges(true); }} />
            </div>
            <div className="form-group">
              <label>Areas for Improvement</label>
              <textarea disabled={locked} value={improvements} onChange={(e) => { setImprovements(e.target.value); setHasPendingLocalChanges(true); }} />
            </div>
            <div className="form-group">
              <label>Additional Comments</label>
              <textarea disabled={locked} value={comments} onChange={(e) => { setComments(e.target.value); setHasPendingLocalChanges(true); }} />
            </div>

            {isOffline && (
              <p className="error-text"><CloudOff size={14} /> Offline — saved locally, will sync automatically.</p>
            )}
            {!isOffline && hasPendingLocalChanges && !saving && (
              <p className="helper-text"><RefreshCw size={13} /> Synchronizing...</p>
            )}
            {error && <p className="error-text">{error}</p>}
            {saved && !error && !hasPendingLocalChanges && <p className="success-text">✓ Saved {saved}</p>}

            {!locked && (
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <button className="btn btn-outline" disabled={saving} onClick={() => saveDraft()}>
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button className="btn btn-cyan btn-block" disabled={saving || !allScored} onClick={() => setConfirmOpen(true)}>
                  Submit Evaluation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit evaluation?"
        description="After submission your evaluation will be locked unless an administrator reopens it."
        confirmLabel="Submit Evaluation"
        busy={saving}
        onConfirm={submitEvaluation}
        onCancel={() => setConfirmOpen(false)}
      >
        <div style={{ margin: "16px 0" }}>
          {contributions.map(({ criterion, score }) => (
            <div className="checklist-item" key={criterion.id}>
              <span className={`checklist-check ${score !== undefined ? "done" : "pending"}`}>
                <Check size={12} />
              </span>
              {criterion.name}
            </div>
          ))}
          <div className="flex-between" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <strong>Final Score</strong>
            <strong style={{ color: "var(--accent)" }}>{weightedTotal.toFixed(1)} / 100</strong>
          </div>
        </div>
      </ConfirmDialog>

      <ResourceViewerModal resource={viewerResource} onClose={() => setViewerResource(null)} />
    </div>
  );
}
