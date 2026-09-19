import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { BrandLockup } from "../components/ui/BrandLockup";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "ADMIN") navigate("/admin/competitions");
      else if (user.role === "JUDGE") navigate("/judge");
      else navigate("/school");
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <BrandLockup size="md" theme="dark" />
          <h1 className="text-display" style={{ color: "white", marginTop: 60, fontSize: "2.2rem" }}>
            Smarter evaluation.
            <br />
            Fairer judging.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.68)", maxWidth: 380, marginTop: 14 }}>
            The secure platform behind Samsung Solve for Tomorrow's application review and independent judging.
          </p>
        </div>
        <div className="auth-visual-content flex gap-2" style={{ flexWrap: "wrap" }}>
          <div className="floating-stat-card flex gap-1" style={{ alignItems: "center" }}>
            <ShieldCheck size={16} /> Role-based access
          </div>
          <div className="floating-stat-card flex gap-1" style={{ alignItems: "center" }}>
            <Sparkles size={16} /> AI-assisted review
          </div>
          <div className="floating-stat-card flex gap-1" style={{ alignItems: "center" }}>
            <Trophy size={16} /> Independent judging
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h1 className="text-h1">Welcome back</h1>
          <p className="text-muted">Sign in to continue to SolveScore.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className="auth-switch">
            School coordinator without an account? <Link to="/register">Register your school</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
