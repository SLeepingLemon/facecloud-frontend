import React from "react";
import logoImg from "../../images/logo.png";
import { useNavigate, useLocation } from "react-router-dom";

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⊞", path: "/admin/AdminDashboard" },
  { id: "users",     label: "Users",     icon: "◎", path: "/admin/manage-users"   },
  { id: "classes",   label: "Classes",   icon: "◈", path: "/admin/manage-classes" },
  { id: "sections",  label: "Sections",  icon: "⊟", path: "/admin/sections"       },
  { id: "reports",   label: "Reports",   icon: "◫", path: "/admin/reports"        },
];

const TEACHER_NAV = [
  { id: "teacher-dashboard", label: "My Classes",   icon: "◈", path: "/teacher/TeacherDashboard" },
  { id: "teacher-session",   label: "Live Session", icon: "◉", path: "/teacher/TeacherDashboard" },
];

export default function Sidebar({ role, dark, onToggleDark, onLogout }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const nav       = role === "TEACHER" ? TEACHER_NAV : ADMIN_NAV;
  const userName  = localStorage.getItem("name") || (role === "TEACHER" ? "Teacher" : "Admin");
  const initials  = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const path = location.pathname;
  const getActive = () => {
    if (path.includes("manage-classes"))   return "classes";
    if (path.includes("AdminDashboard"))   return "dashboard";
    if (path.includes("manage-users"))     return "users";
    if (path.includes("sections"))         return "sections";
    if (path.includes("reports"))          return "reports";
    if (path.includes("TeacherDashboard")) return "teacher-dashboard";
    return "";
  };
  const activePage = getActive();

  const isActive = (id) => activePage === id;

  const goTo = (p) => { navigate(p); setMobileOpen(false); };

  return (
    <>
      {/* Hamburger — only visible on mobile via CSS */}
      <button
        className="sb-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <span /><span /><span />
      </button>

      {/* Backdrop — tapping closes the drawer */}
      {mobileOpen && (
        <div className="sb-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar${mobileOpen ? " sb-open" : ""}`}>
        {/* Brand */}
        <div className="sb-top">
          <div className="sb-brand">
            <div className="sb-ic">
              <img
                src={logoImg}
                alt="FaceCloud logo"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px", display: "block" }}
              />
            </div>
            <div>
              <span className="sb-name">FaceCloud</span>
              <span className="sb-sub">PUP · CPE</span>
            </div>
          </div>
        </div>

        {/* Role chip */}
        <div className="sb-role-chip">
          {role === "TEACHER" ? "— Teacher" : "— Admin"}
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {nav.map((item) => {
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                className={`sb-link${active ? " act" : ""}`}
                onClick={() => goTo(item.path)}
              >
                <span className="sb-icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sb-foot">
          <div className="sb-dark-toggle">
            <span className="sb-dark-label">{dark ? "🌙 Dark" : "☀️ Light"}</span>
            <div
              className="sb-toggle-track"
              style={{ background: dark ? "var(--sky)" : "var(--sb-bd)" }}
              onClick={onToggleDark}
            >
              <div className="sb-toggle-thumb" style={{ left: dark ? "19px" : "3px" }} />
            </div>
          </div>
          <div className="sb-usr">
            <div className="sb-av">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-uname" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userName}
              </div>
              <div className="sb-urole">{role === "TEACHER" ? "FACULTY" : "ADMIN"}</div>
            </div>
            <button className="sb-logout" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </aside>
    </>
  );
}
