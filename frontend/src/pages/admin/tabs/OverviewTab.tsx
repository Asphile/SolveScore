import { useOutletContext } from "react-router-dom";
import { CalendarClock, CalendarRange, Gavel } from "lucide-react";
import type { CommandCenterContext } from "../CompetitionCommandCenter";

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not set";
}

export function OverviewTab() {
  const { competition } = useOutletContext<CommandCenterContext>();

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 className="text-h3">About this competition</h3>
        <p className="text-body">{competition.description || "No description provided yet."}</p>
        <hr className="divider" />
        <div className="text-label" style={{ marginBottom: 4 }}>Eligibility</div>
        <p className="text-body">{competition.eligibility || "No eligibility criteria set yet."}</p>
      </div>

      <div className="card">
        <h3 className="text-h3">Timeline</h3>
        <div className="timeline">
          <div className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-time flex gap-1" style={{ alignItems: "center" }}><CalendarRange size={13} /> Applications open</div>
            <div className="timeline-text">{fmt(competition.application_open_date)}</div>
          </div>
          <div className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-time flex gap-1" style={{ alignItems: "center" }}><CalendarClock size={13} /> Applications close</div>
            <div className="timeline-text">{fmt(competition.application_close_date)}</div>
          </div>
          <div className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-time flex gap-1" style={{ alignItems: "center" }}><Gavel size={13} /> Judging opens</div>
            <div className="timeline-text">{fmt(competition.judging_open_date)}</div>
          </div>
          <div className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-time flex gap-1" style={{ alignItems: "center" }}><Gavel size={13} /> Judging closes</div>
            <div className="timeline-text">{fmt(competition.judging_close_date)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
