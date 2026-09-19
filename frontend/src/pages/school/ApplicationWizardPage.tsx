import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Plus, Trash2, Trophy } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import type { Application, ResourceItem, TeamMember } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { Dropzone } from "../../components/ui/Dropzone";
import { FileCard } from "../../components/ui/FileCard";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { ResourceViewerModal } from "../../components/ui/ResourceViewerModal";
import { SelectOrOther } from "../../components/ui/SelectOrOther";
import { SkeletonBlock } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { GRADE_OPTIONS, PROJECT_CATEGORIES, TEAM_ROLE_OPTIONS } from "../../data/applicationOptions";

const STEPS = ["Project", "Team", "Documents", "Video", "Review"] as const;
const MAX_LEN = 1000;

function CounterTextField({
  label, hint, value, disabled, onChange,
}: { label: string; hint?: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="field-with-counter">
        <textarea disabled={disabled} value={value} maxLength={MAX_LEN} onChange={(e) => onChange(e.target.value)} />
        <span className="char-counter">{value.length} / {MAX_LEN}</span>
      </div>
    </div>
  );
}

export function ApplicationWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [application, setApplication] = useState<Application | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [viewerResource, setViewerResource] = useState<ResourceItem | null>(null);

  const editable = application?.status === "DRAFT" || application?.status === "CHANGES_REQUESTED";

  async function load() {
    if (!id) return;
    try {
      const [appRes, resRes] = await Promise.all([
        api.get<Application>(`/api/applications/${id}`),
        api.get<ResourceItem[]>(`/api/applications/${id}/resources`),
      ]);
      setApplication(appRes.data);
      setResources(resRes.data);
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Could not load this application"));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function update<K extends keyof Application>(key: K, value: Application[K]) {
    setApplication((a) => (a ? { ...a, [key]: value } : a));
  }

  async function saveDraft(silent = false) {
    if (!application) return;
    setSaving(true);
    setError(null);
    try {
      const { team_members, ...rest } = application;
      await api.put(`/api/applications/${application.id}`, { ...rest, team_members });
      setSaved(new Date().toLocaleTimeString());
      if (!silent) toast.show("Draft saved", "success");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save draft"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (!application) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/api/applications/${application.id}/resources`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
      toast.show("File uploaded", "success");
    } catch (err) {
      toast.show(apiErrorMessage(err, "Upload failed"), "error");
    } finally {
      setUploading(false);
    }
  }

  async function deleteResource(resourceId: string) {
    try {
      await api.delete(`/api/resources/${resourceId}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function updateTeamMember(index: number, field: keyof TeamMember, value: string) {
    setApplication((a) => {
      if (!a) return a;
      const members = [...a.team_members];
      members[index] = { ...members[index], [field]: value };
      return { ...a, team_members: members };
    });
  }
  function addTeamMember() {
    setApplication((a) => (a ? { ...a, team_members: [...a.team_members, { name: "", grade: "", role: "" }] } : a));
  }
  function removeTeamMember(index: number) {
    setApplication((a) => (a ? { ...a, team_members: a.team_members.filter((_, i) => i !== index) } : a));
  }

  async function submitApplication() {
    if (!application) return;
    setSaving(true);
    setError(null);
    try {
      await saveDraft(true);
      const response = await api.post(`/api/applications/${application.id}/submit`);
      setApplication(response.data);
      setConfirmSubmit(false);
      toast.show("Application submitted and locked", "success");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit application"));
      setConfirmSubmit(false);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/school")}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
        <EmptyState
          tone="error"
          title="Couldn't load this application"
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

  if (!application) return <SkeletonBlock height={340} />;

  const documents = resources.filter((r) => r.resource_type !== "VIDEO");
  const videos = resources.filter((r) => r.resource_type === "VIDEO");
  const requiredComplete = Boolean(application.project_title && application.problem_description && application.solution_description);
  const readyToSubmit = requiredComplete && documents.length > 0;

  return (
    <div style={{ maxWidth: 880 }}>
      <div className="page-header">
        <div>
          <h1 className="text-h1">Application</h1>
          <p className="text-muted" style={{ margin: 0 }}>{application.project_title || "Untitled project"}</p>
        </div>
        <div className="flex gap-2" style={{ alignItems: "center" }}>
          {saved && editable && <span className="text-caption success-text">✓ Saved {saved}</span>}
          <StatusBadge status={application.status} />
          {["APPROVED", "JUDGING", "COMPLETED"].includes(application.status) && (
            <Link className="btn btn-outline btn-sm" to={`/school/applications/${application.id}/results`}>
              <Trophy size={14} /> Progress &amp; Scores
            </Link>
          )}
        </div>
      </div>

      {application.status === "CHANGES_REQUESTED" && application.review_notes && (
        <div className="card" style={{ borderLeft: "3px solid var(--warning)", background: "var(--warning-soft)" }}>
          <strong className="flex gap-1" style={{ alignItems: "center", color: "var(--warning)" }}>
            <AlertTriangle size={15} /> Changes requested by admin
          </strong>
          <p style={{ margin: "6px 0 0" }}>{application.review_notes}</p>
        </div>
      )}

      <div className="stepper">
        {STEPS.map((s, i) => (
          <div className="stepper-step" key={s}>
            <div className="stepper-node-wrap" onClick={() => setStep(i)}>
              <div className={`stepper-node ${i < step ? "done" : i === step ? "active" : ""}`}>
                {i < step ? <Check size={15} /> : i + 1}
              </div>
              <span className={`stepper-label ${i === step ? "active-label" : ""}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`stepper-connector ${i < step ? "done" : ""}`} />}
          </div>
        ))}
      </div>

      {!editable && (
        <div className="card" style={{ background: "var(--info-soft)" }}>
          This application is <strong>{application.status.toLowerCase().replace("_", " ")}</strong> and can no longer be
          edited unless an administrator reopens it.
        </div>
      )}

      <div className="card">
        {step === 0 && (
          <div>
            <h2 className="text-h2">Project Information</h2>
            <div className="form-group">
              <label>Project Title<span className="required-mark">*</span></label>
              <input disabled={!editable} value={application.project_title} onChange={(e) => update("project_title", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <SelectOrOther
                disabled={!editable}
                value={application.category}
                options={PROJECT_CATEGORIES}
                placeholder="Select a category..."
                onChange={(v) => update("category", v)}
              />
            </div>
            <CounterTextField
              label="Problem Being Addressed"
              hint="Describe the problem your project addresses."
              value={application.problem_description}
              disabled={!editable}
              onChange={(v) => update("problem_description", v)}
            />
            <CounterTextField label="Proposed Solution" value={application.solution_description} disabled={!editable} onChange={(v) => update("solution_description", v)} />
            <CounterTextField label="Innovation" value={application.innovation_description} disabled={!editable} onChange={(v) => update("innovation_description", v)} />
            <CounterTextField label="Expected Impact" value={application.impact_description} disabled={!editable} onChange={(v) => update("impact_description", v)} />
            <CounterTextField label="Implementation Plan" value={application.implementation_plan} disabled={!editable} onChange={(v) => update("implementation_plan", v)} />
            <div className="form-group">
              <label>Technology Used</label>
              <input disabled={!editable} value={application.technology_used} onChange={(e) => update("technology_used", e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-h2">Team</h2>
            <div className="form-group">
              <label>Teacher / Coordinator</label>
              <input disabled={!editable} value={application.teacher_coordinator} onChange={(e) => update("teacher_coordinator", e.target.value)} />
            </div>
            {application.team_members.map((member, i) => (
              <div className="form-row" key={i} style={{ alignItems: "end" }}>
                <div className="form-group">
                  <label>Name</label>
                  <input disabled={!editable} value={member.name} onChange={(e) => updateTeamMember(i, "name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Grade</label>
                  <SelectOrOther
                    disabled={!editable}
                    value={member.grade}
                    options={GRADE_OPTIONS}
                    placeholder="Select grade..."
                    onChange={(v) => updateTeamMember(i, "grade", v)}
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <SelectOrOther
                    disabled={!editable}
                    value={member.role}
                    options={TEAM_ROLE_OPTIONS}
                    placeholder="Select role..."
                    onChange={(v) => updateTeamMember(i, "role", v)}
                  />
                </div>
                {editable && (
                  <button className="btn btn-outline btn-sm" onClick={() => removeTeamMember(i)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {editable && (
              <button className="btn btn-outline btn-sm" onClick={addTeamMember}>
                <Plus size={14} /> Add Team Member
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-h2">Required Documents</h2>
            <p className="helper-text" style={{ marginBottom: 16 }}>Accepted formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG.</p>
            {documents.map((doc) => (
              <FileCard key={doc.id} resource={doc} removable={editable} onRemove={() => deleteResource(doc.id)} onView={setViewerResource} />
            ))}
            {editable && (
              <Dropzone accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" hint="PDF, DOCX, PPTX up to 25MB" uploading={uploading} onFile={handleUpload} />
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-h2">Project Video</h2>
            <p className="helper-text" style={{ marginBottom: 16 }}>Upload your project presentation or demonstration. MP4 / MOV / WEBM, up to 500MB.</p>
            {videos.map((v) => (
              <FileCard key={v.id} resource={v} removable={editable} onRemove={() => deleteResource(v.id)} onView={setViewerResource} showAiStatus={false} />
            ))}
            {editable && videos.length === 0 && (
              <Dropzone accept=".mp4,.mov,.webm" hint="MP4, MOV or WEBM up to 500MB" uploading={uploading} onFile={handleUpload} />
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-h2">Review &amp; Submit</h2>
            <div className="checklist-item">
              <span className={`checklist-check ${requiredComplete ? "done" : "pending"}`}>
                <Check size={12} />
              </span>
              Project details complete
            </div>
            <div className="checklist-item">
              <span className={`checklist-check ${documents.length > 0 ? "done" : "pending"}`}>
                <Check size={12} />
              </span>
              At least one document uploaded ({documents.length})
            </div>
            <div className="checklist-item">
              <span className={`checklist-check ${videos.length > 0 ? "done" : "pending"}`}>
                <Check size={12} />
              </span>
              Project video uploaded {videos.length === 0 && "(optional)"}
            </div>

            <hr className="divider" />
            <p><strong>{application.project_title || "(no title)"}</strong></p>
            <p className="text-muted">{application.problem_description || "No problem description yet."}</p>

            {editable && (
              <p className="helper-text">Once submitted, this application will be locked until reviewed by an administrator.</p>
            )}
          </div>
        )}

        {error && <p className="error-text" style={{ marginTop: 14 }}>{error}</p>}

        <div className="flex-between" style={{ marginTop: 24 }}>
          <button className="btn btn-outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="flex gap-2">
            {editable && (
              <button className="btn btn-outline" disabled={saving} onClick={() => saveDraft()}>
                {saving ? "Saving..." : "Save Draft"}
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                Continue <ArrowRight size={15} />
              </button>
            )}
            {step === STEPS.length - 1 && editable && (
              <button className="btn btn-cyan" disabled={saving || !readyToSubmit} onClick={() => setConfirmSubmit(true)}>
                Submit Application
              </button>
            )}
          </div>
        </div>
      </div>

      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/school")}>
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit application?"
        description="After submission your application will be locked and reviewed by an administrator. You'll be notified if changes are needed."
        confirmLabel="Submit Application"
        busy={saving}
        onConfirm={submitApplication}
        onCancel={() => setConfirmSubmit(false)}
      />

      <ResourceViewerModal resource={viewerResource} onClose={() => setViewerResource(null)} />
    </div>
  );
}
