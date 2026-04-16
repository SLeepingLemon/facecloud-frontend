// Format: SURNAME, FirstName M.I.
function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "Unknown";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
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

  useEffect(function () {
    fetchSubjects();

    // Set default date range (last 30 days)
    var today = new Date();
    var thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(formatDateForInput(today));
    setStartDate(formatDateForInput(thirtyDaysAgo));
  }, []);

  const formatDateForInput = function (date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  };

  const fetchSubjects = function () {
    api
      .get("/subjects")
      .then(function (res) {
        setSubjects(res.data);
      })
      .catch(function (error) {
        console.error("Error fetching subjects:", error);
        setError("Failed to load subjects");
      });
  };

  const handleLogout = function () {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  const generateReport = function () {
    if (!selectedSubject) {
      setError("Please select a subject");
      return;
    }

    setLoading(true);
    setError("");

    var url = "/attendance/report/" + selectedSubject;
    if (startDate && endDate) {
      url = url + "?startDate=" + startDate + "&endDate=" + endDate;
    }

    api
      .get(url)
      .then(function (res) {
        setReportData(res.data);
        setLoading(false);
      })
      .catch(function (error) {
        console.error("Error generating report:", error);
        setError("Failed to generate report");
        setLoading(false);
      });
  };

  const exportToCSV = function () {
    if (!reportData || !reportData.report) return;

    var csvContent =
      "Student Name,Section,Total Sessions,Present,Late,Absent,Attendance Rate\n";

    reportData.report.forEach(function (row) {
      csvContent =
        csvContent +
        formatDisplayName(
          row.student.surname,
          row.student.firstName,
          row.student.middleInitial,
        ) +
        "," +
        row.student.section +
        "," +
        row.totalSessions +
        "," +
        row.present +
        "," +
        row.late +
        "," +
        row.absent +
        "," +
        row.attendanceRate +
        "%\n";
    });

    var blob = new Blob([csvContent], { type: "text/csv" });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "attendance_report_" + new Date().getTime() + ".csv";
    a.click();
  };

  const getSelectedSubjectName = function () {
    var subject = subjects.find(function (s) {
      return s.id === parseInt(selectedSubject);
    });
    return subject ? subject.name : "";
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
            onClick={function () {
              navigate("/admin/AdminDashboard");
            }}
            className="btn-back"
          >
            ← Back to Dashboard
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Report Filters */}
        <div className="report-filters">
          <h2 className="section-title">Generate Attendance Report</h2>

          <div className="filter-grid">
            <div className="form-group">
              <label className="form-label">Select Subject</label>
              <select
                className="form-select"
                value={selectedSubject}
                onChange={function (e) {
                  setSelectedSubject(e.target.value);
                }}
              >
                <option value="">-- Choose a subject --</option>
                {subjects.map(function (subject) {
                  return (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={function (e) {
                  setStartDate(e.target.value);
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={function (e) {
                  setEndDate(e.target.value);
                }}
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
              <button onClick={exportToCSV} className="btn btn-secondary">
                📥 Export to CSV
              </button>
            )}
          </div>
        </div>

        {/* Report Results */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div className="spinner"></div>
            <p>Generating report...</p>
          </div>
        )}

        {reportData && !loading && (
          <div className="report-results">
            <div className="report-header">
              <h2>{getSelectedSubjectName()} - Attendance Report</h2>
              <p className="report-meta">
                Period: {startDate} to {endDate} | Total Sessions:{" "}
                {reportData.sessions.length}
              </p>
            </div>

            {/* Summary Statistics */}
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
                        reportData.report.reduce(function (sum, student) {
                          return sum + student.attendanceRate;
                        }, 0) / reportData.report.length,
                      )
                    : 0}
                  %
                </div>
                <div className="stat-label">Average Attendance</div>
              </div>
            </div>

            {/* Detailed Table */}
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
                  {reportData.report.map(function (row) {
                    var statusClass = "status-good";
                    if (row.attendanceRate < 75) statusClass = "status-poor";
                    else if (row.attendanceRate < 90)
                      statusClass = "status-warning";

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
                                width: row.attendanceRate + "%",
                                backgroundColor:
                                  row.attendanceRate >= 90
                                    ? "#10b981"
                                    : row.attendanceRate >= 75
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            ></div>
                          </div>
                          <span>{row.attendanceRate}%</span>
                        </td>
                        <td>
                          <span className={"status-badge " + statusClass}>
                            {row.attendanceRate >= 90
                              ? "Good"
                              : row.attendanceRate >= 75
                                ? "Fair"
                                : "Poor"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Session History */}
            <div className="session-history">
              <h3>Session History</h3>
              <div className="sessions-list">
                {reportData.sessions.map(function (session) {
                  var date = new Date(session.date);
                  var dateStr = date.toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <div key={session.id} className="session-item">
                      <div className="session-date">{dateStr}</div>
                      <div className="session-details">
                        <span>
                          {new Date(session.scheduledStart).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                          {" - "}
                          {new Date(session.scheduledEnd).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                        <span className="session-status">{session.status}</span>
                      </div>
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
