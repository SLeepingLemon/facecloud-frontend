import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

function AdminDashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Admin";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const [stats, setStats] = useState({
    teachers: "--",
    students: "--",
    subjects: "--",
    todaySessions: "--",
  });

  useEffect(() => {
    api
      .get("/stats")
      .then((r) => setStats(r.data))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <nav className="dashboard-nav">
          <div className="nav-brand">
            <div className="nav-brand-icon">🎓</div>
            <div className="nav-brand-text">
              <span className="nav-brand-title">FaceCloud</span>
              <span className="nav-brand-sub">PUP · CPE Department</span>
            </div>
          </div>
          <div className="nav-links">
            <button className="nav-link active">Dashboard</button>
            <button
              className="nav-link"
              onClick={() => navigate("/admin/manage-users")}
            >
              Users
            </button>
            <button
              className="nav-link"
              onClick={() => navigate("/admin/manage-classes")}
            >
              Classes
            </button>
            <button
              className="nav-link"
              onClick={() => navigate("/admin/sections")}
            >
              Sections
            </button>
            <button
              className="nav-link"
              onClick={() => navigate("/admin/reports")}
            >
              Reports
            </button>
          </div>
          <div className="dashboard-user">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-role">Administrator</div>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </nav>
      </header>

      <main className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome, {userName}!</h2>
          <p>Manage your attendance system from this central dashboard.</p>
        </div>

        {/* System Overview */}
        <div className="quick-stats">
          <h2 className="section-title">System Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👨‍🏫</div>
              <div className="stat-content">
                <div className="stat-label">Teachers</div>
                <div className="stat-value">{stats.teachers}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-label">Students</div>
                <div className="stat-value">{stats.students}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📚</div>
              <div className="stat-content">
                <div className="stat-label">Subjects</div>
                <div className="stat-value">{stats.subjects}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-label">Today's Sessions</div>
                <div className="stat-value">{stats.todaySessions}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-stats">
          <h2 className="section-title">Quick Actions</h2>
        </div>
        <div className="dashboard-grid">
          <div
            className="card-item card-clickable"
            onClick={() => navigate("/admin/manage-users")}
          >
            <div className="card-icon">👥</div>
            <h3 className="card-title">Manage Users</h3>
            <p>Create and manage faculty and administrator accounts</p>
          </div>
          <div
            className="card-item card-clickable"
            onClick={() => navigate("/admin/manage-classes")}
          >
            <div className="card-icon">📚</div>
            <h3 className="card-title">Manage Classes</h3>
            <p>Create subjects, manage students, and handle enrollments</p>
          </div>
          <div
            className="card-item card-clickable"
            onClick={() => navigate("/admin/sections")}
          >
            <div className="card-icon">🏫</div>
            <h3 className="card-title">Sections</h3>
            <p>View all students grouped by their section</p>
          </div>
          <div
            className="card-item card-clickable"
            onClick={() => navigate("/admin/reports")}
          >
            <div className="card-icon">📊</div>
            <h3 className="card-title">View Reports</h3>
            <p>Access attendance reports and analytics</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
