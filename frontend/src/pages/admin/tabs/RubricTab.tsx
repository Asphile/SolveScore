import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { api, apiErrorMessage } from "../../../api/client";
import type { Rubric } from "../../../types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../hooks/useToast";
import type { CommandCenterContext } from "../CompetitionCommandCenter";

interface CriterionForm {
  name: string;
  description: string;
  weight: number;
  minimum_score: number;
  maximum_score: number;
}

const DEFAULT_CRITERIA: CriterionForm[] = [
  { name: "Innovation", description: "Originality of the idea", weight: 40, minimum_score: 1, maximum_score: 10 },
  { name: "Feasibility", description: "Practicality of implementation", weight: 30, minimum_score: 1, maximum_score: 10 },
  { name: "Impact", description: "Expected community impact", weight: 30, minimum_score: 1, maximum_score: 10 },
];

export function RubricTab() {
  const { competition } = useOutletContext<CommandCenterContext>();
  const [rubric, setRubric] = useState<Rubric | null | undefined>(undefined);
  const [criteria, setCriteria] = useState<CriterionForm[]>(DEFAULT_CRITERIA);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const res = await api.get<Rubric>(`/api/admin/competitions/${competition.id}/rubric`);
      setRubric(res.data);
    } catch {
      setRubric(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id]);

  const total = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  const totalOk = Math.round(total) === 100;

  function updateCriterion(i: number, field: keyof CriterionForm, value: string | number) {
    setCriteria((cs) => cs.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }
  function addCriterion() {
    setCriteria((cs) => [...cs, { name: "", description: "", weight: 0, minimum_score: 1, maximum_score: 10 }]);
  }
  function removeCriterion(i: number) {
    setCriteria((cs) => cs.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError(null);
    if (!totalOk) {
      setError(`Rubric weights must total 100% (currently ${total}%)`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<Rubric>(`/api/admin/competitions/${competition.id}/rubric`, {
        name: "Standard Rubric",
        criteria: criteria.map((c) => ({ ...c, weight: c.weight / 100 })),
      });
      setRubric(res.data);
      toast.show("Rubric saved", "success");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save rubric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <div className="card-header">
          <h3 className="text-h3">Active Rubric</h3>
        </div>
        {rubric === undefined && <p className="text-muted">Loading...</p>}
        {rubric === null && (
          <EmptyState icon={<ClipboardCheck size={24} />} title="No rubric yet" description="Configure criteria on the right and save to activate it." />
        )}
        {rubric && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>Weight</th>
                  <th>Range</th>
                </tr>
              </thead>
              <tbody>
                {rubric.criteria.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.description && <div className="text-caption">{c.description}</div>}
                    </td>
                    <td>{(c.weight * 100).toFixed(0)}%</td>
                    <td>
                      {c.minimum_score}–{c.maximum_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-h3">{rubric ? "Replace Rubric" : "Create Rubric"}</h3>
          <span className={`badge ${totalOk ? "badge-green" : "badge-red"}`}>{total}% of 100%</span>
        </div>

        {criteria.map((c, i) => (
          <div className="card" key={i} style={{ background: "var(--bg-subtle)", boxShadow: "none", marginBottom: 12, padding: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input value={c.name} onChange={(e) => updateCriterion(i, "name", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Weight %</label>
                <input type="number" min={1} max={100} value={c.weight} onChange={(e) => updateCriterion(i, "weight", Number(e.target.value))} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={c.description} onChange={(e) => updateCriterion(i, "description", e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Min Score</label>
                <input type="number" value={c.minimum_score} onChange={(e) => updateCriterion(i, "minimum_score", Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Max Score</label>
                <input type="number" value={c.maximum_score} onChange={(e) => updateCriterion(i, "maximum_score", Number(e.target.value))} />
              </div>
            </div>
            <button className="btn btn-danger-outline btn-sm" onClick={() => removeCriterion(i)}>
              <Trash2 size={13} /> Remove
            </button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" onClick={addCriterion}>
          <Plus size={14} /> Add Criterion
        </button>

        {error && (
          <p className="error-text" style={{ marginTop: 14 }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save Rubric"}
        </button>
      </div>
    </div>
  );
}
