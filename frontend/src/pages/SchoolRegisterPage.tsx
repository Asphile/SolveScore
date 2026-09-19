import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BrandLockup } from "../components/ui/BrandLockup";
import { OTHER_OPTION, SA_DISTRICTS_BY_PROVINCE, SA_PROVINCES } from "../data/southAfrica";

const initialForm = {
  school_name: "",
  registration_number: "",
  province: "",
  district: "",
  address: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  email: "",
  password: "",
  confirm_password: "",
};

function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 12) score++;
  const labels = ["Too short", "Weak", "Fair", "Strong", "Strong"];
  return { score, label: labels[score] };
}

export function SchoolRegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [districtOther, setDistrictOther] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const strengthClass = strength.score <= 1 ? "filled-weak" : strength.score <= 2 ? "filled-fair" : "filled-strong";
  const districtOptions = SA_DISTRICTS_BY_PROVINCE[form.province] ?? [];

  function update<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectProvince(value: string) {
    setForm((f) => ({ ...f, province: value, district: "" }));
    setDistrictOther(false);
  }

  function selectDistrict(value: string) {
    if (value === OTHER_OPTION) {
      setDistrictOther(true);
      update("district", "");
    } else {
      setDistrictOther(false);
      update("district", value);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await api.post("/api/auth/register", form);
      localStorage.setItem("solvescore_token", response.data.access_token);
      await refresh();
      navigate("/school");
    } catch (err) {
      setError(apiErrorMessage(err, "Registration failed. Please check your details and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <BrandLockup size="md" theme="dark" />
          <h1 className="text-display" style={{ color: "white", marginTop: 60, fontSize: "2.1rem" }}>
            Bring your school's
            <br />
            best idea to life.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.68)", maxWidth: 380, marginTop: 14 }}>
            Register once, then apply to any open Solve for Tomorrow competition — draft autosave included.
          </p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card wide">
          <h1 className="text-h1">Register Your School</h1>
          <p className="text-muted">Create an account to join Samsung Solve for Tomorrow competitions.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>School Name<span className="required-mark">*</span></label>
                <input required value={form.school_name} onChange={(e) => update("school_name", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Registration Number<span className="required-mark">*</span></label>
                <input required value={form.registration_number} onChange={(e) => update("registration_number", e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Province<span className="required-mark">*</span></label>
                <select required value={form.province} onChange={(e) => selectProvince(e.target.value)}>
                  <option value="" disabled>
                    Select a province...
                  </option>
                  {SA_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>District<span className="required-mark">*</span></label>
                {!districtOther ? (
                  <select
                    required
                    value={form.district}
                    disabled={!form.province}
                    onChange={(e) => selectDistrict(e.target.value)}
                  >
                    <option value="" disabled>
                      {form.province ? "Select a district..." : "Select a province first"}
                    </option>
                    {districtOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
                  </select>
                ) : (
                  <input
                    required
                    autoFocus
                    placeholder="Enter district"
                    value={form.district}
                    onChange={(e) => update("district", e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Address<span className="required-mark">*</span></label>
              <input required value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Contact Person / Coordinator<span className="required-mark">*</span></label>
                <input required value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contact Phone<span className="required-mark">*</span></label>
                <input required value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Contact Email<span className="required-mark">*</span></label>
              <input type="email" required value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Login Email<span className="required-mark">*</span></label>
              <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password<span className="required-mark">*</span></label>
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.password && (
                  <>
                    <div className="strength-meter">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`strength-bar ${i < strength.score ? strengthClass : ""}`} />
                      ))}
                    </div>
                    <span className="field-hint">{strength.label} — 8+ characters with an uppercase letter and a digit</span>
                  </>
                )}
              </div>
              <div className="form-group">
                <label>Confirm Password<span className="required-mark">*</span></label>
                <input type={showPassword ? "text" : "password"} required value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} />
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create School Account"}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
