import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Gavel, Plus, UserPlus } from "lucide-react";
import { api, apiErrorMessage } from "../../../api/client";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../hooks/useToast";
import type { CommandCenterContext } from "../CompetitionCommandCenter";

interface JudgeRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
}
interface AssignedJudge {
  judge_id: string;
  name: string;
  email: string;
  assigned_at: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function JudgesTab() {
  const { competition } = useOutletContext<CommandCenterContext>();
  const [allJudges, setAllJudges] = useState<JudgeRow[]>([]);
  const [assigned, setAssigned] = useState<AssignedJudge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedJudgeId, setSelectedJudgeId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const [judgesRes, assignedRes] = await Promise.all([
        api.get<JudgeRow[]>("/api/admin/judges"),
        api.get<AssignedJudge[]>(`/api/admin/competitions/${competition.id}/judges`),
      ]);
      setAllJudges(judgesRes.data);
      setAssigned(assignedRes.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id]);

  async function createJudge(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/api/admin/judges", { first_name: firstName, last_name: lastName, email, password });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setShowCreate(false);
      toast.show("Judge account created", "success");
      await load();
    } catch (err) {
      toast.show(apiErrorMessage(err, "Could not create judge account"), "error");
    } finally {
      setCreating(false);
    }
  }

  async function assignJudge() {
    if (!selectedJudgeId) return;
    try {
      await api.post(`/api/admin/competitions/${competition.id}/judges`, { judge_id: selectedJudgeId });
      setSelectedJudgeId("");
      toast.show("Judge assigned", "success");
      await load();
    } catch (err) {
      toast.show(apiErrorMessage(err, "Could not assign judge"), "error");
    }
  }

  const assignedIds = new Set(assigned.map((a) => a.judge_id));
  const unassignedJudges = allJudges.filter((j) => !assignedIds.has(j.id));

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <div className="card-header">
          <h3 className="text-h3">Assigned Judges ({assigned.length})</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setShowCreate(true)}>
            <UserPlus size={14} /> New Judge Account
          </button>
        </div>

        {assigned.length === 0 ? (
          <EmptyState icon={<Gavel size={24} />} title="No judges assigned" description="Assign existing judges below or create a new judge account." />
        ) : (
          <div className="grid grid-3">
            {assigned.map((j) => (
              <div className="card" key={j.judge_id} style={{ margin: 0, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span className="avatar">{initials(j.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.87rem", overflow: "hidden", textOverflow: "ellipsis" }}>{j.name}</div>
                  <div className="text-caption" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{j.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {unassignedJudges.length > 0 && (
          <div className="form-row" style={{ marginTop: 18, alignItems: "end" }}>
            <div className="form-group">
              <label>Assign Existing Judge</label>
              <select value={selectedJudgeId} onChange={(e) => setSelectedJudgeId(e.target.value)}>
                <option value="">Select a judge...</option>
                {unassignedJudges.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.email})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={assignJudge} disabled={!selectedJudgeId}>
              <Plus size={15} /> Assign
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Judge Account</h3>
            </div>
            <form onSubmit={createJudge}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={creating} type="submit">
                  {creating ? "Creating..." : "Create Judge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
