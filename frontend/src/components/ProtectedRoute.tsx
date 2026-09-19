import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../types";
import { AppShell } from "./layout/AppShell";
import { SkeletonBlock } from "./ui/Skeleton";

export function ProtectedShell({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
        <SkeletonBlock height={200} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
