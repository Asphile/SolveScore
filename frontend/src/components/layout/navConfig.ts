import { Gavel, LayoutDashboard, ScrollText, ShieldCheck, Users } from "lucide-react";
import type { ComponentType } from "react";
import type { UserRole } from "../../types";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ size?: number }>;
  end?: boolean;
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { label: "Competitions", to: "/admin/competitions", icon: LayoutDashboard, end: false },
    { label: "Schools", to: "/admin/schools", icon: Users, end: true },
    { label: "Audit Log", to: "/admin/audit-logs", icon: ScrollText, end: true },
  ],
  JUDGE: [{ label: "Dashboard", to: "/judge", icon: LayoutDashboard, end: true }],
  SCHOOL: [{ label: "Dashboard", to: "/school", icon: LayoutDashboard, end: true }],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrator",
  JUDGE: "Judge",
  SCHOOL: "School",
};

export const ROLE_ICON: Record<UserRole, ComponentType<{ size?: number }>> = {
  ADMIN: ShieldCheck,
  JUDGE: Gavel,
  SCHOOL: Users,
};
