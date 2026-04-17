import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function ManageClasses() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem("name") || "Admin";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState(location.state?.tab || "subjects");

  const [subjects, setSubjects] = useState([]);
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    description: "",
    schedules: [{ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }],
  });
  const [deletingId, setDeletingId] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] =
    useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const [selectedSubject, setSelectedSubject] = useState("");
  const [enrollingSectionId, setEnrollingSectionId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    fetchSubjects();
    fetchTeachers();
    api
      .get("/sections")
      .then((r) => setSections(r.data))
      .catch(() => {});
  };
  const fetchSubjects = () => {
    api
      .get("/subjects")
      .then((r) => setSubjects(r.data))
      .catch(() => {});
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

  // ── Subjects ──
  const handleSubjectChange = (e) => {
    const { name, value } = e.target;
    setSubjectForm((p) => ({ ...p, [name]: value }));
  };
  const handleScheduleChange = (index, field, value) =>
    setSubjectForm((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s, i) =>
        i !== index
          ? s
          : { ...s, [field]: field === "dayOfWeek" ? parseInt(value) : value },
      ),
    }));
  const addSchedule = () =>
    setSubjectForm((p) => ({
      ...p,
      schedules: [
        ...p.schedules,
        { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" },
      ],
    }));
  const removeSchedule = (index) =>
    setSubjectForm((p) => ({
      ...p,
      schedules: p.schedules.filter((_, i) => i !== index),
    }));

  const handleSubjectSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    api
      .post("/subjects", subjectForm)
      .then(() => {
        setSuccess("Subject created!");
        setSubjectForm({
          name: "",
          code: "",
          description: "",
          schedules: [{ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }],
        });
        fetchSubjects();
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed.");
        setLoading(false);
      });
  };

  const handleStartEdit = (subject) => {
    setEditingSubjectId(subject.id);
    setEditForm({
      name: subject.name,
      code: subject.code,
      description: subject.description || "",
      schedules:
        subject.schedules.length > 0
          ? subject.schedules.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            }))
          : [{ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }],
    });
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
  const handleEditScheduleChange = (index, field, value) =>
    setEditForm((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s, i) =>
        i !== index
          ? s
          : { ...s, [field]: field === "dayOfWeek" ? parseInt(value) : value },
      ),
    }));
  const addEditSchedule = () =>
    setEditForm((p) => ({
      ...p,
      schedules: [
        ...p.schedules,
        { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" },
      ],
    }));
  const removeEditSchedule = (index) =>
    setEditForm((p) => ({
      ...p,
      schedules: p.schedules.filter((_, i) => i !== index),
    }));

  const handleSaveEdit = (subjectId) => {
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setError("Name and code required.");
      return;
    }
    if (editForm.schedules.length === 0) {
      setError("At least one schedule required.");
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
        schedules: editForm.schedules,
      })
      .then((res) => {
        setSubjects((prev) =>
          prev.map((s) => (s.id === subjectId ? res.data.subject : s)),
        );
        setSuccess(`Subject "${res.data.subject.name}" updated.`);
        setEditingSubjectId(null);
        setEditForm(null);
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
        setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
        setSuccess(`"${subjectName}" deleted.`);
        if (selectedSubject === String(subjectId)) setSelectedSubject("");
        if (selectedSubjectForTeacher === String(subjectId))
          setSelectedSubjectForTeacher("");
        if (editingSubjectId === subjectId) handleCancelEdit();
        setDeletingId(null);
      })
      .catch((err) => {
        setDeletingId(null);
        setError(
          err.response
            ? `Delete failed (${err.response.status}): ${err.response.data?.message || "Unknown"}`
            : "No response from server.",
        );
      });
  };

  // ── Teachers ──
  const handleAssignTeacher = () => {
    if (!selectedSubjectForTeacher || !selectedTeacher) {
      setError("Select both.");
      return;
    }
    setError("");
    setSuccess("");
    api
      .post("/subjects/assign-teacher", {
        subjectId: parseInt(selectedSubjectForTeacher),
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
    if (!window.confirm("Remove this teacher?")) return;
    api
      .post("/subjects/remove-teacher", { subjectId, teacherId })
      .then(() => {
        setSuccess("Teacher removed.");
        fetchSubjects();
      })
      .catch(() => setError("Failed."));
  };

  // ── Enrollments ──
  const handleRemoveEnrollment = (subjectId, studentId) => {
    if (!window.confirm("Remove this student?")) return;
    api
      .delete("/subjects/remove-enrollment", { data: { subjectId, studentId } })
      .then(() => {
        setSuccess("Removed.");
        fetchSubjects();
      })
      .catch(() => setError("Failed."));
  };

  const handleEnrollSection = (section) => {
    if (!selectedSubject) {
      setError("Select a subject first.");
      return;
    }
    const subj = subjects.find((s) => s.id === parseInt(selectedSubject));
    if (
      !window.confirm(
        `Enroll all students from "${section}" into "${subj?.name}"?\nAlready-enrolled students are skipped.`,
      )
    )
      return;
    setEnrollingSectionId(section);
    setError("");
    setSuccess("");
    api
      .post("/subjects/enroll-section", {
        subjectId: parseInt(selectedSubject),
        section,
      })
      .then((res) => {
        setSuccess(res.data.message);
        fetchSubjects();
        setEnrollingSectionId(null);
      })
      .catch((err) => {
        setEnrollingSectionId(null);
        setError(err.response?.data?.message || "Failed.");
      });
  };

  const getDayName = (d) => DAYS[d];

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
            <button
              className="nav-link"
              onClick={() => navigate("/admin/AdminDashboard")}
            >
              Dashboard
            </button>
            <button
              className="nav-link"
              onClick={() => navigate("/admin/manage-users")}
            >
              Users
            </button>
            <button className="nav-link active">Classes</button>
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
        <div style={{ marginBottom: "8px" }}>
          <button
            onClick={() => navigate("/admin/AdminDashboard")}
            className="btn-back"
          >
            ← Back to Dashboard
          </button>
        </div>
        <div className="page-header">
          <h1 className="page-title">Manage Classes</h1>
          <p className="page-subtitle">
            Subjects, teacher assignments, and enrollments.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="tab-navigation">
          <button
            className={"tab-btn" + (activeTab === "subjects" ? " active" : "")}
            onClick={() => setActiveTab("subjects")}
          >
            📚 Subjects
          </button>
          <button
            className={"tab-btn" + (activeTab === "teachers" ? " active" : "")}
            onClick={() => setActiveTab("teachers")}
          >
            👨‍🏫 Assign Teachers
          </button>
          <button
            className={
              "tab-btn" + (activeTab === "enrollments" ? " active" : "")
            }
            onClick={() => setActiveTab("enrollments")}
          >
            📝 Enrollments
          </button>
        </div>

        {/* ── SUBJECTS TAB ── */}
        {activeTab === "subjects" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Add New Subject</p>
              <form onSubmit={handleSubjectSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Subject Code</label>
                    <input
                      type="text"
                      name="code"
                      className="form-input"
                      placeholder="e.g. CPE305"
                      value={subjectForm.code}
                      onChange={handleSubjectChange}
                      required
                    />
                    <p className="form-help">
                      Must match SUBJECT_CODES on the Pi.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject Name</label>
                    <input
                      type="text"
                      name="name"
                      className="form-input"
                      placeholder="e.g. Embedded Systems"
                      value={subjectForm.name}
                      onChange={handleSubjectChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Description{" "}
                    <span
                      style={{
                        color: "var(--ink-faint)",
                        fontWeight: 400,
                        fontSize: "12px",
                      }}
                    >
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="description"
                    className="form-input"
                    placeholder="Brief description"
                    value={subjectForm.description}
                    onChange={handleSubjectChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weekly Schedule</label>
                  {subjectForm.schedules.map((schedule, index) => (
                    <div key={index} className="schedule-row">
                      <select
                        className="form-select"
                        value={schedule.dayOfWeek}
                        onChange={(e) =>
                          handleScheduleChange(
                            index,
                            "dayOfWeek",
                            e.target.value,
                          )
                        }
                      >
                        {DAYS.map((d, i) => (
                          <option key={i} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        className="form-input"
                        value={schedule.startTime}
                        onChange={(e) =>
                          handleScheduleChange(
                            index,
                            "startTime",
                            e.target.value,
                          )
                        }
                      />
                      <input
                        type="time"
                        className="form-input"
                        value={schedule.endTime}
                        onChange={(e) =>
                          handleScheduleChange(index, "endTime", e.target.value)
                        }
                      />
                      {subjectForm.schedules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSchedule(index)}
                          className="btn-icon"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSchedule}
                    className="btn-secondary"
                    style={{ marginTop: "8px" }}
                  >
                    + Add Schedule
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ maxWidth: "180px" }}
                >
                  {loading ? "Creating…" : "Create Subject"}
                </button>
              </form>
            </div>

            <div className="management-section">
              <p className="section-title">All Subjects</p>
              {subjects.length === 0 ? (
                <div className="empty-state">
                  <p>No subjects yet. Create one above.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Schedules</th>
                        <th>Teachers</th>
                        <th>Students</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject) => (
                        <tr key={subject.id}>
                          <td>
                            <span className="subject-code">{subject.code}</span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{subject.name}</td>
                          <td
                            style={{
                              fontSize: "13px",
                              color: "var(--ink-muted)",
                            }}
                          >
                            {subject.schedules.length === 0
                              ? "No schedule"
                              : subject.schedules.map((s, i) => (
                                  <div key={i}>
                                    {getDayName(s.dayOfWeek)} {s.startTime}–
                                    {s.endTime}
                                  </div>
                                ))}
                          </td>
                          <td style={{ fontSize: "13px" }}>
                            {subject.teachers.length === 0 ? (
                              <span style={{ color: "var(--ink-faint)" }}>
                                Unassigned
                              </span>
                            ) : (
                              subject.teachers.map((t) => (
                                <div key={t.id}>{t.teacher.name}</div>
                              ))
                            )}
                          </td>
                          <td
                            style={{
                              fontSize: "13px",
                              color: "var(--ink-muted)",
                            }}
                          >
                            {subject.enrollments.length}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="btn-secondary"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() => handleStartEdit(subject)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-delete"
                                disabled={deletingId === subject.id}
                                onClick={(e) =>
                                  handleDeleteSubject(
                                    e,
                                    subject.id,
                                    subject.name,
                                  )
                                }
                              >
                                {deletingId === subject.id ? "…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ASSIGN TEACHERS TAB ── */}
        {activeTab === "teachers" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Assign Teacher to Subject</p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select
                    className="form-select"
                    value={selectedSubjectForTeacher}
                    onChange={(e) =>
                      setSelectedSubjectForTeacher(e.target.value)
                    }
                  >
                    <option value="">— Choose subject —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Teacher</label>
                  <select
                    className="form-select"
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                  >
                    <option value="">— Choose teacher —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ maxWidth: "180px" }}
                onClick={handleAssignTeacher}
              >
                Assign Teacher
              </button>
            </div>

            <div className="management-section">
              <p className="section-title">Current Assignments</p>
              {subjects.every((s) => s.teachers.length === 0) ? (
                <div className="empty-state">
                  <p>No teacher assignments yet.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Schedule</th>
                        <th>Teacher</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject) =>
                        subject.teachers.map((st) => (
                          <tr key={`${subject.id}-${st.teacher.id}`}>
                            <td style={{ fontWeight: 500 }}>{subject.name}</td>
                            <td>
                              <span className="subject-code">
                                {subject.code}
                              </span>
                            </td>
                            <td
                              style={{
                                fontSize: "13px",
                                color: "var(--ink-muted)",
                              }}
                            >
                              {subject.schedules.length === 0
                                ? "No schedule"
                                : subject.schedules.map((s, i) => (
                                    <div key={i}>
                                      {getDayName(s.dayOfWeek)} {s.startTime}–
                                      {s.endTime}
                                    </div>
                                  ))}
                            </td>
                            <td>{st.teacher.name}</td>
                            <td>
                              <button
                                className="btn-delete"
                                onClick={() =>
                                  handleRemoveTeacher(subject.id, st.teacher.id)
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ENROLLMENTS TAB ── */}
        {activeTab === "enrollments" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Enroll Students</p>
              <div className="form-group" style={{ maxWidth: "400px" }}>
                <label className="form-label">Select Subject</label>
                <select
                  className="form-select"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                  <option value="">— Choose —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSubject && (
                <div
                  style={{
                    background: "var(--pup-red-ghost)",
                    border: "1px solid var(--pup-red-light)",
                    borderRadius: "var(--radius)",
                    padding: "16px 20px",
                    marginBottom: "24px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--pup-red)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "8px",
                    }}
                  >
                    ⚡ Enroll Entire Section
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--ink-muted)",
                      marginBottom: "12px",
                    }}
                  >
                    Enroll all students from a section at once. Already-enrolled
                    are skipped.
                  </p>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {sections.length === 0 ? (
                      <p
                        style={{ fontSize: "13px", color: "var(--ink-faint)" }}
                      >
                        No sections found.
                      </p>
                    ) : (
                      sections.map((section) => {
                        const isEnrolling = enrollingSectionId === section;
                        return (
                          <button
                            key={section}
                            type="button"
                            disabled={isEnrolling}
                            onClick={() => handleEnrollSection(section)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 14px",
                              background: isEnrolling
                                ? "var(--border)"
                                : "var(--pup-red)",
                              color: isEnrolling ? "var(--ink-muted)" : "#fff",
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "13px",
                              fontWeight: 600,
                              fontFamily: "inherit",
                              cursor: isEnrolling ? "not-allowed" : "pointer",
                              transition: "all 0.18s",
                            }}
                          >
                            {isEnrolling ? "Enrolling…" : section}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="management-section">
              <p className="section-title">Current Enrollments</p>
              {subjects.every((s) => s.enrollments.length === 0) ? (
                <div className="empty-state" style={{ padding: "36px 0" }}>
                  <p>No enrollments yet.</p>
                </div>
              ) : (
                subjects.map((subject) => {
                  if (subject.enrollments.length === 0) return null;
                  return (
                    <div key={subject.id} className="enrollment-card">
                      <h3>
                        {subject.name}{" "}
                        <span
                          style={{
                            fontFamily: "inherit",
                            fontWeight: 400,
                            fontSize: "12px",
                            color: "var(--ink-faint)",
                          }}
                        >
                          ({subject.code})
                        </span>
                      </h3>
                      <div className="enrolled-students">
                        {subject.enrollments.map((e) => {
                          const dn = e.student
                            ? formatDisplayName(
                                e.student.surname,
                                e.student.firstName,
                                e.student.middleInitial,
                              )
                            : "Unknown";
                          return (
                            <span
                              key={e.id}
                              className="enrolled-student-tag"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              {dn}
                              <button
                                onClick={() =>
                                  handleRemoveEnrollment(
                                    subject.id,
                                    e.student.id,
                                  )
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--ink-faint)",
                                  fontSize: "12px",
                                  lineHeight: 1,
                                  padding: "0 2px",
                                }}
                                title="Remove"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── EDIT SUBJECT MODAL ── */}
        {editingSubjectId && editForm && (
          <>
            <div
              onClick={handleCancelEdit}
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
                width: "min(720px,94vw)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "var(--white)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                padding: "32px 40px",
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
                    Edit Subject
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                    Changes take effect immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
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
              <div className="form-row" style={{ marginBottom: "14px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subject Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={editForm.name}
                    onChange={handleEditChange}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subject Code</label>
                  <input
                    type="text"
                    name="code"
                    className="form-input"
                    value={editForm.code}
                    onChange={handleEditChange}
                    required
                  />
                  <p className="form-help">
                    Must match SUBJECT_CODES on the Pi.
                  </p>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  name="description"
                  className="form-input"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Weekly Schedule</label>
                {editForm.schedules.map((schedule, index) => (
                  <div key={index} className="schedule-row">
                    <select
                      className="form-select"
                      value={schedule.dayOfWeek}
                      onChange={(e) =>
                        handleEditScheduleChange(
                          index,
                          "dayOfWeek",
                          e.target.value,
                        )
                      }
                    >
                      {DAYS.map((d, i) => (
                        <option key={i} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      className="form-input"
                      value={schedule.startTime}
                      onChange={(e) =>
                        handleEditScheduleChange(
                          index,
                          "startTime",
                          e.target.value,
                        )
                      }
                    />
                    <input
                      type="time"
                      className="form-input"
                      value={schedule.endTime}
                      onChange={(e) =>
                        handleEditScheduleChange(
                          index,
                          "endTime",
                          e.target.value,
                        )
                      }
                    />
                    {editForm.schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEditSchedule(index)}
                        className="btn-icon"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEditSchedule}
                  className="btn-secondary"
                  style={{ marginTop: "8px" }}
                >
                  + Add Schedule
                </button>
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  margin: "20px 0",
                }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  disabled={savingId !== null}
                  onClick={() => handleSaveEdit(editingSubjectId)}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {savingId !== null ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  disabled={savingId !== null}
                  onClick={handleCancelEdit}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default ManageClasses;
