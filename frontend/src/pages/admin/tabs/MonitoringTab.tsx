import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, ClipboardList, FileClock, Gavel, School, Trophy } from "lucide-react";
import { api, apiErrorMessage } from "../../../api/client";
import { ProgressCircle } from "../../../components/ui/ProgressCircle";
import { StatTile } from "../../../components/ui/StatTile";
import { SkeletonStatRow } from "../../../components/ui/Skeleton";
import type { CommandCenterContext } from "../CompetitionCommandCenter";

interface Stats {
  max_schools: number;
  registered_schools: number;
  approved_schools: number;
  judges: number;
  expected_evaluations: number;
  submitted_evaluations: number;
  draft_evaluations: number;
  not_started: number;
  completion_pct: number;
}

export function MonitoringTab() {
  const { competition } = useOutletContext<CommandCenterContext>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.get<Stats>(`/api/admin/statistics?competition_id=${competition.id}`);
      setStats(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <SkeletonStatRow />;

  const breakdown = [
    { label: "Submitted", value: stats.submitted_evaluations, color: "var(--success)" },
    { label: "Draft", value: stats.draft_evaluations, color: "var(--warning)" },
    { label: "Not started", value: stats.not_started, color: "var(--border-strong)" },
  ];
  const breakdownTotal = Math.max(stats.expected_evaluations, 1);

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatTile icon={<Trophy size={17} />} value={stats.max_schools} label="Maximum Schools" />
        <StatTile icon={<School size={17} />} value={stats.registered_schools} label="Registered Schools" />
        <StatTile icon={<CheckCircle2 size={17} />} value={stats.approved_schools} label="Approved Schools" />
        <StatTile icon={<Gavel size={17} />} value={stats.judges} label="Judges" />
        <StatTile icon={<ClipboardList size={17} />} value={stats.expected_evaluations} label="Expected Evaluations" />
        <StatTile icon={<CheckCircle2 size={17} />} value={stats.submitted_evaluations} label="Submitted Evaluations" />
        <StatTile icon={<FileClock size={17} />} value={stats.draft_evaluations} label="Draft Evaluations" />
        <StatTile icon={<FileClock size={17} />} value={stats.not_started} label="Not Started" />
      </div>

      <div className="card flex gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <ProgressCircle value={stats.completion_pct} color="var(--success)" label="Complete" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 className="text-h3">Evaluation Completion</h3>
          <p className="text-muted" style={{ marginBottom: 14 }}>
            {stats.submitted_evaluations} of {stats.expected_evaluations} evaluations submitted across {stats.judges} judges.
          </p>
          <div className="flex" style={{ height: 10, borderRadius: "var(--r-full)", overflow: "hidden", background: "var(--bg-subtle)" }}>
            {breakdown.map((b) => (
              <div key={b.label} style={{ width: `${(b.value / breakdownTotal) * 100}%`, background: b.color }} title={`${b.label}: ${b.value}`} />
            ))}
          </div>
          <div className="flex gap-3" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {breakdown.map((b) => (
              <span key={b.label} className="flex gap-1 text-caption" style={{ alignItems: "center" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, display: "inline-block" }} />
                {b.label} ({b.value})
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-caption" style={{ marginTop: 10 }}>Auto-refreshes every 15 seconds.</p>
    </div>
  );
}
