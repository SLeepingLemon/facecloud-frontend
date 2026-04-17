function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "Unknown";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function formatHHMM(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function formatSchedules(schedules) {
  if (!schedules || schedules.length === 0) return "No schedule set";
  const FULL_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return schedules
    .map(
      (s) =>
        `${FULL_DAYS[s.dayOfWeek]} ${formatHHMM(s.startTime)} to ${formatHHMM(s.endTime)}`,
    )
    .join(" | ");
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

function Reports() {
  const navigate = useNavigate();
  const initials = (localStorage.getItem("name") || "Admin")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const userName = localStorage.getItem("name") || "Admin";

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubjects();
    const today = new Date();
    const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(fmtDateInput(today));
    setStartDate(fmtDateInput(thirtyAgo));
  }, []);

  const fmtDateInput = (d) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  };

  const fetchSubjects = () => {
    api
      .get("/subjects")
      .then((res) => setSubjects(res.data))
      .catch(() => setError("Failed to load subjects"));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  const generateReport = () => {
    if (!selectedSubject) {
      setError("Please select a subject");
      return;
    }
    setLoading(true);
    setError("");
    let url = `/attendance/report/${selectedSubject}`;
    if (startDate && endDate)
      url += `?startDate=${startDate}&endDate=${endDate}`;
    api
      .get(url)
      .then((res) => {
        setReportData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to generate report");
        setLoading(false);
      });
  };

  // ── Shared CSV helpers ──
  const getSubjectObj = () =>
    subjects.find((s) => s.id === parseInt(selectedSubject));

  const buildHeader = (session, scheduleLabel) => {
    const subj = getSubjectObj();
    const subjectCode = subj?.code || "";
    const subjectName = subj?.name || "";
    const room = "311";
    const facultyName = subj?.teachers?.[0]?.teacher?.name || "N/A";
    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const fmtDate = (ds) => {
      const d = new Date(ds);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    };
    const uniqueSections = [
      ...new Set(
        (reportData?.report || [])
          .map((r) => r.student.section)
          .filter(Boolean),
      ),
    ]
      .sort()
      .join(", ");
    const NL = "\n";
    let csv = "";
    csv += `"Subject Code:","${subjectCode}","","Subject Name:","${subjectName}"${NL}`;
    csv += `"Year & Section:","${uniqueSections}","","Schedule:","${scheduleLabel}"${NL}`;
    csv += `"Room:","${room}","","Faculty-in-Charge:","${facultyName}"${NL}`;
    if (session) {
      csv += `"Date:","${fmtDate(session.date)}","","Date Generated:","${exportDate}"${NL}`;
    } else {
      csv += `"Date Generated:","${exportDate}"${NL}`;
    }
    csv += NL;
    return csv;
  };

  // ── Export single session (📥 button on each session row) ──
  const exportSessionCSV = (session) => {
    if (!reportData?.report) return;
    const subj = getSubjectObj();
    const toHHMM = (ds) => {
      const d = new Date(ds);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const FULL_DAYS = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const sessionDay = FULL_DAYS[new Date(session.scheduledStart).getDay()];
    const schedLabel = `${sessionDay} ${formatHHMM(toHHMM(session.scheduledStart))} – ${formatHHMM(toHHMM(session.scheduledEnd))}`;

    const NL = "\n";
    let csv = buildHeader(session, schedLabel);
    csv += `No.,Last Name,First Name,MI,Status${NL}`;

    const sorted = [...reportData.report].sort((a, b) =>
      (a.student.surname || "").localeCompare(b.student.surname || ""),
    );
    sorted.forEach((row, idx) => {
      const record = session.records?.find(
        (r) => r.studentId === row.student.id,
      );
      const rawStatus = record?.status || "ABSENT";
      const status = rawStatus === "PENDING" ? "ABSENT" : rawStatus;
      csv += `${idx + 1},"${(row.student.surname || "").trim().toUpperCase()}","${(row.student.firstName || "").trim()}","${(row.student.middleInitial || "").trim().toUpperCase()}","${status}"${NL}`;
    });

    const d = new Date(session.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    download(`${subj?.code || "report"}_${dateKey}_${sessionDay}.csv`, csv);
  };

  // ── Export most recent scheduled session (Export Schedule button) ──
  const exportLatestScheduleCSV = () => {
    if (!reportData?.sessions?.length) {
      alert("No sessions found.");
      return;
    }
    const sorted = [...reportData.sessions].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    exportSessionCSV(sorted[0]);
  };

  const download = (fileName, csv) => {
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const getSelectedSubjectName = () => getSubjectObj()?.name || "";

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
            <button className="nav-link active">Reports</button>
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
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => navigate("/admin/AdminDashboard")}
            className="btn-back"
          >
            ← Back to Dashboard
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── Filters ── */}
        <div className="report-filters">
          <h2 className="section-title">Generate Attendance Report</h2>
          <div className="filter-grid">
            <div className="form-group">
              <label className="form-label">Select Subject</label>
              <select
                className="form-select"
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setReportData(null);
                }}
              >
                <option value="">-- Choose a subject --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="filter-actions">
            <button
              onClick={generateReport}
              className="btn btn-primary"
              disabled={loading || !selectedSubject}
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>
            {reportData && (
              <button
                onClick={exportLatestScheduleCSV}
                className="btn btn-secondary"
              >
                📥 Export Schedule
              </button>
            )}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="spinner"></div>
            <p>Generating report...</p>
          </div>
        )}

        {/* ── Results ── */}
        {reportData && !loading && (
          <div className="report-results">
            <div className="report-header">
              <h2>{getSelectedSubjectName()} — Attendance Report</h2>
              <p className="report-meta">
                Period: {startDate} to {endDate} | Total Sessions:{" "}
                {reportData.sessions.length}
              </p>
            </div>

            {/* Summary stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{reportData.sessions.length}</div>
                <div className="stat-label">Total Sessions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{reportData.report.length}</div>
                <div className="stat-label">Total Students</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {reportData.report.length > 0
                    ? Math.round(
                        reportData.report.reduce(
                          (s, r) => s + r.attendanceRate,
                          0,
                        ) / reportData.report.length,
                      )
                    : 0}
                  %
                </div>
                <div className="stat-label">Average Attendance</div>
              </div>
            </div>

            {/* Detailed table */}
            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Section</th>
                    <th>Total Sessions</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Absent</th>
                    <th>Attendance Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.report.map((row) => {
                    const rate = row.attendanceRate;
                    const sc =
                      rate >= 90
                        ? "status-good"
                        : rate >= 75
                          ? "status-warning"
                          : "status-poor";
                    return (
                      <tr key={row.student.id}>
                        <td className="student-name">
                          {formatDisplayName(
                            row.student.surname,
                            row.student.firstName,
                            row.student.middleInitial,
                          )}
                        </td>
                        <td>{row.student.section}</td>
                        <td>{row.totalSessions}</td>
                        <td className="present-count">{row.present}</td>
                        <td className="late-count">{row.late}</td>
                        <td className="absent-count">{row.absent}</td>
                        <td className="attendance-rate">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: rate + "%",
                                backgroundColor:
                                  rate >= 90
                                    ? "#10b981"
                                    : rate >= 75
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            />
                          </div>
                          <span>{rate}%</span>
                        </td>
                        <td>
                          <span className={"status-badge " + sc}>
                            {rate >= 90 ? "Good" : rate >= 75 ? "Fair" : "Poor"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Session history with 📥 per row */}
            <div className="session-history">
              <h3>Session History</h3>
              <div className="sessions-list">
                {reportData.sessions.map((session) => {
                  const dateStr = new Date(session.date).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  );
                  const startStr = new Date(
                    session.scheduledStart,
                  ).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endStr = new Date(
                    session.scheduledEnd,
                  ).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={session.id}
                      className="session-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div className="session-date" style={{ flex: 1 }}>
                        {dateStr}
                      </div>
                      <div className="session-details">
                        <span>
                          {startStr} – {endStr}
                        </span>
                        <span className="session-status">{session.status}</span>
                      </div>
                      <button
                        onClick={() => exportSessionCSV(session)}
                        title="Download attendance for this session"
                        style={{
                          padding: "5px 10px",
                          background: "#fff",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--pup-red)",
                          fontWeight: 600,
                          fontFamily: "inherit",
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "var(--pup-red-ghost)";
                          e.currentTarget.style.borderColor =
                            "var(--pup-red-light)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#fff";
                          e.currentTarget.style.borderColor = "var(--border)";
                        }}
                      >
                        📥
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!reportData && !loading && (
          <div className="empty-state">
            <h3>No Report Generated</h3>
            <p>
              Select a subject and date range, then click "Generate Report" to
              view attendance statistics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default Reports;
