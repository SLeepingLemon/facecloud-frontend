import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const VALID_TITLES = ["Engr.", "Dr.", "Prof.", "Mr.", "Ms.", "Mrs."];

function buildFacultyName(title, firstName, middleInitial, lastName) {
  if (!title || !firstName || !lastName) return "";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${title} ${firstName.trim()}${mi} ${lastName.trim()}`;
}

function ManageUsers({ dark, toggleDark }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Admin";

  const currentUserId = (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      return JSON.parse(atob(token.split(".")[1])).userId;
    } catch { return null; }
  })();

  const [formData, setFormData] = useState({
    title: "", firstName: "", middleInitial: "", lastName: "",
    email: "", password: "", confirmPassword: "", role: "TEACHER",
  });
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [editUser,     setEditUser]     = useState(null);
  const [editForm,     setEditForm]     = useState({ name: "", email: "" });
  const [editLoading,  setEditLoading]  = useState(false);
  const [editError,    setEditError]    = useState("");

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = () => {
    api.get("/auth/users").then(r => setUsers(r.data)).catch(() => {});
  };

  const handleLogout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("name");
    navigate("/");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
  };

  const previewName = buildFacultyName(formData.title, formData.firstName, formData.middleInitial, formData.lastName);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match."); return; }
    if (formData.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!formData.title) { setError("Please select a title."); return; }
    setLoading(true);
    api.post("/auth/register-admin", {
      title: formData.title, firstName: formData.firstName.trim(),
      middleInitial: formData.middleInitial.trim(), lastName: formData.lastName.trim(),
      email: formData.email.trim(), password: formData.password, role: formData.role,
    })
      .then(res => {
        const roleName = formData.role === "TEACHER" ? "Faculty" : "Administrator";
        setSuccess(`✅ ${roleName} account created for ${res.data.name}.`);
        setFormData({ title: "", firstName: "", middleInitial: "", lastName: "", email: "", password: "", confirmPassword: "", role: "TEACHER" });
        setShowModal(false); fetchUsers(); setLoading(false);
      })
      .catch(err => { setError(err.response?.data?.message || "Registration failed."); setLoading(false); });
  };

  const openEdit = (user) => { setEditUser(user); setEditForm({ name: user.name || "", email: user.email || "" }); setEditError(""); };
  const closeEdit = () => { setEditUser(null); setEditError(""); };

  const handleEditSave = () => {
    if (!editForm.name.trim())  { setEditError("Name cannot be empty."); return; }
    if (!editForm.email.trim()) { setEditError("Email cannot be empty."); return; }
    setEditLoading(true); setEditError("");
    api.put(`/auth/users/${editUser.id}`, { name: editForm.name.trim(), email: editForm.email.trim() })
      .then(res => {
        setSuccess(`✅ Account updated for ${res.data.user.name}.`);
        if (editUser.id === currentUserId) localStorage.setItem("name", res.data.user.name);
        fetchUsers(); closeEdit(); setEditLoading(false);
      })
      .catch(err => { setEditError(err.response?.data?.message || "Update failed."); setEditLoading(false); });
  };

  const handleDelete = (user) => {
    if (user.id === currentUserId) { setError("You cannot delete your own account."); return; }
    if (!window.confirm(`Delete account for ${user.name}?\n\nThis cannot be undone.`)) return;
    setError(""); setSuccess("");
    api.delete(`/auth/users/${user.id}`)
      .then(res => { setSuccess(`✅ ${res.data.message}`); fetchUsers(); })
      .catch(err => setError(err.response?.data?.message || "Failed to delete user."));
  };

  const teachers = users.filter(u => u.role === "TEACHER");
  const admins   = users.filter(u => u.role === "ADMIN");
  const fmtDate  = (d) => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  const UserTable = ({ list, label }) => (
    <div className="user-management-card" style={{ marginBottom: "20px", padding: 0 }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{label}</span>
        <span className="badge badge-neutral">{list.length}</span>
      </div>
      <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--ink-faint)" }}>No {label.toLowerCase()} yet.</td></tr>
            ) : list.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)", fontSize: "12.5px" }}>{u.email}</td>
                <td style={{ color: "var(--ink-faint)", fontSize: "12px", whiteSpace: "nowrap" }}>{fmtDate(u.createdAt)}</td>
                <td>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} disabled={u.id === currentUserId}>🗑 Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <Sidebar role="ADMIN" dark={dark} onToggleDark={toggleDark} onLogout={handleLogout} />

      <div className="main-area">
        <div className="topbar">
          <span className="tb-title">Manage Users</span>
          <span className="tb-date">{new Date().toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
        </div>

        <main className="main-content">
          <div className="page-header">
            <div>
              <h1>Manage Users</h1>
              <p>{users.length} registered accounts</p>
            </div>
            <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(""); setSuccess(""); }}>+ Add User</button>
          </div>

          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <UserTable list={teachers} label="Faculty / Teachers" />
          <UserTable list={admins}   label="Administrators" />
        </main>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ width: "520px" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {previewName && (
                <div className="preview-bar">Preview: {previewName}</div>
              )}
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleSubmit} className="user-form">
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px 1fr", gap: "10px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Title</label>
                    <select name="title" className="form-select" value={formData.title} onChange={handleChange} required>
                      <option value="">—</option>
                      {VALID_TITLES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">First Name *</label>
                    <input className="form-input" name="firstName" placeholder="Juan" value={formData.firstName} onChange={handleChange} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">M.I.</label>
                    <input className="form-input" name="middleInitial" placeholder="R" maxLength={1} value={formData.middleInitial} onChange={handleChange} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Last Name *</label>
                    <input className="form-input" name="lastName" placeholder="Santos" value={formData.lastName} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: "10px" }}>
                  <label className="form-label">Email *</label>
                  <input className="form-input" name="email" type="email" placeholder="juan.santos@pup.edu.ph" value={formData.email} onChange={handleChange} required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Password *</label>
                    <input className="form-input" name="password" type="password" placeholder="Min. 6 characters" value={formData.password} onChange={handleChange} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Confirm Password *</label>
                    <input className="form-input" name="confirmPassword" type="password" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: "10px" }}>
                  <label className="form-label">Role</label>
                  <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                    <option value="TEACHER">Teacher</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Creating…" : "Create User"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit — {editUser.name}</h2>
              <button className="modal-close" onClick={closeEdit}>×</button>
            </div>
            <div className="modal-body">
              {editError && <div className="alert alert-error">{editError}</div>}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} autoFocus disabled={editLoading} />
                <p className="form-help">Include title — e.g. Engr. Juan R. Dela Cruz</p>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} disabled={editLoading} />
                <p className="form-help">Must match their Google account for SSO login.</p>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={closeEdit} disabled={editLoading}>Cancel</button>
                <button className="btn btn-primary" onClick={handleEditSave} disabled={editLoading}>{editLoading ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageUsers;