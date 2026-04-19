import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "Unknown";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function formatHHMM(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const fmtDateInput = (d) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

function Reports({ dark, toggleDark }) {
  const navigate   = useNavigate();
  const userName   = localStorage.getItem("name") || "Admin";

  const [subjects,         setSubjects]         = useState([]);
  const [selectedSubject,  setSelectedSubject]  = useState("");
  const [startDate,        setStartDate]        = useState("");
  const [endDate,          setEndDate]          = useState("");
  const [reportData,       setReportData]       = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");

  useEffect(() => {
    api.get("/subjects")
      .then(res => setSubjects(res.data))
      .catch(err => {
        const status = err.response?.status;
        if (status === 401) { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("name"); navigate("/"); return; }
        setError(!err.response ? "Cannot reach server. Please wait and refresh." : `Failed to load subjects (${status})`);
      });
    const today = new Date();
    const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(fmtDateInput(today));
    setStartDate(fmtDateInput(thirtyAgo));
  }, []);

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("name"); navigate("/"); };

  const generateReport = () => {
    if (!selectedSubject) { setError("Please select a subject"); return; }
    setLoading(true); setError("");
    let url = `/attendance/report/${selectedSubject}`;
    if (startDate && endDate) url += `?startDate=${startDate}&endDate=${endDate}`;
    api.get(url)
      .then(res => { setReportData(res.data); setLoading(false); })
      .catch(err => {
        const status = err.response?.status;
        if (status === 401) { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("name"); navigate("/"); return; }
        setError(!err.response ? "Cannot reach server." : `Failed to generate report (${status || "unknown"})`);
        setLoading(false);
      });
  };

  // ── CSV Export helpers (all preserved exactly) ──────────────────
  const getSubjectObj = () => subjects.find(s => s.id === parseInt(selectedSubject));

  const buildHeader = (session, scheduleLabel) => {
    const subj = getSubjectObj();
    const exportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const fmtDate = (ds) => { const d = new Date(ds); return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`; };
    const uniqueSections = [...new Set((reportData?.report || []).map(r => r.student.section).filter(Boolean))].sort().join(", ");
    const NL = "\n";
    let csv = "";
    csv += `"Subject Code:","${subj?.code || ""}","","Subject Name:","${subj?.name || ""}"${NL}`;
    csv += `"Year & Section:","${uniqueSections}","","Schedule:","${scheduleLabel}"${NL}`;
    csv += `"Room:","311","","Faculty-in-Charge:","${subj?.teachers?.[0]?.teacher?.name || "N/A"}"${NL}`;
    if (session) csv += `"Date:","${fmtDate(session.date)}","","Date Generated:","${exportDate}"${NL}`;
    else         csv += `"Date Generated:","${exportDate}"${NL}`;
    csv += NL;
    return csv;
  };

  const exportSessionCSV = (session) => {
    if (!reportData?.report) return;
    const subj = getSubjectObj();
    const toHHMM = (ds) => { const d = new Date(ds); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
    const FULL_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const sessionDay = FULL_DAYS[new Date(session.scheduledStart).getDay()];
    const schedLabel = `${sessionDay} ${formatHHMM(toHHMM(session.scheduledStart))} – ${formatHHMM(toHHMM(session.scheduledEnd))}`;
    const NL = "\n";
    let csv = buildHeader(session, schedLabel);
    csv += `No.,Last Name,First Name,MI,Status${NL}`;
    const sorted = [...reportData.report].sort((a, b) => (a.student.surname || "").localeCompare(b.student.surname || ""));
    sorted.forEach((row, idx) => {
      const record = session.records?.find(r => r.studentId === row.student.id);
      const status = (record?.status || "ABSENT") === "PENDING" ? "ABSENT" : (record?.status || "ABSENT");
      csv += `${idx+1},"${(row.student.surname||"").trim().toUpperCase()}","${(row.student.firstName||"").trim()}","${(row.student.middleInitial||"").trim().toUpperCase()}","${status}"${NL}`;
    });
    const d = new Date(session.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    download(`${subj?.code || "report"}_${dateKey}_${sessionDay}.csv`, csv);
  };

  const exportLatestScheduleCSV = () => {
    if (!reportData?.sessions?.length) { alert("No sessions found."); return; }
    const sorted = [...reportData.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    exportSessionCSV(sorted[0]);
  };

  const download = (fileName, csv) => {
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName; a.click();
    URL.revokeObjectURL(a.href);
  };

  const avgRate = reportData?.report?.length > 0
    ? Math.round(reportData.report.reduce((s, r) => s + r.attendanceRate, 0) / reportData.report.length)
    : 0;

  const statusType  = (r) => r >= 90 ? "status-good" : r >= 75 ? "status-warning" : "status-poor";
  const statusLabel = (r) => r >= 90 ? "Good" : r >= 75 ? "At Risk" : "Poor";

  return (
    <div className="dashboard">
      <Sidebar role="ADMIN" dark={dark} onToggleDark={toggleDark} onLogout={handleLogout} />

      <div className="main-area">
        <div className="topbar">
          <span className="tb-title">Reports</span>
          <span className="tb-date">{new Date().toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
        </div>

        <main className="main-content">
          <div className="page-header">
            <div>
              <h1>Attendance Reports</h1>
              <p>Filter by subject and date range to generate reports</p>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Filters */}
          <div className="report-filters">
            <div className="filter-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Subject</label>
                <select className="form-select" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setReportData(null); }}>
                  <option value="">— Choose a subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">To</label>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="filter-actions">
              <button className="btn btn-primary" onClick={generateReport} disabled={loading || !selectedSubject}>
                {loading ? "Generating…" : "Generate Report"}
              </button>
              {reportData && (
                <button className="btn btn-secondary" onClick={exportLatestScheduleCSV}>📥 Export Schedule</button>
              )}
            </div>
          </div>

          {loading && <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /><p style={{ color: "var(--ink-faint)" }}>Generating report…</p></div>}

          {reportData && !loading && (
            <div className="report-results">
              {/* Summary stats */}
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-content"><div className="stat-label">Total Students</div><div className="stat-value">{reportData.report.length}</div></div></div>
                <div className="stat-card"><div className="stat-icon">📅</div><div className="stat-content"><div className="stat-label">Sessions</div><div className="stat-value">{reportData.sessions.length}</div></div></div>
                <div className="stat-card"><div className="stat-icon">📊</div><div className="stat-content"><div className="stat-label">Avg Attendance</div><div className="stat-value">{avgRate}%</div></div></div>
                <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-content"><div className="stat-label">Good Standing</div><div className="stat-value">{reportData.report.filter(r => r.attendanceRate >= 90).length}</div></div></div>
              </div>

              {/* Report table */}
              <div className="user-management-card" style={{ padding: 0, marginBottom: "20px" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{subjects.find(s => s.id === parseInt(selectedSubject))?.name} — Attendance Report</div>
                  <div style={{ fontSize: "12px", color: "var(--ink-faint)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>{startDate} → {endDate} · {reportData.sessions.length} sessions</div>
                </div>
                <div className="report-table-container" style={{ border: "none", borderRadius: 0 }}>
                  <table className="report-table">
                    <thead>
                      <tr><th>Student</th><th>Section</th><th>Sessions</th><th>Present</th><th>Late</th><th>Absent</th><th>Rate</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {reportData.report.map(row => {
                        const rate = row.attendanceRate;
                        const fillColor = rate >= 90 ? "var(--green)" : rate >= 75 ? "var(--amber)" : "var(--red)";
                        return (
                          <tr key={row.student.id}>
                            <td className="student-name">{formatDisplayName(row.student.surname, row.student.firstName, row.student.middleInitial)}</td>
                            <td style={{ fontSize: "12px" }}>
                              <span style={{ display: "inline-block", padding: "2px 7px", background: "var(--sky-4)", color: "var(--sky-dark)", borderRadius: "5px", fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-mono)", border: "1px solid rgba(14,165,233,.2)" }}>{row.student.section}</span>
                            </td>
                            <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink-muted)" }}>{row.totalSessions}</td>
                            <td className="present-count">{row.present}</td>
                            <td className="late-count">{row.late}</td>
                            <td className="absent-count">{row.absent}</td>
                            <td className="attendance-rate">
                              <div className="progress-bar"><div className="progress-fill" style={{ width: rate + "%", background: fillColor }} /></div>
                              <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{rate}%</span>
                            </td>
                            <td><span className={`status-badge ${statusType(rate)}`}>{statusLabel(rate)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Session history */}
              <div className="session-history">
                <h3>Session History</h3>
                <div className="sessions-list">
                  {reportData.sessions.map(session => {
                    const dateStr = new Date(session.date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
                    const startStr = new Date(session.scheduledStart).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    const endStr   = new Date(session.scheduledEnd).toLocaleTimeString("en-US",   { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={session.id} className="session-item">
                        <div className="session-date">{dateStr}</div>
                        <div className="session-details">
                          <span>{startStr} – {endStr}</span>
                          <span className="session-status" style={{ color: "var(--green)" }}>{session.status}</span>
                        </div>
                        <button className="btn-icon" style={{ color: "var(--sky-dark)" }} onClick={() => exportSessionCSV(session)} title="Export this session">↓</button>
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
              <p>Select a subject and date range, then click "Generate Report".</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Reports;