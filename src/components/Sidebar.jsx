import React from "react";
// Sidebar.jsx — shared sidebar for ALL pages (admin + teacher)
// Props:
//   role        "ADMIN" | "TEACHER"
//   activePage  current page id (matches ADMIN_NAV/TEACHER_NAV ids)
//   dark        boolean
//   onToggleDark fn
//   onLogout    fn
import { useNavigate, useLocation } from "react-router-dom";

const ADMIN_NAV = [
  { id: "dashboard",  label: "Dashboard", icon: "⊞", path: "/admin/AdminDashboard" },
  { id: "users",      label: "Users",     icon: "◎", path: "/admin/manage-users"   },
  {
    id: "classes", label: "Classes", icon: "◈",
    children: [
      { id: "classes-subjects",  label: "Subjects",        path: "/admin/manage-classes?tab=subjects"  },
      { id: "classes-teachers",  label: "Assign Teachers", path: "/admin/manage-classes?tab=teachers"  },
      { id: "classes-enroll",    label: "Enrollment",      path: "/admin/manage-classes?tab=enroll"    },
    ],
  },
  { id: "sections",   label: "Sections",  icon: "⊟", path: "/admin/sections"       },
  { id: "reports",    label: "Reports",   icon: "◫", path: "/admin/reports"         },
];

const TEACHER_NAV = [
  { id: "teacher-dashboard", label: "My Classes",   icon: "◈", path: "/teacher/TeacherDashboard" },
  { id: "teacher-session",   label: "Live Session", icon: "◉", path: "/teacher/TeacherDashboard" },
];

export default function Sidebar({ role, dark, onToggleDark, onLogout }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const nav        = role === "TEACHER" ? TEACHER_NAV : ADMIN_NAV;
  const userName   = localStorage.getItem("name") || (role === "TEACHER" ? "Teacher" : "Admin");
  const initials   = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // Determine active page from URL
  const path = location.pathname + location.search;
  const getActive = () => {
    if (path.includes("manage-classes")) {
      if (path.includes("tab=teachers")) return "classes-teachers";
      if (path.includes("tab=enroll"))   return "classes-enroll";
      return "classes-subjects";
    }
    if (path.includes("AdminDashboard")) return "dashboard";
    if (path.includes("manage-users"))   return "users";
    if (path.includes("sections"))       return "sections";
    if (path.includes("reports"))        return "reports";
    if (path.includes("TeacherDashboard")) return "teacher-dashboard";
    return "";
  };
  const activePage = getActive();
  const classesOpen = activePage.startsWith("classes");

  const [classOpen, setClassOpen] = React.useState(classesOpen);
  React.useEffect(() => { if (classesOpen) setClassOpen(true); }, [classesOpen]);

  const isActive = (id) =>
    id === "classes"
      ? activePage.startsWith("classes")
      : activePage === id;

  const goTo = (p) => navigate(p);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sb-top">
        <div className="sb-brand">
          <div className="sb-ic">🎓</div>
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
        {nav.map(item => {
          const active = isActive(item.id);
          if (item.children) {
            return (
              <div key={item.id}>
                <button
                  className={`sb-dd-par${active ? " act" : ""}`}
                  onClick={() => setClassOpen(o => !o)}
                >
                  <span className="sb-icon" style={{ opacity: .55, fontSize: "13px" }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span className={`sb-chev${classOpen ? " open" : ""}`}>▶</span>
                </button>
                <div className={`sb-kids${classOpen ? " open" : ""}`}>
                  {item.children.map(child => (
                    <button
                      key={child.id}
                      className={`sb-kid${activePage === child.id ? " act" : ""}`}
                      onClick={() => goTo(child.path)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
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
        {/* Dark mode toggle */}
        <div className="sb-dark-toggle">
          <span className="sb-dark-label">{dark ? "🌙 Dark" : "☀️ Light"}</span>
          <div
            className="sb-toggle-track"
            style={{ background: dark ? "var(--sky)" : "var(--sb-bd)" }}
            onClick={onToggleDark}
          >
            <div
              className="sb-toggle-thumb"
              style={{ left: dark ? "19px" : "3px" }}
            />
          </div>
        </div>
        {/* User */}
        <div className="sb-usr">
          <div className="sb-av">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-uname" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
            <div className="sb-urole">{role === "TEACHER" ? "FACULTY" : "ADMIN"}</div>
          </div>
          <button className="sb-logout" onClick={onLogout} title="Logout">↩</button>
        </div>
      </div>
    </aside>
  );
}