import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const VALID_TITLES = ["Engr.", "Dr.", "Prof.", "Mr.", "Ms.", "Mrs."];

function buildFacultyName(title, firstName, middleInitial, lastName) {
  if (!title || !firstName || !lastName) return "";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${title} ${firstName.trim()}${mi} ${lastName.trim()}`;
}

function splitTitle(fullName) {
  if (!fullName) return { title: "", name: "" };
  for (const t of VALID_TITLES) {
    if (fullName.startsWith(t + " ")) {
      return { title: t, name: fullName.slice(t.length + 1).trim() };
    }
  }
  return { title: "", name: fullName };
}

function ManageUsers() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Admin";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentUserId = (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      return JSON.parse(atob(token.split(".")[1])).userId;
    } catch {
      return null;
    }
  })();

  // ── State ──────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title: "",
    firstName: "",
    middleInitial: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "TEACHER",
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  // ── Data ───────────────────────────────────────────────────
  const fetchUsers = () => {
    api
      .get("/auth/users")
      .then((r) => setUsers(r.data))
      .catch(() => {});
  };

  // ── Sidebar helper ──────────────────────────────────────────
  const toggleClasses = () => {
    const kids = document.getElementById("sb-kids");
    const chev = document.getElementById("sb-chev");
    if (!kids || !chev) return;
    const isOpen = kids.className.includes("open");
    kids.className = isOpen ? "sb-kids" : "sb-kids open";
    chev.className = isOpen ? "sb-chev" : "sb-chev open";
  };

  // ── Auth ───────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  // ── Form ───────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const previewName = buildFacultyName(
    formData.title,
    formData.firstName,
    formData.middleInitial,
    formData.lastName,
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!formData.title) {
      setError("Please select a title (Engr., Dr., etc.).");
      return;
    }
    setLoading(true);
    api
      .post("/auth/register-admin", {
        title: formData.title,
        firstName: formData.firstName.trim(),
        middleInitial: formData.middleInitial.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      })
      .then((res) => {
        const roleName =
          formData.role === "TEACHER" ? "Faculty" : "Administrator";
        setSuccess(`✅ ${roleName} account created for ${res.data.name}.`);
        setFormData({
          title: "",
          firstName: "",
          middleInitial: "",
          lastName: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: "TEACHER",
        });
        fetchUsers();
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Registration failed.");
        setLoading(false);
      });
  };

  // ── Edit modal ─────────────────────────────────────────────
  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name || "", email: user.email || "" });
    setEditError("");
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditError("");
  };

  const handleEditSave = () => {
    if (!editForm.name.trim()) {
      setEditError("Name cannot be empty.");
      return;
    }
    if (!editForm.email.trim()) {
      setEditError("Email cannot be empty.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    api
      .put(`/auth/users/${editUser.id}`, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
      })
      .then((res) => {
        setSuccess(`✅ Account updated for ${res.data.user.name}.`);
        if (editUser.id === currentUserId) {
          localStorage.setItem("name", res.data.user.name);
        }
        fetchUsers();
        closeEdit();
        setEditLoading(false);
      })
      .catch((err) => {
        setEditError(err.response?.data?.message || "Update failed.");
        setEditLoading(false);
      });
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = (user) => {
    if (user.id === currentUserId) {
      setError("You cannot delete your own account.");
      return;
    }
    if (
      !window.confirm(
        `Delete account for ${user.name}?\n\nThis will also remove them from any subject assignments. This cannot be undone.`,
      )
    )
      return;
    setError("");
    setSuccess("");
    api
      .delete(`/auth/users/${user.id}`)
      .then((res) => {
        setSuccess(`✅ ${res.data.message}`);
        fetchUsers();
      })
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to delete user."),
      );
  };

  // ── Derived ────────────────────────────────────────────────
  const teachers = users.filter((u) => u.role === "TEACHER");
  const admins = users.filter((u) => u.role === "ADMIN");

  // ── Inline styles ──────────────────────────────────────────
  const thStyle = {
    padding: "8px 0",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--ink-muted)",
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
  };

  const tdStyle = {
    padding: "10px 0",
    verticalAlign: "middle",
    borderTop: "1px solid var(--border-soft)",
  };

  const btnEdit = {
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 600,
    fontFamily: "inherit",
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    cursor: "pointer",
    color: "var(--sky-dark)",
    marginLeft: "6px",
    transition: "all 0.15s",
  };

  const btnDel = {
    ...btnEdit,
    color: "#dc2626",
    borderColor: "#fecaca",
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="dashboard">
      {/* ════ SIDEBAR ════ */}
      <aside className="sidebar">
        <div className="sb-top">
          <div className="sb-brand">
            <div className="sb-ic">FC</div>
            <div>
              <span className="sb-name">FaceCloud</span>
              <span className="sb-sub">PUP · CPE</span>
              <div className="sb-online">
                <span className="dot-pulse"></span>SYSTEM ONLINE
              </div>
            </div>
          </div>
        </div>

        <nav className="sb-nav">
          <div className="sb-grp">// MAIN</div>

          <div
            className="sb-link"
            onClick={() => navigate("/admin/AdminDashboard")}
          >
            <span className="sb-icon">⊞</span>Dashboard
          </div>

          <div
            className="sb-link act"
            onClick={() => navigate("/admin/manage-users")}
          >
            <span className="sb-icon">👥</span>Users
          </div>

          <div>
            <button className="sb-dd-par" onClick={toggleClasses}>
              <span
                className="sb-icon"
                style={{ opacity: ".55", fontSize: "13px" }}
              >
                📚
              </span>
              <span style={{ flex: 1 }}>Classes</span>
              <span className="sb-chev" id="sb-chev">
                ›
              </span>
            </button>
            <div className="sb-kids" id="sb-kids">
              <button
                className="sb-kid"
                onClick={() => navigate("/admin/manage-classes")}
              >
                Subjects
              </button>
              <button
                className="sb-kid"
                onClick={() => navigate("/admin/manage-classes")}
              >
                Assign Teachers
              </button>
              <button
                className="sb-kid"
                onClick={() => navigate("/admin/manage-classes")}
              >
                Enrollments
              </button>
            </div>
          </div>

          <div className="sb-link" onClick={() => navigate("/admin/sections")}>
            <span className="sb-icon">🏫</span>Sections
          </div>

          <div className="sb-grp">// ANALYTICS</div>

          <div className="sb-link" onClick={() => navigate("/admin/reports")}>
            <span className="sb-icon">📊</span>Reports
          </div>
        </nav>

        <div className="sb-foot">
          <div className="sb-usr">
            <div className="sb-av">{initials}</div>
            <div>
              <div className="sb-uname">{userName}</div>
              <div className="sb-urole">ADMIN</div>
            </div>
            <button className="sb-logout" onClick={handleLogout} title="Logout">
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* ════ MAIN AREA ════ */}
      <div className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <span className="tb-title">Manage Users</span>
          <span className="tb-date">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {/* Content */}
        <main className="main-content">
          <div style={{ marginBottom: "8px" }}>
            <button
              onClick={() => navigate("/admin/AdminDashboard")}
              className="btn-back"
            >
              ← Back to Dashboard
            </button>
          </div>

          <div className="page-header">
            <h1 className="page-title">Manage Users</h1>
            <p className="page-subtitle">
              Create, edit, and manage faculty and administrator accounts.
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* ── Create form ── */}
          <div className="user-management-card">
            <div
              style={{
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <p className="section-title">
                Create New Faculty / Admin Account
              </p>
              <p className="section-subtitle" style={{ marginBottom: 0 }}>
                Add a new faculty member or administrator to the system.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Row 1: Title + Last Name */}
              <div
                className="form-row"
                style={{
                  gridTemplateColumns: "140px 1fr",
                  marginBottom: "14px",
                }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Title</label>
                  <select
                    name="title"
                    className="form-select"
                    value={formData.title}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="">— Select —</option>
                    {VALID_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    className="form-input"
                    placeholder="e.g. Dela Cruz"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Row 2: First Name + MI + Role */}
              <div
                className="form-row"
                style={{
                  gridTemplateColumns: "1fr 100px 160px",
                  marginBottom: "14px",
                }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    className="form-input"
                    placeholder="e.g. Juan"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    M.I.{" "}
                    <span
                      style={{
                        color: "var(--ink-faint)",
                        fontWeight: 400,
                        fontSize: "11px",
                      }}
                    >
                      (opt.)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="middleInitial"
                    className="form-input"
                    placeholder="R"
                    maxLength={1}
                    style={{ textAlign: "center" }}
                    value={formData.middleInitial}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Role</label>
                  <select
                    name="role"
                    className="form-select"
                    value={formData.role}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  >
                    <option value="TEACHER">Faculty</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
              </div>

              {/* Name preview */}
              {previewName && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "var(--sky-5)",
                    border: "1px solid rgba(14,165,233,0.2)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 14px",
                    marginBottom: "14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--sky-dark)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Preview
                  </span>
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {previewName}
                  </span>
                </div>
              )}

              {/* Email */}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="e.g. juan.delacruz@pup.edu.ph"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              {/* Row 3: Password + Confirm */}
              <div
                className="form-row"
                style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "14px" }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    name="password"
                    className="form-input"
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-input"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ maxWidth: "220px" }}
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>
          </div>

          {/* ── User list ── */}
          <div className="user-management-card" style={{ marginTop: "24px" }}>
            <p className="section-title" style={{ marginBottom: "20px" }}>
              All Users
            </p>

            {/* Faculty */}
            <div style={{ marginBottom: "28px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-muted)",
                  marginBottom: "10px",
                }}
              >
                👨‍🏫 Faculty ({teachers.length})
              </p>
              {teachers.length === 0 ? (
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--ink-faint)",
                    fontStyle: "italic",
                  }}
                >
                  No faculty accounts yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: "30%" }}>Name</th>
                      <th style={{ ...thStyle, width: "36%" }}>Email</th>
                      <th
                        style={{ ...thStyle, width: "14%", textAlign: "right" }}
                      >
                        Created
                      </th>
                      <th
                        style={{ ...thStyle, width: "20%", textAlign: "right" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>
                          {u.name}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "var(--ink-muted)",
                            fontSize: "13px",
                          }}
                        >
                          {u.email}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "var(--ink-faint)",
                            fontSize: "12px",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(u.createdAt).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button
                            style={btnEdit}
                            onClick={() => openEdit(u)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--sky-5)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "var(--white)";
                            }}
                          >
                            ✏️ Edit
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              style={btnDel}
                              onClick={() => handleDelete(u)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#fef2f2";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "var(--white)";
                              }}
                            >
                              🗑 Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Administrators */}
            <div style={{ marginBottom: "8px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-muted)",
                  marginBottom: "10px",
                }}
              >
                🔐 Administrators ({admins.length})
              </p>
              {admins.length === 0 ? (
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--ink-faint)",
                    fontStyle: "italic",
                  }}
                >
                  No admin accounts yet.
                </p>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: "30%" }}>Name</th>
                      <th style={{ ...thStyle, width: "36%" }}>Email</th>
                      <th
                        style={{ ...thStyle, width: "14%", textAlign: "right" }}
                      >
                        Created
                      </th>
                      <th
                        style={{ ...thStyle, width: "20%", textAlign: "right" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>
                          {u.name}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "var(--ink-muted)",
                            fontSize: "13px",
                          }}
                        >
                          {u.email}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "var(--ink-faint)",
                            fontSize: "12px",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(u.createdAt).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button
                            style={btnEdit}
                            onClick={() => openEdit(u)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--sky-5)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "var(--white)";
                            }}
                          >
                            ✏️ Edit
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              style={btnDel}
                              onClick={() => handleDelete(u)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#fef2f2";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "var(--white)";
                              }}
                            >
                              🗑 Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ════ EDIT MODAL ════ */}
      {editUser && (
        <>
          <div
            onClick={closeEdit}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 1001,
              width: "min(480px,94vw)",
              background: "var(--white)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
              padding: "32px 36px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: "4px",
                  }}
                >
                  Edit Account
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--ink-muted)",
                    margin: 0,
                  }}
                >
                  {editUser.role === "TEACHER" ? "Faculty" : "Administrator"} ·{" "}
                  {editUser.email}
                </p>
              </div>
              <button
                onClick={closeEdit}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "var(--ink-muted)",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div
                className="alert alert-error"
                style={{ marginBottom: "16px" }}
              >
                {editError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Engr. Juan R. Dela Cruz"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                disabled={editLoading}
                autoFocus
              />
              <p className="form-help">
                Include title — e.g. Engr. Juan R. Dela Cruz
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. juan@gmail.com"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, email: e.target.value }))
                }
                disabled={editLoading}
              />
              <p className="form-help">
                This is the email used to log in. If using Google SSO, it must
                match their Google account.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {editLoading ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={closeEdit}
                disabled={editLoading}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ManageUsers;
