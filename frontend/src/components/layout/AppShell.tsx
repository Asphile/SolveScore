import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Moon,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { BrandLockup } from "../ui/BrandLockup";
import { NAV_BY_ROLE, ROLE_ICON, ROLE_LABEL } from "./navConfig";

const SIDEBAR_STATE_KEY = "solvescore_sidebar_collapsed";

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { resolved, setPreference } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STATE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  if (!user) return <>{children}</>;

  const navItems = NAV_BY_ROLE[user.role];
  const RoleIcon = ROLE_ICON[user.role];

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          {collapsed ? (
            <span className="brand-mark-sm" title="Samsung SolveScore" aria-label="Samsung SolveScore">
              S
            </span>
          ) : (
            <BrandLockup size="sm" theme="dark" />
          )}
          <button className="icon-btn mobile-only" style={{ marginLeft: "auto", color: "white" }} onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">{collapsed ? "•••" : ROLE_LABEL[user.role]}</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && <div className="powered-by-samsung">Powered by Samsung Solve for Tomorrow</div>}
          <button className="sidebar-collapse-btn" onClick={toggleCollapsed}>
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <RoleIcon size={18} />
            <span className="topbar-title topbar-title-desktop">{ROLE_LABEL[user.role]} Workspace</span>
          </div>

          <div className="topbar-right">
            <button
              className="icon-btn"
              onClick={() => setPreference(resolved === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
              title="Toggle theme"
            >
              {resolved === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="profile-menu-wrap">
              <button className="profile-chip" onClick={() => setProfileOpen((p) => !p)}>
                <span className="avatar">{initials(user.first_name, user.last_name)}</span>
                <span className="profile-chip-text mobile-hide-text">
                  <div className="profile-chip-name">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="profile-chip-role">{ROLE_LABEL[user.role]}</div>
                </span>
              </button>
              {profileOpen && (
                <div className="dropdown-panel">
                  <div style={{ padding: "6px 10px 10px" }}>
                    <div className="profile-chip-name">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="profile-chip-role">{user.email}</div>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => setPreference("system")}>
                    <UserIcon size={15} /> Use system theme
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="shell-main">{children}</main>
      </div>

      <nav className="bottom-nav">
        {navItems.slice(0, 4).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
