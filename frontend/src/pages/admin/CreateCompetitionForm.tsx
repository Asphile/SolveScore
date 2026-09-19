import { useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../../api/client";
import type { Competition } from "../../types";

export function CreateCompetitionForm({ onCreated }: { onCreated: (c: Competition) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [applicationClose, setApplicationClose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await api.post<Competition>("/api/competitions", {
        name,
        description,
        theme,
        eligibility,
        max_participants: 20,
        application_close_date: applicationClose ? new Date(applicationClose).toISOString() : null,
      });
      onCreated(response.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create competition"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Theme</label>
          <input value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Application Deadline</label>
          <input type="datetime-local" value={applicationClose} onChange={(e) => setApplicationClose(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label>Eligibility</label>
        <textarea value={eligibility} onChange={(e) => setEligibility(e.target.value)} />
      </div>
      <p className="helper-text">Maximum participants is fixed at 20 schools.</p>
      {error && <p className="error-text">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-primary btn-block" disabled={saving} type="submit">
          {saving ? "Creating..." : "Create Competition"}
        </button>
      </div>
    </form>
  );
}
