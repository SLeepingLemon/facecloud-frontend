import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function ScheduleRows({ schedules, onChange, onAdd, onRemove }) {
  return (
    <div className="form-group">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <label className="form-label" style={{ margin: 0 }}>Schedule</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd}>+ Add Day</button>
      </div>
      {schedules.map((sched, i) => (
        <div key={i} className="schedule-row">
          <select
            className="form-select"
            value={sched.dayOfWeek}
            onChange={(e) => onChange(i, "dayOfWeek", e.target.value)}
          >
            {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
          </select>
          <input
            type="time"
            className="form-input"
            value={sched.startTime}
            onChange={(e) => onChange(i, "startTime", e.target.value)}
          />
          <input
            type="time"
            className="form-input"
            value={sched.endTime}
            onChange={(e) => onChange(i, "endTime", e.target.value)}
          />
          <button
            type="button"
            className="btn-icon"
            disabled={schedules.length === 1}
            onClick={() => onRemove(i)}
            style={{ opacity: schedules.length === 1 ? 0.4 : 1 }}
          >
            −
          </button>
        </div>
      ))}
    </div>
  );
}

function ManageClasses({ dark, toggleDark }) {
  const navigate = useNavigate();

  const [sections, setSections]   = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [teachers, setTeachers]   = useState([]);

  // Subject form / modals
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", description: "" });
  const [showAddModal, setShowAddModal]       = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editForm, setEditForm]               = useState(null);
  const [deletingId, setDeletingId]           = useState(null);
  const [savingId, setSavingId]               = useState(null);

  // Selected subject (left panel click)
  const [enrollSubjectId, setEnrollSubjectId] = useState("");

  // Teacher assignment
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Section enrollment modal
  const [showEnrollModal, setShowEnrollModal]         = useState(false);
  const [enrollModalSection, setEnrollModalSection]   = useState("");
  const [enrollModalSchedules, setEnrollModalSchedules] = useState([
    { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" },
  ]);
  const [enrollingSection, setEnrollingSection] = useState(false);
  const [removingSection, setRemovingSection]   = useState(null);

  // Enrolled students collapse
  const [showStudents, setShowStudents] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = () => {
    fetchSubjects();
    fetchTeachers();
    api.get("/sections").then((r) => setSections(r.data)).catch(() => {});
  };
  const fetchSubjects = () => {
    api.get("/subjects").then((r) => setSubjects(r.data)).catch(() => {});
  };
  const fetchTeachers = () => {
    api
      .get("/auth/users")
      .then((r) => setTeachers(r.data.filter((u) => u.role === "TEACHER")))
      .catch(() => setTeachers([]));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  // ── Subject form helpers ──────────────────────────────────────────
  const resetForm = () => setSubjectForm({ name: "", code: "", description: "" });
  const handleSubjectChange = (e) => {
    const { name, value } = e.target;
    setSubjectForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubjectSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    api
      .post("/subjects", subjectForm)
      .then(() => {
        setSuccess("Subject created!");
        resetForm();
        setShowAddModal(false);
        fetchSubjects();
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed.");
        setLoading(false);
      });
  };

  // ── Edit helpers ──────────────────────────────────────────────────
  const handleStartEdit = (subject) => {
    setEditingSubjectId(subject.id);
    setEditForm({ name: subject.name, code: subject.code, description: subject.description || "" });
    setError("");
    setSuccess("");
  };
  const handleCancelEdit = () => {
    setEditingSubjectId(null);
    setEditForm(null);
  };
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((p) => ({ ...p, [name]: value }));
  };
  const handleSaveEdit = (subjectId) => {
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setError("Name and code required.");
      return;
    }
    setSavingId(subjectId);
    setError("");
    setSuccess("");
    api
      .put(`/subjects/${subjectId}`, {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        description: editForm.description.trim(),
      })
      .then((res) => {
        setSubjects((p) => p.map((s) => (s.id === subjectId ? res.data.subject : s)));
        setSuccess(`"${res.data.subject.name}" updated.`);
        handleCancelEdit();
        setSavingId(null);
      })
      .catch((err) => {
        setSavingId(null);
        setError(err.response?.data?.message || "Failed.");
      });
  };

  const handleDeleteSubject = (e, subjectId, subjectName) => {
    e.stopPropagation();
    e.preventDefault();
    if (
      !window.confirm(
        `Delete "${subjectName}"?\n\nThis removes all enrollments, teacher assignments, and attendance records. This cannot be undone.`,
      )
    )
      return;
    setDeletingId(subjectId);
    setError("");
    setSuccess("");
    api
      .delete(`/subjects/${subjectId}`)
      .then(() => {
        setSubjects((p) => p.filter((s) => s.id !== subjectId));
        setSuccess(`"${subjectName}" deleted.`);
        if (enrollSubjectId === String(subjectId)) {
          setEnrollSubjectId("");
          setShowStudents(false);
        }
        if (editingSubjectId === subjectId) handleCancelEdit();
        setDeletingId(null);
      })
      .catch((err) => {
        setDeletingId(null);
        setError(
          err.response
            ? `Delete failed: ${err.response.data?.message || "Unknown"}`
            : "No response from server.",
        );
      });
  };

  // ── Teachers ──────────────────────────────────────────────────────
  const handleAssignTeacher = () => {
    if (!enrollSubjectId || !selectedTeacher) {
      setError("Select a teacher to assign.");
      return;
    }
    setError("");
    setSuccess("");
    api
      .post("/subjects/assign-teacher", {
        subjectId: parseInt(enrollSubjectId),
        teacherId: parseInt(selectedTeacher),
      })
      .then(() => {
        setSuccess("Teacher assigned!");
        fetchSubjects();
        setSelectedTeacher("");
      })
      .catch((err) => setError(err.response?.data?.message || "Failed."));
  };

  const handleRemoveTeacher = (subjectId, teacherId) => {
    if (!window.confirm("Remove this teacher from the subject?")) return;
    api
      .post("/subjects/remove-teacher", { subjectId, teacherId })
      .then(() => {
        setSuccess("Teacher removed.");
        fetchSubjects();
      })
      .catch(() => setError("Failed."));
  };

  // ── Enrollments ───────────────────────────────────────────────────
  const handleEnrollSectionWithSchedule = () => {
    if (!enrollSubjectId || !enrollModalSection) {
      setError("Select a section.");
      return;
    }
    if (enrollModalSchedules.length === 0) {
      setError("At least one schedule is required.");
      return;
    }
    setEnrollingSection(true);
    setError("");
    setSuccess("");
    api
      .post("/subjects/enroll-section-schedule", {
        subjectId: parseInt(enrollSubjectId),
        section: enrollModalSection,
        schedules: enrollModalSchedules,
      })
      .then((res) => {
        setSuccess(res.data.message);
        fetchSubjects();
        setShowEnrollModal(false);
        setEnrollingSection(false);
      })
      .catch((err) => {
        setEnrollingSection(false);
        setError(err.response?.data?.message || "Failed.");
      });
  };

  const handleRemoveSection = (section) => {
    const subj = subjects.find((s) => s.id === parseInt(enrollSubjectId));
    if (
      !window.confirm(
        `Remove section "${section}" from "${subj?.name}"?\nThis removes their enrollments and schedules.`,
      )
    )
      return;
    setRemovingSection(section);
    setError("");
    setSuccess("");
    api
      .post("/subjects/remove-section", {
        subjectId: parseInt(enrollSubjectId),
        section,
      })
      .then((res) => {
        setSuccess(res.data.message);
        fetchSubjects();
        setRemovingSection(null);
      })
      .catch((err) => {
        setRemovingSection(null);
        setError(err.response?.data?.message || "Failed.");
      });
  };

  const handleRemoveEnrollment = (subjectId, studentId) => {
    if (!window.confirm("Remove this student from the subject?")) return;
    api
      .delete("/subjects/remove-enrollment", { data: { subjectId, studentId } })
      .then(() => {
        setSuccess("Student removed.");
        fetchSubjects();
      })
      .catch(() => setError("Failed."));
  };

  // ── Derived values ────────────────────────────────────────────────
  const enrolledSubject = subjects.find((s) => s.id === parseInt(enrollSubjectId));

  const enrolledSections = (() => {
    if (!enrolledSubject) return [];
    const sectionMap = {};
    enrolledSubject.schedules.forEach((sch) => {
      if (!sectionMap[sch.section])
        sectionMap[sch.section] = { section: sch.section, schedules: [] };
      sectionMap[sch.section].schedules.push(sch);
    });
    return Object.values(sectionMap).map((item) => ({
      ...item,
      enrolledCount: enrolledSubject.enrollments.filter(
        (e) => e.student?.section === item.section,
      ).length,
    }));
  })();

  const availableSections = sections.filter(
    (sec) => !enrolledSections.find((es) => es.section === sec),
  );

  return (
    <div className="dashboard">
      <Sidebar role="ADMIN" dark={dark} onToggleDark={toggleDark} onLogout={handleLogout} />

      <div className="main-area">
        <div className="topbar">
          <span className="tb-title">Manage Classes</span>
          <span className="tb-date">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "short", year: "numeric", month: "short", day: "numeric",
            })}
          </span>
        </div>

        <main className="main-content">
          <div className="page-header">
            <div>
              <h1>Manage Classes</h1>
              <p>Subjects, teacher assignments, and enrollments</p>
            </div>
          </div>

          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="subject-split-layout">

            {/* ── Left: Subject list ── */}
            <div className="subject-list-panel">
              <div className="subject-list-panel-header">
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%" }}
                  onClick={() => { resetForm(); setShowAddModal(true); }}
                >
                  + New Subject
                </button>
              </div>

              {subjects.length === 0 ? (
                <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--ink-faint)", fontSize: "13px" }}>
                  No subjects yet.
                </div>
              ) : (
                subjects.map((s) => (
                  <div
                    key={s.id}
                    className={`subject-list-item${enrollSubjectId === String(s.id) ? " selected" : ""}`}
                    onClick={() => {
                      setEnrollSubjectId(String(s.id));
                      setShowStudents(false);
                      setSelectedTeacher("");
                      setError("");
                      setSuccess("");
                    }}
                  >
                    <div className="slitem-code">{s.code}</div>
                    <div className="slitem-name">{s.name}</div>
                  </div>
                ))
              )}
            </div>

            {/* ── Right: Subject detail ── */}
            <div className="subject-detail-panel">
              {!enrollSubjectId || !enrolledSubject ? (
                <div className="empty-state">
                  <p>Select a subject from the list to manage it.</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px" }}>
                    <div>
                      <div style={{ marginBottom: "6px" }}>
                        <span className="subject-code">{enrolledSubject.code}</span>
                      </div>
                      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                        {enrolledSubject.name}
                      </h2>
                      {enrolledSubject.description && (
                        <p style={{ fontSize: "13px", color: "var(--ink-faint)", margin: 0 }}>
                          {enrolledSubject.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "16px" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleStartEdit(enrolledSubject)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={deletingId === enrolledSubject.id}
                        onClick={(e) => handleDeleteSubject(e, enrolledSubject.id, enrolledSubject.name)}
                      >
                        {deletingId === enrolledSubject.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>

                  {/* ── Teacher ── */}
                  <div className="management-section">
                    <p className="section-title" style={{ marginBottom: "12px" }}>Teacher</p>
                    {enrolledSubject.teachers.length > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "13px" }}>👨‍🏫</span>
                          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--ink)" }}>
                            {enrolledSubject.teachers[0].teacher.name}
                          </span>
                        </div>
                        <button
                          className="btn-delete"
                          onClick={() =>
                            handleRemoveTeacher(enrolledSubject.id, enrolledSubject.teachers[0].teacher.id)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <p style={{ fontSize: "13px", color: "var(--ink-faint)", marginBottom: "10px" }}>
                          No teacher assigned yet.
                        </p>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <select
                            className="form-select"
                            style={{ maxWidth: "300px" }}
                            value={selectedTeacher}
                            onChange={(e) => setSelectedTeacher(e.target.value)}
                          >
                            <option value="">— Select teacher —</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary btn-sm" onClick={handleAssignTeacher}>
                            Assign
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Sections & Schedules ── */}
                  <div className="management-section">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <p className="section-title" style={{ margin: 0 }}>Sections & Schedules</p>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={availableSections.length === 0}
                        onClick={() => {
                          setEnrollModalSection("");
                          setEnrollModalSchedules([{ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }]);
                          setShowEnrollModal(true);
                        }}
                      >
                        + Add Section
                      </button>
                    </div>

                    {enrolledSections.length === 0 ? (
                      <div style={{
                        padding: "24px",
                        textAlign: "center",
                        color: "var(--ink-faint)",
                        background: "var(--surface2)",
                        borderRadius: "8px",
                        border: "1px dashed var(--border)",
                      }}>
                        No sections enrolled yet. Click <strong>+ Add Section</strong> to get started.
                      </div>
                    ) : (
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Section</th>
                              <th>Schedule</th>
                              <th style={{ textAlign: "center" }}>Students</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrolledSections.map(({ section, schedules, enrolledCount }) => (
                              <tr key={section}>
                                <td>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    background: "var(--sky-4)",
                                    color: "var(--sky-dark)",
                                    borderRadius: "5px",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    fontFamily: "var(--font-mono)",
                                    border: "1px solid rgba(14,165,233,.2)",
                                  }}>
                                    {section}
                                  </span>
                                </td>
                                <td style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                                  {schedules.map((s, i) => (
                                    <div key={i}>
                                      {DAYS[s.dayOfWeek]} {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                                    </div>
                                  ))}
                                </td>
                                <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink-muted)" }}>
                                  {enrolledCount}
                                </td>
                                <td>
                                  <button
                                    className="btn-delete"
                                    disabled={removingSection === section}
                                    onClick={() => handleRemoveSection(section)}
                                  >
                                    {removingSection === section ? "Removing…" : "Remove"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ── Enrolled Students (collapsible) ── */}
                  <div className="management-section">
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                      onClick={() => setShowStudents((p) => !p)}
                    >
                      <span className="section-title" style={{ margin: 0 }}>
                        Enrolled Students
                        <span style={{ fontWeight: 400, fontSize: "12px", color: "var(--ink-faint)", marginLeft: "8px" }}>
                          — {enrolledSubject.enrollments.length} student
                          {enrolledSubject.enrollments.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--sky)", fontWeight: 600 }}>
                        {showStudents ? "Hide" : "Show"}
                      </span>
                    </button>

                    {showStudents && (
                      enrolledSubject.enrollments.length === 0 ? (
                        <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--ink-faint)" }}>
                          No students enrolled yet.
                        </p>
                      ) : (
                        <div className="table-container" style={{ marginTop: "12px" }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th style={{ width: "40px", textAlign: "center" }}>#</th>
                                <th>Student Name</th>
                                <th>Student ID</th>
                                <th style={{ width: "90px" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {enrolledSubject.enrollments.map((e, idx) => {
                                const dn = e.student
                                  ? formatDisplayName(
                                      e.student.surname,
                                      e.student.firstName,
                                      e.student.middleInitial,
                                    )
                                  : "Unknown";
                                return (
                                  <tr key={e.id}>
                                    <td style={{ textAlign: "center", fontSize: "12px", color: "var(--ink-faint)" }}>
                                      {idx + 1}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{dn}</td>
                                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ink-muted)" }}>
                                      {e.student?.studentId || "—"}
                                    </td>
                                    <td>
                                      <button
                                        className="btn-delete"
                                        disabled={!e.student}
                                        onClick={() => handleRemoveEnrollment(enrolledSubject.id, e.student?.id)}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Add Subject Modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" style={{ width: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Subject</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubjectSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Code</label>
                    <input
                      className="form-input"
                      name="code"
                      placeholder="CPE411"
                      value={subjectForm.code}
                      onChange={handleSubjectChange}
                      required
                    />
                    <p className="form-help">Must match Pi SUBJECT_CODES.</p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Subject Name</label>
                    <input
                      className="form-input"
                      name="name"
                      placeholder="Microprocessors…"
                      value={subjectForm.name}
                      onChange={handleSubjectChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: "10px" }}>
                  <label className="form-label">Description (optional)</label>
                  <textarea
                    className="form-input"
                    name="description"
                    value={subjectForm.description}
                    onChange={handleSubjectChange}
                  />
                </div>
                <p className="form-help" style={{ marginBottom: "12px" }}>
                  Sections and schedules are added from the detail panel after creation.
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Creating…" : "Create Subject"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Subject Modal ── */}
      {editingSubjectId && editForm && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-box" style={{ width: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Subject</h2>
              <button className="modal-close" onClick={handleCancelEdit}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "12px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Code</label>
                  <input
                    className="form-input"
                    name="code"
                    value={editForm.code}
                    onChange={handleEditChange}
                    required
                  />
                  <p className="form-help">Must match Pi SUBJECT_CODES.</p>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subject Name</label>
                  <input
                    className="form-input"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: "10px" }}>
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-input"
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={savingId !== null}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSaveEdit(editingSubjectId)}
                  disabled={savingId !== null}
                >
                  {savingId !== null ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Section & Schedule Modal ── */}
      {showEnrollModal && (
        <div className="modal-overlay" onClick={() => setShowEnrollModal(false)}>
          <div className="modal-box" style={{ width: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Section & Schedule</h2>
              <button className="modal-close" onClick={() => setShowEnrollModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Section</label>
                <select
                  className="form-select"
                  value={enrollModalSection}
                  onChange={(e) => setEnrollModalSection(e.target.value)}
                >
                  <option value="">— Choose section —</option>
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
                {availableSections.length === 0 && (
                  <p className="form-help">All sections are already enrolled in this subject.</p>
                )}
              </div>
              <ScheduleRows
                schedules={enrollModalSchedules}
                onChange={(i, field, val) =>
                  setEnrollModalSchedules((p) =>
                    p.map((s, idx) =>
                      idx !== i
                        ? s
                        : { ...s, [field]: field === "dayOfWeek" ? parseInt(val) : val },
                    ),
                  )
                }
                onAdd={() =>
                  setEnrollModalSchedules((p) => [
                    ...p,
                    { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" },
                  ])
                }
                onRemove={(i) =>
                  setEnrollModalSchedules((p) => p.filter((_, idx) => idx !== i))
                }
              />
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEnrollModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={enrollingSection || !enrollModalSection}
                  onClick={handleEnrollSectionWithSchedule}
                >
                  {enrollingSection ? "Enrolling…" : "Enroll Section"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageClasses;
