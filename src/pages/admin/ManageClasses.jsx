import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function ManageClasses({ dark, toggleDark }) {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const tabParam = params.get("tab");
  const initTab =
    tabParam === "teachers"
      ? "teachers"
      : tabParam === "enroll"
        ? "enrollments"
        : "subjects";

  const [activeTab, setActiveTab] = useState(initTab);
  useEffect(() => {
    setActiveTab(initTab);
  }, [tabParam]);

  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Subjects tab
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Teachers tab
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] =
    useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // Enrollments tab
  const [enrollSubjectId, setEnrollSubjectId] = useState("");
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollModalSection, setEnrollModalSection] = useState("");
  const [enrollModalSchedules, setEnrollModalSchedules] = useState([
    { dayOfWeek: 1, startTime: "08:00", endTime: "09:00" },
  ]);
  const [enrollingSection, setEnrollingSection] = useState(false);
  const [removingSection, setRemovingSection] = useState(null);

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

  // ── Subject form helpers ────────────────────────────────────────
  const resetForm = () =>
    setSubjectForm({ name: "", code: "", description: "" });
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

  // ── Edit helpers ────────────────────────────────────────────────
  const handleStartEdit = (subject) => {
    setEditingSubjectId(subject.id);
    setEditForm({
      name: subject.name,
      code: subject.code,
      description: subject.description || "",
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
        setSubjects((p) =>
          p.map((s) => (s.id === subjectId ? res.data.subject : s)),
        );
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
        if (enrollSubjectId === String(subjectId)) setEnrollSubjectId("");
        if (selectedSubjectForTeacher === String(subjectId))
          setSelectedSubjectForTeacher("");
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

  // ── Teachers ────────────────────────────────────────────────────
  const handleAssignTeacher = () => {
    if (!selectedSubjectForTeacher || !selectedTeacher) {
      setError("Select both a subject and a teacher.");
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
    if (!window.confirm("Remove this teacher from the subject?")) return;
    api
      .post("/subjects/remove-teacher", { subjectId, teacherId })
      .then(() => {
        setSuccess("Teacher removed.");
        fetchSubjects();
      })
      .catch(() => setError("Failed."));
  };

  // ── Enrollments ─────────────────────────────────────────────────
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

  // Derive enrolled sections from selected subject's schedules
  const enrolledSubject = subjects.find(
    (s) => s.id === parseInt(enrollSubjectId),
  );
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

  // ── Subject card helper ─────────────────────────────────────────
  const SubjectCard = ({ subject }) => {
    const teacherName =
      subject.teachers.length > 0
        ? subject.teachers.map((t) => t.teacher.name).join(", ")
        : "Unassigned";

    // Group schedules by section for display
    const sectionSchedules = {};
    subject.schedules.forEach((s) => {
      const key = s.section || "(no section)";
      if (!sectionSchedules[key]) sectionSchedules[key] = [];
      sectionSchedules[key].push(s);
    });

    return (
      <div className="subject-card">
        <div className="subject-card-inner">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <span className="subject-code">{subject.code}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className="btn-icon"
                onClick={() => handleStartEdit(subject)}
                title="Edit"
              >
                ✏️
              </button>
              <button
                className="btn-icon"
                style={{
                  background: "var(--red-bg)",
                  borderColor: "var(--red-border)",
                  color: "var(--red)",
                }}
                disabled={deletingId === subject.id}
                onClick={(e) =>
                  handleDeleteSubject(e, subject.id, subject.name)
                }
                title="Delete"
              >
                {deletingId === subject.id ? "…" : "×"}
              </button>
            </div>
          </div>
          <div className="subject-name" style={{ marginBottom: "6px" }}>
            {subject.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "11px" }}>👨‍🏫</span>
            <span style={{ fontSize: "12.5px", color: "var(--ink-muted)" }}>
              {teacherName}
            </span>
          </div>
          <div className="subject-schedule-block">
            <div className="subject-schedule-label">Sections</div>
            {subject.schedules.length === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                No sections enrolled yet
              </span>
            ) : (
              Object.entries(sectionSchedules).map(([sec, scheds]) => (
                <div key={sec} style={{ marginBottom: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "1px 6px",
                      background: "var(--sky-4)",
                      color: "var(--sky-dark)",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      border: "1px solid rgba(14,165,233,.2)",
                      marginBottom: "3px",
                    }}
                  >
                    {sec}
                  </span>
                  {scheds.map((s, i) => (
                    <div key={i} className="subject-sched-row">
                      <span className="subject-day-pill">
                        {DAY_SHORT[s.dayOfWeek]}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: "12px" }}>
            <span className="badge badge-neutral">
              {subject.enrollments.length} students
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ── Schedule form rows (reusable) ───────────────────────────────
  const ScheduleRows = ({ schedules, onChange, onAdd, onRemove }) => (
    <div className="form-group">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <label className="form-label" style={{ margin: 0 }}>
          Schedule
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd}>
          + Add Day
        </button>
      </div>
      {schedules.map((sched, i) => (
        <div key={i} className="schedule-row">
          <select
            className="form-select"
            value={sched.dayOfWeek}
            onChange={(e) => onChange(i, "dayOfWeek", e.target.value)}
          >
            {DAYS.map((d, idx) => (
              <option key={idx} value={idx}>
                {d}
              </option>
            ))}
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

  return (
    <div className="dashboard">
      <Sidebar
        role="ADMIN"
        dark={dark}
        onToggleDark={toggleDark}
        onLogout={handleLogout}
      />

      <div className="main-area">
        <div className="topbar">
          <span className="tb-title">Manage Classes</span>
          <span className="tb-date">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
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

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="tab-navigation">
            <button
              className={`tab-btn${activeTab === "subjects" ? " active" : ""}`}
              onClick={() => setActiveTab("subjects")}
            >
              Subjects
            </button>
            <button
              className={`tab-btn${activeTab === "teachers" ? " active" : ""}`}
              onClick={() => setActiveTab("teachers")}
            >
              Assign Teachers
            </button>
            <button
              className={`tab-btn${activeTab === "enrollments" ? " active" : ""}`}
              onClick={() => setActiveTab("enrollments")}
            >
              Enrollment
            </button>
          </div>

          {/* ── SUBJECTS TAB ── */}
          {activeTab === "subjects" && (
            <div className="tab-content">
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "16px",
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                >
                  + New Subject
                </button>
              </div>
              {subjects.length === 0 ? (
                <div className="empty-state">
                  <h3>No subjects yet</h3>
                  <p>Create one to get started.</p>
                </div>
              ) : (
                <div className="subjects-grid">
                  {subjects.map((s) => (
                    <SubjectCard key={s.id} subject={s} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TEACHERS TAB ── */}
          {activeTab === "teachers" && (
            <div className="tab-content">
              <div className="management-section">
                <p className="section-title">Assign Teacher to Subject</p>
                <p className="section-subtitle">
                  A teacher must be assigned before they can see the subject on
                  their dashboard.
                </p>
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
                  <div className="empty-state" style={{ padding: "32px 0" }}>
                    <p>No teacher assignments yet.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Code</th>
                          <th>Sections</th>
                          <th>Teacher</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((subject) =>
                          subject.teachers.map((st) => (
                            <tr key={`${subject.id}-${st.teacher.id}`}>
                              <td style={{ fontWeight: 500 }}>
                                {subject.name}
                              </td>
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
                                {subject.schedules.length === 0 ? (
                                  <span style={{ color: "var(--ink-faint)" }}>
                                    No sections enrolled
                                  </span>
                                ) : (
                                  [
                                    ...new Set(
                                      subject.schedules.map((s) => s.section),
                                    ),
                                  ].map((sec, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        display: "inline-block",
                                        padding: "1px 6px",
                                        background: "var(--sky-4)",
                                        color: "var(--sky-dark)",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        fontFamily: "var(--font-mono)",
                                        border: "1px solid rgba(14,165,233,.2)",
                                        marginRight: "4px",
                                      }}
                                    >
                                      {sec}
                                    </span>
                                  ))
                                )}
                              </td>
                              <td>{st.teacher.name}</td>
                              <td>
                                <button
                                  className="btn-delete"
                                  onClick={() =>
                                    handleRemoveTeacher(
                                      subject.id,
                                      st.teacher.id,
                                    )
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
                <p className="section-title">Section & Schedule Enrollment</p>
                <p className="section-subtitle">
                  Select a subject, then enroll sections with their specific
                  schedules. Each section can have its own class time.
                </p>
                <div className="form-group" style={{ maxWidth: "400px" }}>
                  <label className="form-label">Select Subject</label>
                  <select
                    className="form-select"
                    value={enrollSubjectId}
                    onChange={(e) => setEnrollSubjectId(e.target.value)}
                  >
                    <option value="">— Choose —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                {enrollSubjectId && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--ink)",
                        }}
                      >
                        Enrolled Sections
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={availableSections.length === 0}
                        onClick={() => {
                          setEnrollModalSection("");
                          setEnrollModalSchedules([
                            {
                              dayOfWeek: 1,
                              startTime: "08:00",
                              endTime: "09:00",
                            },
                          ]);
                          setShowEnrollModal(true);
                        }}
                      >
                        + Add Section
                      </button>
                    </div>

                    {enrolledSections.length === 0 ? (
                      <div
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: "var(--ink-faint)",
                          background: "var(--surface2)",
                          borderRadius: "8px",
                          border: "1px dashed var(--border)",
                        }}
                      >
                        No sections enrolled yet. Click{" "}
                        <strong>+ Add Section</strong> to get started.
                      </div>
                    ) : (
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Section</th>
                              <th>Schedule</th>
                              <th>Students</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrolledSections.map(
                              ({ section, schedules, enrolledCount }) => (
                                <tr key={section}>
                                  <td>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "2px 8px",
                                        background: "var(--sky-4)",
                                        color: "var(--sky-dark)",
                                        borderRadius: "5px",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        fontFamily: "var(--font-mono)",
                                        border: "1px solid rgba(14,165,233,.2)",
                                      }}
                                    >
                                      {section}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      fontSize: "13px",
                                      color: "var(--ink-muted)",
                                    }}
                                  >
                                    {schedules.map((s, i) => (
                                      <div key={i}>
                                        {DAYS[s.dayOfWeek]}{" "}
                                        {fmtTime(s.startTime)}–
                                        {fmtTime(s.endTime)}
                                      </div>
                                    ))}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: "center",
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 600,
                                      color: "var(--ink-muted)",
                                    }}
                                  >
                                    {enrolledCount}
                                  </td>
                                  <td>
                                    <button
                                      className="btn-delete"
                                      disabled={removingSection === section}
                                      onClick={() =>
                                        handleRemoveSection(section)
                                      }
                                    >
                                      {removingSection === section
                                        ? "Removing…"
                                        : "Remove"}
                                    </button>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Current enrollments by subject */}
              <div className="management-section">
                <p className="section-title">All Enrollments</p>
                {subjects.every((s) => s.enrollments.length === 0) ? (
                  <div className="empty-state" style={{ padding: "32px 0" }}>
                    <p>No enrollments yet.</p>
                  </div>
                ) : (
                  subjects.map((subject) => {
                    if (subject.enrollments.length === 0) return null;
                    return (
                      <div key={subject.id} className="enrollment-card">
                        <h3>
                          {subject.name}
                          <span
                            style={{
                              fontWeight: 400,
                              fontSize: "12px",
                              color: "var(--ink-faint)",
                              marginLeft: "6px",
                            }}
                          >
                            ({subject.code})
                          </span>
                          <span
                            style={{
                              fontWeight: 400,
                              fontSize: "12px",
                              color: "var(--ink-muted)",
                              marginLeft: "8px",
                            }}
                          >
                            — {subject.enrollments.length} student
                            {subject.enrollments.length !== 1 ? "s" : ""}
                          </span>
                        </h3>
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
                              {subject.enrollments.map((e, idx) => {
                                const dn = e.student
                                  ? formatDisplayName(
                                      e.student.surname,
                                      e.student.firstName,
                                      e.student.middleInitial,
                                    )
                                  : "Unknown";
                                return (
                                  <tr key={e.id}>
                                    <td
                                      style={{
                                        textAlign: "center",
                                        fontSize: "12px",
                                        color: "var(--ink-faint)",
                                      }}
                                    >
                                      {idx + 1}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{dn}</td>
                                    <td
                                      style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: "13px",
                                        color: "var(--ink-muted)",
                                      }}
                                    >
                                      {e.student?.studentId || "—"}
                                    </td>
                                    <td>
                                      <button
                                        className="btn-delete"
                                        onClick={() =>
                                          handleRemoveEnrollment(
                                            subject.id,
                                            e.student.id,
                                          )
                                        }
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
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Add Subject Modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-box"
            style={{ width: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Add New Subject</h2>
              <button
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubjectSubmit}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr",
                    gap: "12px",
                  }}
                >
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
                  Schedules are assigned per section in the Enrollment tab.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "flex-end",
                    marginTop: "4px",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
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
          <div
            className="modal-box"
            style={{ width: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Edit Subject</h2>
              <button className="modal-close" onClick={handleCancelEdit}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr",
                  gap: "12px",
                }}
              >
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
              <p className="form-help" style={{ marginBottom: "12px" }}>
                To manage schedules, use the Enrollment tab.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  marginTop: "4px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={savingId !== null}
                >
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
        <div
          className="modal-overlay"
          onClick={() => setShowEnrollModal(false)}
        >
          <div
            className="modal-box"
            style={{ width: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Add Section & Schedule</h2>
              <button
                className="modal-close"
                onClick={() => setShowEnrollModal(false)}
              >
                ×
              </button>
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
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
                {availableSections.length === 0 && (
                  <p className="form-help">
                    All sections are already enrolled in this subject.
                  </p>
                )}
              </div>
              <ScheduleRows
                schedules={enrollModalSchedules}
                onChange={(i, field, val) =>
                  setEnrollModalSchedules((p) =>
                    p.map((s, idx) =>
                      idx !== i
                        ? s
                        : {
                            ...s,
                            [field]:
                              field === "dayOfWeek" ? parseInt(val) : val,
                          },
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
                  setEnrollModalSchedules((p) =>
                    p.filter((_, idx) => idx !== i),
                  )
                }
              />
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  marginTop: "4px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEnrollModal(false)}
                >
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
