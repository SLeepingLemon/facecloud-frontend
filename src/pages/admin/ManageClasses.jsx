import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";

// Sections fetched from API

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

function generateDatasetName(surname, studentId) {
  if (!surname || !studentId) return "";
  try {
    const parts = studentId.split("-");
    if (parts.length < 2 || !parts[1]) return "";
    return `${surname.trim().toUpperCase()}_${parts[1].slice(-5)}`;
  } catch {
    return "";
  }
}

function parseCSV(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "",
      inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return headers.reduce((obj, h, i) => {
      obj[h] = values[i] || "";
      return obj;
    }, {});
  });
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
  const fileInputRef = useRef(null);

  // If navigated here with a specific tab (e.g. from Sections shortcut), open it
  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState(location.state?.tab || "students");

  const [students, setStudents] = useState([]);
  const [studentForm, setStudentForm] = useState({
    studentId: "",
    surname: "",
    firstName: "",
    middleInitial: "",
    section: "",
  });

  const [importRows, setImportRows] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

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
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("");
  const [enrollingSectionId, setEnrollingSectionId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    fetchStudents();
    fetchSubjects();
    fetchTeachers();
    api
      .get("/sections")
      .then((r) => setSections(r.data))
      .catch(() => {});
  };
  const fetchStudents = () => {
    api
      .get("/students")
      .then((r) => setStudents(r.data))
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

  const studentsBySection = sections.reduce((acc, sec) => {
    acc[sec] = students.filter((s) => s.section === sec);
    return acc;
  }, {});
  const activeSections = sections.filter(
    (s) => studentsBySection[s].length > 0,
  );
  const filteredStudents = selectedSectionFilter
    ? students.filter((s) => s.section === selectedSectionFilter)
    : students;

  const handleStudentChange = (e) => {
    const { name, value } = e.target;
    setStudentForm((p) => ({ ...p, [name]: value }));
  };
  const previewDatasetName = generateDatasetName(
    studentForm.surname,
    studentForm.studentId,
  );
  const previewDisplayName = formatDisplayName(
    studentForm.surname,
    studentForm.firstName,
    studentForm.middleInitial,
  );

  const handleStudentSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    api
      .post("/students", {
        studentId: studentForm.studentId.trim(),
        surname: studentForm.surname.trim(),
        firstName: studentForm.firstName.trim(),
        middleInitial: studentForm.middleInitial.trim(),
        section: studentForm.section,
      })
      .then((res) => {
        setSuccess(
          `Student added! ${res.data.displayName} | ${res.data.datasetName}`,
        );
        setStudentForm({
          studentId: "",
          surname: "",
          firstName: "",
          middleInitial: "",
          section: "",
        });
        fetchStudents();
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to add student.");
        setLoading(false);
      });
  };

  const deleteStudent = (id, dn) => {
    if (!window.confirm(`Delete ${dn}?`)) return;
    api
      .delete(`/students/${id}`)
      .then(() => {
        setSuccess("Student deleted.");
        fetchStudents();
      })
      .catch((err) => setError(err.response?.data?.message || "Failed."));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportRows([]);
    setImportResult(null);
    setImportError("");
    if (!file.name.endsWith(".csv")) {
      setImportError("Please select a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length === 0) {
        setImportError("CSV is empty or has no data rows.");
        return;
      }
      const headers = Object.keys(rows[0]);
      const missing = ["student_id", "surname", "firstname", "section"].filter(
        (c) => !headers.includes(c),
      );
      if (missing.length > 0) {
        setImportError(
          `CSV missing columns: ${missing.join(", ")}. Found: ${headers.join(", ")}`,
        );
        return;
      }
      setImportRows(
        rows.map((row) => ({
          ...row,
          _preview_dataset: generateDatasetName(
            (row["surname"] || "").trim().toUpperCase(),
            (row["student_id"] || "").trim(),
          ),
          _display_name: formatDisplayName(
            (row["surname"] || "").trim().toUpperCase(),
            (row["firstname"] || "").trim(),
            (row["middle_init"] || row["middle_initial"] || "").trim(),
          ),
        })),
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (importRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    const payload = importRows.map(
      ({ _preview_dataset, _display_name, ...row }) => row,
    );
    api
      .post("/students/bulk-import", { students: payload })
      .then((res) => {
        setImportResult(res.data);
        setImportRows([]);
        fetchStudents();
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      })
      .catch((err) => {
        setImportError(err.response?.data?.message || "Import failed.");
        setImporting(false);
      });
  };

  const handleCancelImport = () => {
    setImportRows([]);
    setImportResult(null);
    setImportError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

  const handleEnrollStudent = (studentId) => {
    if (!selectedSubject) {
      setError("Select a subject first.");
      return;
    }
    api
      .post("/subjects/enroll-student", {
        subjectId: parseInt(selectedSubject),
        studentId,
      })
      .then(() => {
        setSuccess("Enrolled!");
        fetchSubjects();
      })
      .catch((err) => setError(err.response?.data?.message || "Failed."));
  };

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
    const count = studentsBySection[section]?.length || 0;
    if (
      !window.confirm(
        `Enroll all from "${section}" into "${subj?.name}"?\n${count} students. Already enrolled are skipped.`,
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
            Students, subjects, teacher assignments, and enrollments.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="tab-navigation">
          <button
            className={"tab-btn" + (activeTab === "students" ? " active" : "")}
            onClick={() => setActiveTab("students")}
          >
            👥 Students
          </button>
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

        {activeTab === "students" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Add New Student</p>
              <p className="section-subtitle">
                Register a single student manually.
              </p>
              <form onSubmit={handleStudentSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Student ID</label>
                    <input
                      type="text"
                      name="studentId"
                      className="form-input"
                      placeholder="e.g. 2024-12345-MN-0"
                      value={studentForm.studentId}
                      onChange={handleStudentChange}
                      required
                    />
                    <p className="form-help">Format: YYYY-NNNNN-MN-N</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section</label>
                    <select
                      name="section"
                      className="form-select"
                      value={studentForm.section}
                      onChange={handleStudentChange}
                      required
                    >
                      <option value="">— Select section —</option>
                      {sections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Surname</label>
                    <input
                      type="text"
                      name="surname"
                      className="form-input"
                      placeholder="e.g. DELA CRUZ"
                      value={studentForm.surname}
                      onChange={handleStudentChange}
                      required
                    />
                    <p className="form-help">ALL CAPS</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      className="form-input"
                      placeholder="e.g. Juan"
                      value={studentForm.firstName}
                      onChange={handleStudentChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      M.I.{" "}
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
                      name="middleInitial"
                      className="form-input"
                      placeholder="R"
                      maxLength={1}
                      value={studentForm.middleInitial}
                      onChange={handleStudentChange}
                    />
                  </div>
                </div>
                {(previewDisplayName || previewDatasetName) && (
                  <div
                    style={{
                      background: "var(--pup-red-ghost)",
                      border: "1px solid var(--pup-red-light)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px 16px",
                      marginBottom: "18px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "24px",
                    }}
                  >
                    {previewDisplayName && (
                      <div>
                        <p
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: "var(--pup-red)",
                            marginBottom: "2px",
                          }}
                        >
                          Display Name
                        </p>
                        <p
                          style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "var(--ink)",
                          }}
                        >
                          {previewDisplayName}
                        </p>
                      </div>
                    )}
                    {previewDatasetName && (
                      <div>
                        <p
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: "var(--pup-red)",
                            marginBottom: "2px",
                          }}
                        >
                          Dataset Name
                        </p>
                        <p
                          style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "var(--ink)",
                            fontFamily: "monospace",
                          }}
                        >
                          {previewDatasetName}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ maxWidth: "180px" }}
                >
                  {loading ? "Adding…" : "Add Student"}
                </button>
              </form>
            </div>

            <div className="management-section">
              <p className="section-title">Import from CSV</p>
              <p className="section-subtitle">
                Bulk import students from the Raspberry Pi&apos;s{" "}
                <code
                  style={{
                    background: "var(--pup-red-ghost)",
                    padding: "1px 5px",
                    borderRadius: "3px",
                    fontSize: "12px",
                  }}
                >
                  students.csv
                </code>
                . Already-registered students are automatically skipped.
              </p>

              {importRows.length === 0 && !importResult && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    id="csv-file-input"
                  />
                  <label
                    htmlFor="csv-file-input"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 20px",
                      background: "var(--white)",
                      border: "1.5px dashed var(--border-strong)",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "var(--ink-muted)",
                      fontFamily: "inherit",
                      transition: "all 0.18s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--pup-red)";
                      e.currentTarget.style.color = "var(--pup-red)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--border-strong)";
                      e.currentTarget.style.color = "var(--ink-muted)";
                    }}
                  >
                    📂 Choose students.csv
                  </label>
                  <p className="form-help" style={{ marginTop: "8px" }}>
                    Expected columns: student_id, surname, firstname,
                    middle_init, section, dataset_name
                  </p>
                  {importError && (
                    <div
                      className="alert alert-error"
                      style={{ marginTop: "12px" }}
                    >
                      {importError}
                    </div>
                  )}
                </div>
              )}

              {importRows.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <p style={{ fontSize: "14px", color: "var(--ink-muted)" }}>
                      <strong style={{ color: "var(--ink)" }}>
                        {importRows.length} students
                      </strong>{" "}
                      found — review then confirm:
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        disabled={importing}
                        onClick={handleConfirmImport}
                        className="btn btn-primary"
                        style={{ minWidth: "140px" }}
                      >
                        {importing
                          ? "Importing…"
                          : `Import All (${importRows.length})`}
                      </button>
                      <button
                        type="button"
                        disabled={importing}
                        onClick={handleCancelImport}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div
                    className="table-container"
                    style={{ maxHeight: "360px", overflowY: "auto" }}
                  >
                    <table className="data-table">
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "var(--white)",
                          zIndex: 1,
                        }}
                      >
                        <tr>
                          <th>#</th>
                          <th>Student ID</th>
                          <th>Name</th>
                          <th>Section</th>
                          <th>Dataset Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, idx) => (
                          <tr key={idx}>
                            <td
                              style={{
                                color: "var(--ink-faint)",
                                fontSize: "12px",
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                                color: "var(--ink-muted)",
                              }}
                            >
                              {row["student_id"] || "—"}
                            </td>
                            <td style={{ fontWeight: 500 }}>
                              {row._display_name || "—"}
                            </td>
                            <td>
                              <span
                                className={
                                  sections.includes(row["section"])
                                    ? "subject-code"
                                    : ""
                                }
                                style={
                                  !sections.includes(row["section"])
                                    ? { color: "#dc2626", fontSize: "12px" }
                                    : {}
                                }
                              >
                                {row["section"] || "—"}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                                color: "var(--ink-faint)",
                              }}
                            >
                              {row._preview_dataset || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importError && (
                    <div
                      className="alert alert-error"
                      style={{ marginTop: "12px" }}
                    >
                      {importError}
                    </div>
                  )}
                </div>
              )}

              {importResult && (
                <div
                  style={{
                    background: "var(--white)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "20px 24px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginBottom: "16px",
                    }}
                  >
                    ✅ Import Complete
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "24px",
                      flexWrap: "wrap",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <p
                        style={{
                          fontSize: "28px",
                          fontWeight: 700,
                          color: "var(--pup-red)",
                          lineHeight: 1,
                        }}
                      >
                        {importResult.imported}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-muted)",
                          marginTop: "4px",
                        }}
                      >
                        Imported
                      </p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p
                        style={{
                          fontSize: "28px",
                          fontWeight: 700,
                          color: "var(--ink-muted)",
                          lineHeight: 1,
                        }}
                      >
                        {importResult.skipped}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-muted)",
                          marginTop: "4px",
                        }}
                      >
                        Skipped
                      </p>
                    </div>
                    {importResult.errors > 0 && (
                      <div style={{ textAlign: "center" }}>
                        <p
                          style={{
                            fontSize: "28px",
                            fontWeight: 700,
                            color: "#dc2626",
                            lineHeight: 1,
                          }}
                        >
                          {importResult.errors}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--ink-muted)",
                            marginTop: "4px",
                          }}
                        >
                          Errors
                        </p>
                      </div>
                    )}
                  </div>
                  {importResult.details?.skipped?.length > 0 && (
                    <div style={{ marginBottom: "10px" }}>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--ink-muted)",
                          marginBottom: "4px",
                        }}
                      >
                        Skipped:
                      </p>
                      {importResult.details.skipped.map((s, i) => (
                        <p
                          key={i}
                          style={{
                            fontSize: "12px",
                            color: "var(--ink-faint)",
                          }}
                        >
                          · {s.row} — {s.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  {importResult.details?.errors?.length > 0 && (
                    <div style={{ marginBottom: "10px" }}>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#dc2626",
                          marginBottom: "4px",
                        }}
                      >
                        Errors:
                      </p>
                      {importResult.details.errors.map((e, i) => (
                        <p
                          key={i}
                          style={{ fontSize: "12px", color: "#dc2626" }}
                        >
                          · {e.row} — {e.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setImportResult(null)}
                    className="btn-secondary"
                    style={{ marginTop: "8px" }}
                  >
                    Import Another File
                  </button>
                </div>
              )}
            </div>

            <div className="management-section">
              <p className="section-title">
                All Students{" "}
                <span
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                >
                  ({students.length})
                </span>
              </p>
              {students.length === 0 ? (
                <div className="empty-state" style={{ padding: "36px 0" }}>
                  <p>No students yet. Add one above or import from CSV.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Surname</th>
                        <th>First Name</th>
                        <th>M.I.</th>
                        <th>Section</th>
                        <th>Dataset Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const dn = formatDisplayName(
                          s.surname,
                          s.firstName,
                          s.middleInitial,
                        );
                        return (
                          <tr key={s.id}>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                                color: "var(--ink-muted)",
                              }}
                            >
                              {s.studentId}
                            </td>
                            <td
                              style={{
                                fontWeight: 600,
                                textTransform: "uppercase",
                              }}
                            >
                              {s.surname}
                            </td>
                            <td>{s.firstName}</td>
                            <td style={{ color: "var(--ink-muted)" }}>
                              {s.middleInitial || "—"}
                            </td>
                            <td>
                              <span className="subject-code">{s.section}</span>
                            </td>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontSize: "12px",
                                color: "var(--ink-faint)",
                              }}
                            >
                              {s.datasetName || (
                                <span
                                  style={{
                                    fontStyle: "italic",
                                    color: "var(--border-strong)",
                                  }}
                                >
                                  not set
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => deleteStudent(s.id, dn)}
                                className="btn-delete"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "subjects" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Create New Subject</p>
              <p className="section-subtitle">
                Define a subject with its weekly class schedule.
              </p>
              <form onSubmit={handleSubjectSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Subject Name</label>
                    <input
                      type="text"
                      name="name"
                      className="form-input"
                      placeholder="e.g. Data Structures"
                      value={subjectForm.name}
                      onChange={handleSubjectChange}
                      required
                    />
                  </div>
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
                </div>
                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    name="description"
                    className="form-input"
                    placeholder="Brief description"
                    value={subjectForm.description}
                    onChange={handleSubjectChange}
                    rows={2}
                    style={{ resize: "vertical" }}
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
                  style={{ maxWidth: "200px" }}
                >
                  {loading ? "Creating…" : "Create Subject"}
                </button>
              </form>
            </div>

            <div className="management-section">
              <p className="section-title">
                All Subjects{" "}
                <span
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                >
                  ({subjects.length})
                </span>
              </p>
              {subjects.length === 0 ? (
                <div className="empty-state" style={{ padding: "36px 0" }}>
                  <p>No subjects yet.</p>
                </div>
              ) : (
                <div className="subjects-grid">
                  {subjects.map((subject) => {
                    const isDeleting = deletingId === subject.id;
                    return (
                      <div
                        key={subject.id}
                        className="subject-card"
                        style={{
                          cursor: "default",
                          opacity: isDeleting ? 0.5 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "10px",
                          }}
                        >
                          <span className="subject-code">{subject.code}</span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleStartEdit(subject)}
                              style={{
                                padding: "4px 10px",
                                fontSize: "12px",
                                fontWeight: 600,
                                background: "var(--white)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                color: "var(--ink-muted)",
                                fontFamily: "inherit",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor =
                                  "var(--pup-red)";
                                e.currentTarget.style.color = "var(--pup-red)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor =
                                  "var(--border)";
                                e.currentTarget.style.color =
                                  "var(--ink-muted)";
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={(e) =>
                                handleDeleteSubject(e, subject.id, subject.name)
                              }
                              className="btn-delete"
                              style={{ opacity: isDeleting ? 0.6 : 1 }}
                            >
                              {isDeleting ? "Deleting…" : "🗑 Delete"}
                            </button>
                          </div>
                        </div>
                        <p className="subject-name">{subject.name}</p>
                        {subject.description && (
                          <p className="subject-description">
                            {subject.description}
                          </p>
                        )}
                        <div className="subject-meta">
                          <span className="subject-meta-item">
                            👥 {subject.enrollments.length} students
                          </span>
                          <span className="subject-meta-item">
                            👨‍🏫 {subject.teachers.length} teachers
                          </span>
                        </div>
                        {subject.schedules.length > 0 && (
                          <div
                            style={{
                              marginTop: "12px",
                              borderTop: "1px solid var(--border)",
                              paddingTop: "10px",
                            }}
                          >
                            {subject.schedules.map((s, i) => (
                              <p
                                key={i}
                                style={{
                                  fontSize: "12px",
                                  color: "var(--ink-muted)",
                                  marginBottom: "2px",
                                }}
                              >
                                📅 {getDayName(s.dayOfWeek)}: {s.startTime} –{" "}
                                {s.endTime}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "teachers" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Assign Teacher to Subject</p>
              <p className="section-subtitle">
                Link a teacher account to a subject they will handle.
              </p>
              {teachers.length === 0 && (
                <div className="alert alert-error">
                  No teacher accounts found. Create them in Manage Users first.
                </div>
              )}
              <div className="teacher-assignment-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Select Subject</label>
                    <select
                      className="form-select"
                      value={selectedSubjectForTeacher}
                      onChange={(e) =>
                        setSelectedSubjectForTeacher(e.target.value)
                      }
                    >
                      <option value="">— Choose —</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Select Teacher</label>
                    <select
                      className="form-select"
                      value={selectedTeacher}
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                    >
                      <option value="">— Choose —</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAssignTeacher}
                  className="btn btn-primary"
                  disabled={!selectedSubjectForTeacher || !selectedTeacher}
                  style={{ maxWidth: "220px" }}
                >
                  Assign Teacher
                </button>
              </div>
            </div>
            <div className="management-section">
              <p className="section-title">Current Assignments</p>
              {subjects.every((s) => s.teachers.length === 0) ? (
                <div className="empty-state" style={{ padding: "36px 0" }}>
                  <p>No assignments yet.</p>
                </div>
              ) : (
                subjects.map((subject) => {
                  if (subject.teachers.length === 0) return null;
                  return (
                    <div key={subject.id} className="teacher-assignment-card">
                      <h3>{subject.name}</h3>
                      <span className="subject-code">{subject.code}</span>
                      <div className="assigned-teachers-list">
                        {subject.teachers.map((a) => (
                          <div key={a.id} className="teacher-assignment-item">
                            <div className="teacher-info">
                              <strong>{a.teacher.name}</strong>
                              <span className="teacher-email">
                                {a.teacher.email}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveTeacher(subject.id, a.teacherId)
                              }
                              className="btn-remove"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "enrollments" && (
          <div className="tab-content">
            <div className="management-section">
              <p className="section-title">Enroll Students in Subjects</p>
              <p className="section-subtitle">
                Select a subject, then enroll an entire section or individual
                students.
              </p>
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
                <>
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
                      Enroll all students from a section at once.
                      Already-enrolled are skipped.
                    </p>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                    >
                      {activeSections.length === 0 ? (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "var(--ink-faint)",
                          }}
                        >
                          No students yet.
                        </p>
                      ) : (
                        activeSections.map((section) => {
                          const isEnrolling = enrollingSectionId === section;
                          const count = studentsBySection[section]?.length || 0;
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
                                color: isEnrolling
                                  ? "var(--ink-muted)"
                                  : "#fff",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "13px",
                                fontWeight: 600,
                                fontFamily: "inherit",
                                cursor: isEnrolling ? "not-allowed" : "pointer",
                                transition: "all 0.18s",
                              }}
                            >
                              {isEnrolling
                                ? "Enrolling…"
                                : `${section} (${count})`}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="enrollment-section">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <h3 style={{ margin: 0 }}>Individual Students</h3>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "13px",
                            color: "var(--ink-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Filter by section:
                        </label>
                        <select
                          className="form-select"
                          style={{ width: "auto", minWidth: "140px" }}
                          value={selectedSectionFilter}
                          onChange={(e) =>
                            setSelectedSectionFilter(e.target.value)
                          }
                        >
                          <option value="">All sections</option>
                          {activeSections.map((sec) => (
                            <option key={sec} value={sec}>
                              {sec}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {filteredStudents.length === 0 ? (
                      <p
                        style={{ color: "var(--ink-muted)", fontSize: "14px" }}
                      >
                        {selectedSectionFilter
                          ? `No students in ${selectedSectionFilter}.`
                          : "No students yet."}
                      </p>
                    ) : (
                      <div className="student-list">
                        {filteredStudents.map((student) => {
                          const subj = subjects.find(
                            (s) => s.id === parseInt(selectedSubject),
                          );
                          const isEnrolled =
                            subj &&
                            subj.enrollments.some(
                              (e) => e.studentId === student.id,
                            );
                          const dn = formatDisplayName(
                            student.surname,
                            student.firstName,
                            student.middleInitial,
                          );
                          return (
                            <div
                              key={student.id}
                              className="student-enrollment-item"
                            >
                              <div>
                                <strong>{dn}</strong>
                                <span className="student-meta">
                                  {student.studentId} · {student.section}
                                </span>
                              </div>
                              {isEnrolled ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveEnrollment(
                                      parseInt(selectedSubject),
                                      student.id,
                                    )
                                  }
                                  className="btn-remove"
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEnrollStudent(student.id)
                                  }
                                  className="btn-enroll"
                                >
                                  Enroll
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
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
                            <span key={e.id} className="enrolled-student-tag">
                              {dn}
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
                      fontFamily: "var(--font-heading)",
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
