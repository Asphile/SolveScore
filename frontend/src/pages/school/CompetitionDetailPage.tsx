import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { Competition } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api
      .get<Competition>(`/api/competitions/${id}`)
      .then((res) => setCompetition(res.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [id]);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      await api.post(`/api/competitions/${id}/join`);
      const created = await api.post("/api/applications", { competition_id: id });
      toast.show("You've joined the competition", "success");
      navigate(`/school/applications/${created.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to join this competition"));
    } finally {
      setJoining(false);
    }
  }

  if (error && !competition) {
    return <EmptyState tone="error" title="Couldn't load this competition" description={error} />;
  }

  if (!competition) return <SkeletonBlock height={280} />;

  const canJoin = competition.spaces_remaining > 0 && ["PUBLISHED", "APPLICATIONS_OPEN"].includes(competition.status);

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="surface-feature" style={{ marginBottom: 22 }}>
        <StatusBadge status={competition.status} />
        <h1 className="text-h1" style={{ color: "white", marginTop: 10 }}>{competition.name}</h1>
        <p className="text-muted" style={{ maxWidth: 560 }}>{competition.description}</p>
        <div className="flex gap-3" style={{ marginTop: 16, flexWrap: "wrap" }}>
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

      <div className="grid grid-2">
        <div className="card">
          <h3 className="text-h3 flex gap-1" style={{ alignItems: "center" }}>
            <Target size={17} /> Theme &amp; Challenge
          </h3>
          <p className="text-body">{competition.theme || "No theme has been set for this competition yet."}</p>
        </div>
        <div className="card">
          <h3 className="text-h3 flex gap-1" style={{ alignItems: "center" }}>
            <ShieldCheck size={17} /> Eligibility
          </h3>
          <p className="text-body">{competition.eligibility || "No eligibility criteria have been specified."}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-h3 flex gap-1" style={{ alignItems: "center" }}>
          <Sparkles size={17} style={{ color: "var(--ai)" }} /> What to expect
        </h3>
        <div className="grid grid-3">
          <div>
            <div className="text-label">01 · Apply</div>
            <p className="text-caption">Complete the project, team and document requirements.</p>
          </div>
          <div>
            <div className="text-label">02 · AI-assisted review</div>
            <p className="text-caption">Your documents are screened for review alongside admin evaluation.</p>
          </div>
          <div>
            <div className="text-label">03 · Independent judging</div>
            <p className="text-caption">Every approved application is scored blind by every assigned judge.</p>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary btn-lg" disabled={!canJoin || joining} onClick={handleJoin}>
        {joining ? "Joining..." : competition.spaces_remaining <= 0 ? "Competition Full" : "Join Competition"}
      </button>
    </div>
  );
}
