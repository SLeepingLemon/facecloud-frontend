import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

function AdminDashboard({ dark, toggleDark }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Admin";

  const [stats, setStats] = useState({
    teachers: "--", students: "--", subjects: "--", todaySessions: "--",
  });

  useEffect(() => {
    api.get("/stats")
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div className="dashboard">
      <Sidebar role="ADMIN" dark={dark} onToggleDark={toggleDark} onLogout={handleLogout} />

      <div className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <span className="tb-title">Dashboard</span>
          <span className="tb-date">{today}</span>
        </div>

        <main className="main-content">
          {/* Welcome banner */}
          <div className="welcome-banner" style={{ marginBottom: "24px" }}>
            <div className="welcome-watermark">FC</div>
            <div className="welcome-inner">
              <h2>Welcome back, {userName}!</h2>
              <p>Manage users, classes and attendance from this central hub.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="section-label">System Overview</div>
          <div className="stats-grid">
            {[
              { icon: "👨‍🏫", label: "Teachers",        value: stats.teachers,      sub: "Active faculty"    },
              { icon: "👥",  label: "Students",         value: stats.students,      sub: "Across sections"   },
              { icon: "📚",  label: "Subjects",         value: stats.subjects,      sub: "This semester"     },
              { icon: "📡",  label: "Today's Sessions", value: stats.todaySessions, sub: "Active now"        },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-content">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                  {s.sub && <div className="stat-sub">{s.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="section-label">Quick Actions</div>
          <div className="action-grid">
            {[
              { icon: "👥", title: "Manage Users",   desc: "Create and manage faculty accounts",          path: "/admin/manage-users"    },
              { icon: "📚", title: "Manage Classes", desc: "Subjects, teachers and enrollment",            path: "/admin/manage-classes"  },
              { icon: "🏫", title: "Sections",       desc: "View students grouped by section",             path: "/admin/sections"        },
              { icon: "📊", title: "Reports",        desc: "Attendance analytics and exports",             path: "/admin/reports"         },
            ].map(a => (
              <div key={a.title} className="action-card" onClick={() => navigate(a.path)}>
                <div className="action-icon">{a.icon}</div>
                <div className="action-title">{a.title}</div>
                <div className="action-desc">{a.desc}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;