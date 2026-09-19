import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, CheckCircle2, Circle, Compass, FileText, Trophy, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { Competition } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { PlacementBadge } from "../../components/ui/PlacementBadge";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../hooks/useToast";

interface MyCompetition {
  competition_id: string;
  competition_name: string;
  competition_status: string;
  application_id: string | null;
  application_status: string | null;
  rank: number | null;
  average_score: number | null;
}

const APPLICATION_STEPS = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"];

export function SchoolDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [available, setAvailable] = useState<Competition[] | null>(null);
  const [joined, setJoined] = useState<MyCompetition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  async function load() {
    try {
      const [allRes, mineRes] = await Promise.all([api.get<Competition[]>("/api/competitions"), api.get<MyCompetition[]>("/api/school/competitions")]);
      setJoined(mineRes.data);
      const joinedIds = new Set(mineRes.data.map((c) => c.competition_id));
      setAvailable(allRes.data.filter((c) => !joinedIds.has(c.id) && ["PUBLISHED", "APPLICATIONS_OPEN"].includes(c.status)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function join(id: string) {
    setJoiningId(id);
    setError(null);
    try {
      await api.post(`/api/competitions/${id}/join`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to join this competition"));
    } finally {
      setJoiningId(null);
    }
  }

  async function startApplication(competitionId: string) {
    setStartingId(competitionId);
    setError(null);
    try {
      const response = await api.post("/api/applications", { competition_id: competitionId });
      navigate(`/school/applications/${response.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to start this application"));
      toast.show(apiErrorMessage(err, "Unable to start this application"), "error");
    } finally {
      setStartingId(null);
    }
  }

  const loading = available === null || joined === null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1">Welcome back, {user?.first_name}</h1>
          <p className="text-muted" style={{ margin: 0 }}>Here's where your Solve for Tomorrow applications stand.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading && (
        <div className="grid grid-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && (
        <>
          <h2 className="text-h2">Your Competitions</h2>
          {joined!.length === 0 ? (
            <EmptyState
              icon={<Compass size={26} />}
              title="No competitions joined yet"
              description="Browse available competitions below and join one to start your application."
            />
          ) : (
            <div className="grid grid-2" style={{ marginBottom: 32 }}>
              {joined!.map((c) => {
                const stepIndex = c.application_status ? APPLICATION_STEPS.indexOf(c.application_status) : -1;
                const progressPct = c.application_status
                  ? c.application_status === "CHANGES_REQUESTED"
                    ? 55
                    : c.application_status === "REJECTED"
                    ? 100
                    : Math.max(15, ((stepIndex + 1) / APPLICATION_STEPS.length) * 100)
                  : 5;

                return (
                  <div className="card" key={c.competition_id}>
                    <div className="flex-between" style={{ marginBottom: 8 }}>
                      <h3 className="text-h3" style={{ margin: 0 }}>{c.competition_name}</h3>
                      <div className="flex gap-1" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {c.competition_status === "RESULTS_FINALIZED" && c.rank !== null && <PlacementBadge rank={c.rank} />}
                        <StatusBadge status={c.competition_status} />
                      </div>
                    </div>

                    <div className="flex-between" style={{ marginBottom: 4 }}>
                      <span className="text-caption">Application progress</span>
                      {c.application_status && <StatusBadge status={c.application_status} />}
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 18 }}>
                      <div style={{ width: `${progressPct}%` }} />
                    </div>

                    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                      {c.application_id ? (
                        <Link className="btn btn-primary btn-sm" to={`/school/applications/${c.application_id}`}>
                          Continue Application <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={startingId === c.competition_id} onClick={() => startApplication(c.competition_id)}>
                          {startingId === c.competition_id ? "Starting..." : "Start Application"} <ArrowRight size={14} />
                        </button>
                      )}
                      {c.application_id && ["APPROVED", "JUDGING", "COMPLETED"].includes(c.application_status ?? "") && (
                        <Link className="btn btn-outline btn-sm" to={`/school/applications/${c.application_id}/results`}>
                          Progress &amp; Scores
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h2 className="text-h2">Available Competitions</h2>
          {available!.length === 0 ? (
            <EmptyState icon={<Trophy size={26} />} title="No open competitions right now" description="Check back soon — new competitions will appear here as soon as they open." />
          ) : (
            <div className="grid grid-3">
              {available!.map((c) => (
                <div className="card" key={c.id}>
                  <StatusBadge status={c.status} />
                  <h3 className="text-h3" style={{ margin: "8px 0 4px" }}>{c.name}</h3>
                  <p className="text-caption" style={{ marginBottom: 14 }}>{c.theme}</p>

                  <div className="flex gap-1" style={{ alignItems: "center", fontSize: "0.85rem", marginBottom: 6 }}>
                    <Users size={14} />
                    {c.registered_count} / {c.max_participants} Schools
                  </div>
                  <div className="progress-bar thin" style={{ marginBottom: 10 }}>
                    <div style={{ width: `${(c.registered_count / c.max_participants) * 100}%` }} />
                  </div>
                  {c.spaces_remaining > 0 ? (
                    <p className="success-text" style={{ marginBottom: 12 }}>
                      <CheckCircle2 size={14} /> {c.spaces_remaining} spaces remaining
                    </p>
                  ) : (
                    <p className="error-text" style={{ marginBottom: 12 }}>
                      <Circle size={14} /> Competition full
                    </p>
                  )}
                  {c.application_close_date && (
                    <p className="text-caption flex gap-1" style={{ alignItems: "center", marginBottom: 14 }}>
                      <Calendar size={13} /> Deadline {new Date(c.application_close_date).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Link className="btn btn-outline btn-sm" to={`/school/competitions/${c.id}`}>
                      <FileText size={14} /> View
                    </Link>
                    <button className="btn btn-primary btn-sm" disabled={c.spaces_remaining <= 0 || joiningId === c.id} onClick={() => join(c.id)}>
                      {joiningId === c.id ? "Joining..." : "Join Competition"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
