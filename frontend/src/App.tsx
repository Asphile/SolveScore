import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedShell } from "./components/ProtectedRoute";
import { SkeletonBlock } from "./components/ui/Skeleton";
import { LandingPage } from "./pages/public/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SchoolRegisterPage } from "./pages/SchoolRegisterPage";
import { SchoolDashboard } from "./pages/school/SchoolDashboard";
import { CompetitionDetailPage } from "./pages/school/CompetitionDetailPage";
import { ApplicationWizardPage } from "./pages/school/ApplicationWizardPage";
import { ApplicationResultsPage } from "./pages/school/ApplicationResultsPage";
import { JudgeDashboard } from "./pages/judge/JudgeDashboard";
import { JudgeEvaluationPage } from "./pages/judge/JudgeEvaluationPage";
import { AdminCompetitionsListPage } from "./pages/admin/AdminCompetitionsListPage";
import { CompetitionCommandCenter } from "./pages/admin/CompetitionCommandCenter";
import { AdminSchoolsPage } from "./pages/admin/AdminSchoolsPage";
import { AdminAuditLogPage } from "./pages/admin/AdminAuditLogPage";
import { OverviewTab } from "./pages/admin/tabs/OverviewTab";
import { ApplicationsTab } from "./pages/admin/tabs/ApplicationsTab";
import { RubricTab } from "./pages/admin/tabs/RubricTab";
import { JudgesTab } from "./pages/admin/tabs/JudgesTab";
import { MonitoringTab } from "./pages/admin/tabs/MonitoringTab";
import { ResultsTab } from "./pages/admin/tabs/ResultsTab";

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
        <SkeletonBlock height={200} />
      </div>
    );
  }
  if (!user) return <LandingPage />;
  if (user.role === "ADMIN") return <Navigate to="/admin/competitions" replace />;
  if (user.role === "JUDGE") return <Navigate to="/judge" replace />;
  return <Navigate to="/school" replace />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<SchoolRegisterPage />} />

          <Route element={<ProtectedShell roles={["SCHOOL"]} />}>
            <Route path="/school" element={<SchoolDashboard />} />
            <Route path="/school/competitions/:id" element={<CompetitionDetailPage />} />
            <Route path="/school/applications/:id" element={<ApplicationWizardPage />} />
            <Route path="/school/applications/:id/results" element={<ApplicationResultsPage />} />
          </Route>

          <Route element={<ProtectedShell roles={["JUDGE"]} />}>
            <Route path="/judge" element={<JudgeDashboard />} />
            <Route path="/judge/applications/:id" element={<JudgeEvaluationPage />} />
          </Route>

          <Route element={<ProtectedShell roles={["ADMIN"]} />}>
            <Route path="/admin" element={<Navigate to="/admin/competitions" replace />} />
            <Route path="/admin/competitions" element={<AdminCompetitionsListPage />} />
            <Route path="/admin/competitions/:id" element={<CompetitionCommandCenter />}>
              <Route index element={<OverviewTab />} />
              <Route path="applications" element={<ApplicationsTab />} />
              <Route path="rubric" element={<RubricTab />} />
              <Route path="judges" element={<JudgesTab />} />
              <Route path="monitoring" element={<MonitoringTab />} />
              <Route path="results" element={<ResultsTab />} />
            </Route>
            <Route path="/admin/schools" element={<AdminSchoolsPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
