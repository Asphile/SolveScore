import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Plus, Trophy, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { Competition } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { CreateCompetitionForm } from "./CreateCompetitionForm";

export function AdminCompetitionsListPage() {
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const res = await api.get<Competition[]>("/api/competitions");
      setCompetitions(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1">Competitions</h1>
          <p className="text-muted" style={{ margin: 0 }}>
            Create and manage Solve for Tomorrow competitions.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Competition
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {competitions === null && (
        <div className="grid grid-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {competitions?.length === 0 && (
        <EmptyState
          icon={<Trophy size={26} />}
          title="No competitions yet"
          description="Create your first competition to start accepting school applications."
          action={
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New Competition
            </button>
          }
        />
      )}

      {competitions && competitions.length > 0 && (
        <div className="grid grid-2">
          {competitions.map((c) => (
            <Link to={`/admin/competitions/${c.id}`} key={c.id} className="card card-interactive" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="flex-between" style={{ marginBottom: 10 }}>
                <StatusBadge status={c.status} />
              </div>
              <h3 className="text-h3" style={{ marginBottom: 6 }}>{c.name}</h3>
              <p className="text-muted" style={{ fontSize: "0.86rem", margin: "0 0 16px" }}>
                {c.theme || c.description || "No theme set yet"}
              </p>
              <div className="flex gap-3" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                <span className="flex gap-1" style={{ alignItems: "center" }}>
                  <Users size={14} /> {c.registered_count}/{c.max_participants} schools
                </span>
                {c.application_close_date && (
                  <span className="flex gap-1" style={{ alignItems: "center" }}>
                    <Calendar size={14} /> {new Date(c.application_close_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Competition</h3>
            </div>
            <CreateCompetitionForm
              onCreated={() => {
                setShowCreate(false);
                load();
                toast.show("Competition created", "success");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
