import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { Competition, CompetitionStatus } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";

const LIFECYCLE: { status: CompetitionStatus; label: string; next?: CompetitionStatus; nextLabel?: string }[] = [
  { status: "DRAFT", label: "Draft", next: "PUBLISHED", nextLabel: "Publish" },
  { status: "PUBLISHED", label: "Published", next: "APPLICATIONS_OPEN", nextLabel: "Open Applications" },
  { status: "APPLICATIONS_OPEN", label: "Applications Open", next: "APPLICATIONS_CLOSED", nextLabel: "Close Applications" },
  { status: "APPLICATIONS_CLOSED", label: "Applications Closed", next: "JUDGING_OPEN", nextLabel: "Open Judging" },
  { status: "JUDGING_OPEN", label: "Judging Open", next: "JUDGING_CLOSED", nextLabel: "Close Judging" },
  { status: "JUDGING_CLOSED", label: "Judging Closed", next: "RESULTS_FINALIZED", nextLabel: "Finalize Results" },
  { status: "RESULTS_FINALIZED", label: "Results Finalized" },
];

const TABS = [
  { to: "", label: "Overview", end: true },
  { to: "applications", label: "Applications" },
  { to: "rubric", label: "Rubric" },
  { to: "judges", label: "Judges" },
  { to: "monitoring", label: "Monitoring" },
  { to: "results", label: "Results & Reports" },
];

export interface CommandCenterContext {
  competition: Competition;
  reload: () => void;
}

export function CompetitionCommandCenter() {
  const { id } = useParams<{ id: string }>();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<Competition>(`/api/competitions/${id}`);
      setCompetition(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load this competition"));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(next: CompetitionStatus, label: string) {
    setTransitioning(true);
    try {
      if (next === "RESULTS_FINALIZED") {
        await api.post(`/api/admin/competitions/${id}/finalize`);
      } else {
        await api.put(`/api/competitions/${id}`, { status: next });
      }
      await load();
      toast.show(`${label} complete`, "success");
    } catch (err) {
      toast.show(apiErrorMessage(err), "error");
    } finally {
      setTransitioning(false);
    }
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
        <button className="btn btn-outline" onClick={() => navigate("/admin/competitions")}>
          <ArrowLeft size={15} /> Back to competitions
        </button>
      </div>
    );
  }

  if (!competition) {
    return <SkeletonBlock height={160} />;
  }

  const stage = LIFECYCLE.find((l) => l.status === competition.status);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate("/admin/competitions")}>
        <ArrowLeft size={15} /> All competitions
      </button>

      <div className="surface-feature" style={{ marginBottom: 22 }}>
        <div className="flex-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <StatusBadge status={competition.status} />
            <h1 className="text-h1" style={{ color: "white", marginTop: 10 }}>{competition.name}</h1>
            <p className="text-muted" style={{ maxWidth: 520 }}>{competition.theme || competition.description}</p>
            <div className="flex gap-3" style={{ marginTop: 14, flexWrap: "wrap" }}>
              <span className="floating-stat-card flex gap-1" style={{ alignItems: "center", fontSize: "0.83rem" }}>
                <Users size={15} /> {competition.registered_count} / {competition.max_participants} schools · {competition.spaces_remaining} spaces left
              </span>
              {competition.application_close_date && (
                <span className="floating-stat-card flex gap-1" style={{ alignItems: "center", fontSize: "0.83rem" }}>
                  <Calendar size={15} /> Deadline {new Date(competition.application_close_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {stage?.next && (
            <button className="btn btn-cyan" disabled={transitioning} onClick={() => advance(stage.next!, stage.nextLabel!)}>
              {transitioning ? "Please wait..." : stage.nextLabel}
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ competition, reload: load } satisfies CommandCenterContext} />
    </div>
  );
}
