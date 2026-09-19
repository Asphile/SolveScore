import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  FileCheck2,
  Gavel,
  Lock,
  Radar,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trophy,
  UploadCloud,
  Users,
} from "lucide-react";
import { BrandLockup } from "../../components/ui/BrandLockup";

const STEPS = [
  { n: "01", title: "Create Competition", body: "Admins configure dates, capacity, required documents and a weighted rubric." },
  { n: "02", title: "Schools Apply", body: "Up to 20 schools join, complete a guided application, and upload documents and video." },
  { n: "03", title: "AI-Assisted Review", body: "Uploaded content is screened for an AI-content indicator that admins review by hand." },
  { n: "04", title: "Judges Evaluate", body: "Every judge scores independently — no judge ever sees another judge's score." },
  { n: "05", title: "Results Consolidated", body: "Weighted scores are calculated server-side and the leaderboard updates live." },
];

const FEATURES = [
  { icon: Trophy, title: "Competition management", body: "Full lifecycle control from draft to finalized results, enforced by the backend." },
  { icon: UploadCloud, title: "Secure document uploads", body: "Extension, MIME-type and file-signature validation on every upload." },
  { icon: Sparkles, title: "AI content analysis", body: "A transparent, human-reviewed indicator — never an automated decision." },
  { icon: Gavel, title: "Independent judging", body: "Blind, isolated scoring enforced at the API level, not just hidden in the UI." },
  { icon: BarChart3, title: "Automated scoring", body: "Weighted rubric contributions are always calculated server-side." },
  { icon: ScrollText, title: "Live monitoring & reports", body: "Real-time progress tracking plus CSV/PDF exports for every competition." },
];

export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <BrandLockup size="md" theme="light" />
        <div className="flex gap-2">
          <Link to="/login" className="btn btn-ghost">Sign In</Link>
          <Link to="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="landing-hero-inner">
          <div className="flex gap-2" style={{ justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
            <span className="samsung-badge">
              <img src="/samsung-logo.png" alt="Samsung" /> Solve for Tomorrow
            </span>
            <span className="landing-pill" style={{ marginBottom: 0 }}>
              <Sparkles size={14} /> AI-Assisted Evaluation
            </span>
          </div>
          <h1 className="text-display" style={{ color: "white" }}>
            Smarter competition evaluation.
            <br />
            Fairer judging. Better decisions.
          </h1>
          <p className="lead">
            A secure platform for managing applications, AI-assisted content review, independent judging and results —
            built for Samsung Solve for Tomorrow.
          </p>
          <div className="landing-hero-ctas">
            <Link to="/register" className="btn btn-cyan btn-lg">
              Get Started <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.3)", color: "white" }}>
              Sign In
            </Link>
          </div>
        </div>

        <div className="floating-cards">
          <div className="float-card" style={{ top: 0, left: "6%", animationDelay: "0s" }}>
            <div className="text-caption" style={{ color: "rgba(255,255,255,0.6)" }}>Live Leaderboard</div>
            <div style={{ color: "white", fontWeight: 700 }}>School J · 84.2</div>
          </div>
          <div className="float-card" style={{ top: 60, right: "8%", animationDelay: "1.2s" }}>
            <div className="text-caption" style={{ color: "rgba(255,255,255,0.6)" }}>AI Review</div>
            <div style={{ color: "white", fontWeight: 700 }}>Indicator: Low</div>
          </div>
          <div className="float-card" style={{ top: 150, left: "30%", animationDelay: "2.1s" }}>
            <div className="text-caption" style={{ color: "rgba(255,255,255,0.6)" }}>Judging Progress</div>
            <div style={{ color: "white", fontWeight: 700 }}>318 / 400 Complete</div>
          </div>
        </div>
      </header>

      <section className="landing-section">
        <div className="landing-section-head">
          <div className="landing-eyebrow">How it works</div>
          <h2 className="text-h1">From application to official results</h2>
        </div>
        <div className="grid grid-2" style={{ rowGap: 32 }}>
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <span className="step-num">{s.n}</span>
              <div>
                <h3 className="text-h3">{s.title}</h3>
                <p className="text-muted" style={{ margin: 0 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="landing-section-head">
          <div className="landing-eyebrow">Platform</div>
          <h2 className="text-h1">Everything a competition needs</h2>
        </div>
        <div className="grid grid-3">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <span className="feature-icon">
                <f.icon size={20} />
              </span>
              <h3 className="text-h3">{f.title}</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.87rem" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="grid grid-2" style={{ alignItems: "center" }}>
          <div>
            <div className="landing-eyebrow">Trust &amp; security</div>
            <h2 className="text-h1">Built for integrity, not just speed</h2>
            <div className="flex-col gap-3" style={{ marginTop: 20 }}>
              <div className="flex gap-2">
                <ShieldCheck size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <div>
                  <strong>Role-based access control</strong>
                  <p className="text-muted" style={{ margin: 0, fontSize: "0.87rem" }}>Enforced at the API, not just hidden in the UI.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Lock size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <div>
                  <strong>Independent judging</strong>
                  <p className="text-muted" style={{ margin: 0, fontSize: "0.87rem" }}>No judge can ever see another judge's scores.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <ScrollText size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <div>
                  <strong>Full audit trail</strong>
                  <p className="text-muted" style={{ margin: 0, fontSize: "0.87rem" }}>Every approval, score and override is recorded.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="landing-stats">
            <div className="grid grid-2">
              <div>
                <div className="value">20</div>
                <div className="label">Schools per competition</div>
              </div>
              <div>
                <div className="value">20</div>
                <div className="label">Independent judges</div>
              </div>
              <div>
                <div className="value">400</div>
                <div className="label">Potential evaluations</div>
              </div>
              <div>
                <div className="value">100%</div>
                <div className="label">Configurable rubrics</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-cta">
          <Radar size={28} style={{ marginBottom: 14, opacity: 0.8 }} />
          <h2 className="text-h1" style={{ color: "white" }}>Ready to transform competition judging?</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", maxWidth: 460, margin: "10px auto 26px" }}>
            Set up a competition, invite schools and judges, and let SolveScore handle the rest.
          </p>
          <Link to="/register" className="btn btn-cyan btn-lg">
            Start with SolveScore <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="flex gap-1" style={{ justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
          <FileCheck2 size={14} /> SolveScore — built for Samsung Solve for Tomorrow
        </div>
        <div className="flex gap-1" style={{ justifyContent: "center" }}>
          <Users size={13} /> Trusted by schools, judges and administrators
        </div>
      </footer>
    </div>
  );
}
