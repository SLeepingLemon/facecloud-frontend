import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "Unknown";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function formatTime(dateString) {
  if (!dateString) return "--:--";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusColor(status) {
  if (status === "PRESENT") return "#10b981";
  if (status === "LATE") return "#f59e0b";
  return "#ef4444";
}

// Format "HH:MM" (24hr) → "10:30AM" for CSV schedule display
function formatHHMM(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// Format all schedules for the CSV header
// e.g. "Monday 07:00AM to 10:00AM | Friday 01:00PM to 04:00PM"
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

function StatusBadge({ status }) {
  const colors = {
    PENDING: { bg: "#f1f5f9", color: "#64748b" }, // gray — waiting
    PRESENT: { bg: "#dcfce7", color: "#166534" }, // green
    LATE: { bg: "#fef9c3", color: "#854d0e" }, // yellow
    ABSENT: { bg: "#fee2e2", color: "#991b1b" }, // red
  };
  const c = colors[status] || colors.PENDING;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status === "PENDING" ? "Pending" : status}
    </span>
  );
}

function TeacherDashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Teacher";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [activeSessions, setActiveSessions] = useState({}); // subjectId → true
  const [attendanceHistory, setAttendanceHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showExportPicker, setShowExportPicker] = useState(false);

  // SSE connection ref — keeps track of the open EventSource
  const sseRef = useRef(null);

  // Ref for selectedSubject — used inside SSE callbacks to avoid stale closures
  // Without this, callbacks capture the value of selectedSubject at the time
  // openSSE() was called, which may be stale by the time the event fires.
  const selectedSubjectRef = useRef(null);

  // Keep the ref in sync with the state
  useEffect(() => {
    selectedSubjectRef.current = selectedSubject;
  }, [selectedSubject]);

  // ── Close SSE connection helper ──
  const closeSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // ── Open SSE connection for a specific sessionId ──
  // selectedSubject removed from deps — we use selectedSubjectRef instead.
  // This means openSSE is created once and never re-created when the
  // teacher navigates between subjects, preventing unnecessary reconnects.
  const openSSE = useCallback(
    (sessionId) => {
      closeSSE(); // close any existing connection first

      const token = localStorage.getItem("token");
      if (!token) return;

      const url = `${api.defaults.baseURL}/attendance/stream/${sessionId}?token=${token}`;
      const es = new EventSource(url);

      // Connected — SSE stream is live
      es.addEventListener("connected", () => {
        console.log(`[SSE] Connected to session ${sessionId}`);
      });

      // attendance_update — Pi scanned a face, one record changed
      // setCurrentSession uses functional update — never reads stale state
      es.addEventListener("attendance_update", (e) => {
        const data = JSON.parse(e.data);
        setCurrentSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            records: prev.records.map((r) =>
              r.id === data.record.id ? data.record : r,
            ),
          };
        });
      });

      // session_started — Pi auto-created a new session
      // Uses selectedSubjectRef.current — always the current value, never stale
      es.addEventListener("session_started", (e) => {
        const data = JSON.parse(e.data);
        console.log("[SSE] Session started by Pi:", data.subjectId);
        const subject = selectedSubjectRef.current;
        if (subject) {
          api
            .get(`/attendance/session/${subject.id}`)
            .then((res) => setCurrentSession(res.data))
            .catch(() => {});
        }
      });

      // session_ended — session closed (auto or manual)
      es.addEventListener("session_ended", () => {
        console.log("[SSE] Session ended");
        setCurrentSession(null);
        setSuccess("Session ended — attendance records saved.");
        closeSSE();
      });

      // SSE error — connection dropped, EventSource will auto-retry
      es.onerror = () => {
        console.warn("[SSE] Connection dropped — will auto-retry");
      };

      sseRef.current = es;
    },
    [closeSSE],
  ); // selectedSubject removed — use selectedSubjectRef instead

  // ── Open SSE when a session becomes active ──
  useEffect(() => {
    if (currentSession?.id) {
      openSSE(currentSession.id);
    } else {
      closeSSE();
    }
    // Cleanup when component unmounts or session changes
    return () => closeSSE();
  }, [currentSession?.id]);

  // ── Auto-poll: detect active sessions across all assigned subjects ──
  // Runs every 10s on the subject cards page.
  // SSE handles instant updates once inside a session —
  // this poll is the trigger that gets us into the session.
  useEffect(() => {
    fetchTeacherSubjects();
  }, []);

  useEffect(() => {
    if (subjects.length === 0) return;

    const pollAll = () => {
      subjects.forEach((subject) => {
        api
          .get(`/attendance/session/${subject.id}`)
          .then((res) => {
            const session = res.data;
            setActiveSessions((prev) => ({
              ...prev,
              [subject.id]: !!session,
            }));
            // Auto-jump to attendance view if session detected and no subject selected
            if (session && !selectedSubject && !showHistory) {
              setSelectedSubject(subject);
              setCurrentSession(session);
            }
          })
          .catch(() => {
            setActiveSessions((prev) => ({ ...prev, [subject.id]: false }));
          });
      });
    };

    pollAll();
    const interval = setInterval(pollAll, 10000);
    return () => clearInterval(interval);
  }, [subjects]);

  // ── Fallback poll: refresh session every 30s while SSE is active ──
  // SSE delivers instant updates. This slower poll is a safety net —
  // if SSE misses an event, the poll catches it within 30 seconds.
  useEffect(() => {
    if (!selectedSubject || showHistory) return;

    const refresh = () => {
      api
        .get(`/attendance/session/${selectedSubject.id}`)
        .then((res) => setCurrentSession(res.data))
        .catch(() => {});
    };

    const interval = setInterval(refresh, 30000); // 30s fallback (SSE is instant)
    return () => clearInterval(interval);
  }, [selectedSubject, showHistory]);

  const fetchTeacherSubjects = () => {
    setLoading(true);
    api
      .get("/subjects/teacher")
      .then((res) => {
        setSubjects(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load subjects");
        setLoading(false);
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setShowHistory(false);
    setError("");
    setSuccess("");
    checkOngoingSession(subject.id);
  };

  const checkOngoingSession = (subjectId) => {
    api
      .get(`/attendance/session/${subjectId}`)
      .then((res) => setCurrentSession(res.data))
      .catch(() => setCurrentSession(null));
  };

  const startAttendance = () => {
    if (!selectedSubject) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    api
      .post("/attendance/session", {
        subjectId: selectedSubject.id,
        durationMinutes: 120,
      })
      .then((res) => {
        setCurrentSession(res.data.session);
        setSuccess("✅ Attendance session started.");
        setActionLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to start session.");
        setActionLoading(false);
      });
  };

  const endAttendance = () => {
    if (!currentSession) return;
    if (
      !window.confirm(
        "End this session? Remaining absent students will be marked ABSENT.",
      )
    )
      return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    api
      .put(`/attendance/session/${currentSession.id}/end`)
      .then(() => {
        setCurrentSession(null);
        setSuccess("✅ Session ended.");
        setActionLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to end session.");
        setActionLoading(false);
      });
  };

  const viewAttendanceHistory = () => {
    if (!selectedSubject) return;
    setLoading(true);
    api
      .get(`/attendance/report/${selectedSubject.id}`)
      .then((res) => {
        setAttendanceHistory(res.data);
        setShowHistory(true);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load attendance history.");
        setLoading(false);
      });
  };

  // ── Build schedule slot list from subject's defined schedules ──
  // Each slot = { label, startTime, endTime, dayOfWeek }
  // Used by the picker — one button per schedule slot
  const getScheduleSlots = () => {
    const schedules = selectedSubject?.schedules || [];
    if (schedules.length === 0) return [];
    const FULL_DAYS = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return schedules.map((sch) => ({
      label: `${FULL_DAYS[sch.dayOfWeek]} ${formatHHMM(sch.startTime)} – ${formatHHMM(sch.endTime)}`,
      startTime: sch.startTime, // "07:00"
      endTime: sch.endTime, // "10:00"
      dayOfWeek: sch.dayOfWeek, // 0–6
    }));
  };

  const exportToCSV = (slot) => {
    if (!attendanceHistory?.report || !attendanceHistory?.sessions) return;

    // ── Helper — extract HH:MM from a DateTime ──
    const toHHMM = (dateStr) => {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const subjectCode = selectedSubject.code || "";
    const subjectName = selectedSubject.name || "";
    const room = "311";
    const facultyName =
      selectedSubject.teachers?.[0]?.teacher?.name || userName || "N/A";
    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const fmtDate = (dateStr) => {
      const d = new Date(dateStr);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yy = d.getFullYear();
      return `${mm}/${dd}/${yy}`;
    };

    const NL = "\n";
    let csv = "";

    // ── Filter sessions matching this schedule slot ──
    // Match: dayOfWeek + startTime + endTime of scheduledStart/End
    const matchingSessions = [...attendanceHistory.sessions]
      .filter((s) => {
        const sessionDay = new Date(s.scheduledStart).getDay();
        const sessionStart = toHHMM(s.scheduledStart);
        const sessionEnd = toHHMM(s.scheduledEnd);
        return (
          sessionDay === slot.dayOfWeek &&
          sessionStart === slot.startTime &&
          sessionEnd === slot.endTime
        );
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (matchingSessions.length === 0) {
      alert(`No sessions found for ${slot.label}`);
      return;
    }

    // ── Unique sections ──
    const uniqueSections = [
      ...new Set(
        attendanceHistory.report.map((r) => r.student.section).filter(Boolean),
      ),
    ]
      .sort()
      .join(", ");

    // ── Header block ──
    csv += `"Subject Code:","${subjectCode}","","Subject Name:","${subjectName}"${NL}`;
    csv += `"Year & Section:","${uniqueSections}","","Schedule:","${slot.label}"${NL}`;
    csv += `"Room:","${room}","","Faculty-in-Charge:","${facultyName}"${NL}`;
    csv += `"Date Generated:","${exportDate}"${NL}`;
    csv += NL;

    // ── Column headers ──
    csv += `No.,Last Name,First Name,MI,Date,Status${NL}`;

    // ── Sort students by surname ──
    const sortedReport = [...attendanceHistory.report].sort((a, b) =>
      (a.student.surname || "").localeCompare(b.student.surname || ""),
    );

    // ── One row per student per session ──
    let rowNo = 1;
    matchingSessions.forEach((session) => {
      const dateStr = fmtDate(session.date);
      sortedReport.forEach((row) => {
        const surname = (row.student.surname || "").trim().toUpperCase();
        const first = (row.student.firstName || "").trim();
        const mi = (row.student.middleInitial || "").trim().toUpperCase();
        const record = session.records?.find(
          (r) => r.studentId === row.student.id,
        );
        const status = record?.status || "ABSENT";
        csv += `${rowNo},"${surname}","${first}","${mi}","${dateStr}","${status}"${NL}`;
        rowNo++;
      });
    });

    // ── Download ──
    const safeSlot = slot.label.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${subjectCode}_${safeSlot}.csv`;
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    setShowExportPicker(false);
  };

  // ── Export the most recent session for this subject ──
  // Always picks the latest completed session regardless of schedule slot
  const exportLatestScheduleCSV = () => {
    if (
      !attendanceHistory?.sessions ||
      attendanceHistory.sessions.length === 0
    ) {
      alert("No sessions found for this subject.");
      return;
    }

    // Sort newest first — take the most recent session
    const sorted = [...attendanceHistory.sessions].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    exportSessionCSV(sorted[0]);
  };

  // ── Export a single session's attendance as CSV ──
  const exportSessionCSV = (session) => {
    if (!attendanceHistory?.report) return;

    const subjectCode = selectedSubject.code || "";
    const subjectName = selectedSubject.name || "";
    const room = "311";
    const facultyName =
      selectedSubject.teachers?.[0]?.teacher?.name || userName || "N/A";
    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const fmtDate = (dateStr) => {
      const d = new Date(dateStr);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yy = d.getFullYear();
      return `${mm}/${dd}/${yy}`;
    };

    const toHHMM = (dateStr) => {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const sessionDate = fmtDate(session.date);
    const sessionStart = toHHMM(session.scheduledStart);
    const sessionEnd = toHHMM(session.scheduledEnd);
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
    const scheduleLabel = `${sessionDay} ${formatHHMM(sessionStart)} – ${formatHHMM(sessionEnd)}`;

    const uniqueSections = [
      ...new Set(
        attendanceHistory.report.map((r) => r.student.section).filter(Boolean),
      ),
    ]
      .sort()
      .join(", ");

    const NL = "\n";
    let csv = "";

    // ── Header block ──
    csv += `"Subject Code:","${subjectCode}","","Subject Name:","${subjectName}"${NL}`;
    csv += `"Year & Section:","${uniqueSections}","","Schedule:","${scheduleLabel}"${NL}`;
    csv += `"Room:","${room}","","Faculty-in-Charge:","${facultyName}"${NL}`;
    csv += `"Date:","${sessionDate}","","Date Generated:","${exportDate}"${NL}`;
    csv += NL;

    // ── Column headers ──
    csv += `No.,Last Name,First Name,MI,Status${NL}`;

    // ── Student rows sorted by surname ──
    const sortedReport = [...attendanceHistory.report].sort((a, b) =>
      (a.student.surname || "").localeCompare(b.student.surname || ""),
    );

    sortedReport.forEach((row, idx) => {
      const no = idx + 1;
      const surname = (row.student.surname || "").trim().toUpperCase();
      const first = (row.student.firstName || "").trim();
      const mi = (row.student.middleInitial || "").trim().toUpperCase();
      const record = session.records?.find(
        (r) => r.studentId === row.student.id,
      );
      // Treat PENDING as ABSENT in the export — PENDING means the session
      // closed before the student was scanned, which counts as absent.
      const rawStatus = record?.status || "ABSENT";
      const status = rawStatus === "PENDING" ? "ABSENT" : rawStatus;
      csv += `${no},"${surname}","${first}","${mi}","${status}"${NL}`;
    });

    // ── Download ──
    const d = new Date(session.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fileName = `${subjectCode}_${dateKey}_${sessionDay}.csv`;
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const backToSubjects = () => {
    closeSSE();
    setSelectedSubject(null);
    setCurrentSession(null);
    setShowHistory(false);
    setAttendanceHistory(null);
    setError("");
    setSuccess("");
  };
  const backToAttendance = () => {
    setShowHistory(false);
    checkOngoingSession(selectedSubject.id);
  };

  // ── Shared navbar ──
  const Navbar = ({ title }) => (
    <header className="dashboard-header">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">🎓</div>
          <div className="nav-brand-text">
            <span className="nav-brand-title">FaceCloud</span>
            <span className="nav-brand-sub">PUP · CPE Department</span>
          </div>
        </div>
        {title && (
          <div style={{ flex: 1, textAlign: "center" }}>
            <span
              style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}
            >
              {title}
            </span>
          </div>
        )}
        <div className="dashboard-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">Faculty</div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </nav>
    </header>
  );

  // ══════════════════════════════════════
  // VIEW 1 — Subject cards
  // ══════════════════════════════════════
  if (!selectedSubject) {
    return (
      <div className="dashboard">
        <Navbar />
        <main className="dashboard-content">
          <div className="welcome-card">
            <h2>Welcome, {userName}!</h2>
            <p>Select a subject to manage attendance.</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "var(--ink-faint)",
              }}
            >
              Loading subjects…
            </div>
          ) : subjects.length === 0 ? (
            <div className="empty-state" style={{ padding: "60px 0" }}>
              <p style={{ fontSize: "16px", marginBottom: "8px" }}>
                No subjects assigned.
              </p>
              <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>
                Contact your administrator to be assigned to a subject.
              </p>
            </div>
          ) : (
            <div className="subjects-grid">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="subject-card"
                  style={{ cursor: "pointer", transition: "all 0.18s" }}
                  onClick={() => handleSubjectClick(subject)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(192,32,42,0.12)";
                    e.currentTarget.style.borderColor = "var(--pup-red-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    <span className="subject-code">{subject.code}</span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {activeSessions[subject.id] && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "20px",
                            background: "#fee2e2",
                            color: "#991b1b",
                            fontSize: "11px",
                            fontWeight: 700,
                            animation: "pulse 1.5s infinite",
                          }}
                        >
                          🔴 LIVE
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--ink-faint)",
                          fontWeight: 500,
                        }}
                      >
                        {subject.enrollments.length} student
                        {subject.enrollments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <p className="subject-name" style={{ marginBottom: "12px" }}>
                    {subject.name}
                  </p>

                  {subject.schedules.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        paddingTop: "10px",
                        marginBottom: "12px",
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
                          📅 {DAYS[s.dayOfWeek]}: {s.startTime} – {s.endTime}
                        </p>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--pup-red)",
                      }}
                    >
                      View Attendance →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ══════════════════════════════════════
  // VIEW 2 — Attendance History
  // ══════════════════════════════════════
  if (showHistory && attendanceHistory) {
    const avgRate =
      attendanceHistory.report.length > 0
        ? Math.round(
            attendanceHistory.report.reduce((s, r) => s + r.attendanceRate, 0) /
              attendanceHistory.report.length,
          )
        : 0;

    return (
      <div className="dashboard">
        <Navbar title={`${selectedSubject.name} — History`} />
        <main className="dashboard-content">
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <button onClick={backToSubjects} className="btn-back">
              ← Back to Subjects
            </button>
            <button onClick={backToAttendance} className="btn-secondary">
              ← Back to Attendance
            </button>
            <button
              onClick={exportLatestScheduleCSV}
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
            >
              📥 Export Schedule
            </button>
          </div>

          {/* Summary stats */}
          <div className="stats-grid" style={{ marginBottom: "24px" }}>
            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-label">Total Sessions</div>
                <div className="stat-value">
                  {attendanceHistory.sessions.length}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-label">Students</div>
                <div className="stat-value">
                  {attendanceHistory.report.length}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-label">Avg Attendance</div>
                <div className="stat-value">{avgRate}%</div>
              </div>
            </div>
          </div>

          {/* Report table */}
          <div className="management-section">
            <p className="section-title">
              Attendance Report — {selectedSubject.name}
            </p>
            {attendanceHistory.report.length === 0 ? (
              <p style={{ color: "var(--ink-faint)", fontSize: "14px" }}>
                No data yet.
              </p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Section</th>
                      <th>Sessions</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Absent</th>
                      <th>Rate</th>
                      <th>Standing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.report.map((row) => {
                      const rate = row.attendanceRate;
                      const standing =
                        rate >= 90 ? "Good" : rate >= 75 ? "Fair" : "Poor";
                      const badgeColor =
                        rate >= 90
                          ? { bg: "#dcfce7", color: "#166534" }
                          : rate >= 75
                            ? { bg: "#fef9c3", color: "#854d0e" }
                            : { bg: "#fee2e2", color: "#991b1b" };
                      return (
                        <tr key={row.student.id}>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: "12px",
                              color: "var(--ink-muted)",
                            }}
                          >
                            {row.student.studentId}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {formatDisplayName(
                              row.student.surname,
                              row.student.firstName,
                              row.student.middleInitial,
                            )}
                          </td>
                          <td>
                            <span
                              className="subject-code"
                              style={{ fontSize: "11px" }}
                            >
                              {row.student.section}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {row.totalSessions}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              color: "#10b981",
                              fontWeight: 600,
                            }}
                          >
                            {row.present}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              color: "#f59e0b",
                              fontWeight: 600,
                            }}
                          >
                            {row.late}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              color: "#ef4444",
                              fontWeight: 600,
                            }}
                          >
                            {row.absent}
                          </td>
                          <td style={{ minWidth: "100px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  height: "6px",
                                  background: "var(--border)",
                                  borderRadius: "3px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${rate}%`,
                                    height: "100%",
                                    background:
                                      rate >= 90
                                        ? "#10b981"
                                        : rate >= 75
                                          ? "#f59e0b"
                                          : "#ef4444",
                                    borderRadius: "3px",
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {rate}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                padding: "2px 10px",
                                borderRadius: "20px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: badgeColor.bg,
                                color: badgeColor.color,
                              }}
                            >
                              {standing}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Session list */}
          <div className="management-section" style={{ marginTop: "24px" }}>
            <p className="section-title">Session History</p>
            {attendanceHistory.sessions.length === 0 ? (
              <p style={{ color: "var(--ink-faint)", fontSize: "14px" }}>
                No sessions yet.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {attendanceHistory.sessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{ fontWeight: 500, fontSize: "14px", flex: 1 }}
                    >
                      {formatDate(session.date)}
                    </span>
                    <span
                      style={{ fontSize: "13px", color: "var(--ink-muted)" }}
                    >
                      {formatTime(session.scheduledStart)} –{" "}
                      {formatTime(session.scheduledEnd)}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--ink-faint)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        minWidth: "80px",
                        textAlign: "center",
                      }}
                    >
                      {session.status}
                    </span>
                    <button
                      onClick={() => exportSessionCSV(session)}
                      title="Download attendance for this session"
                      style={{
                        padding: "5px 10px",
                        background: "var(--white)",
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
                        e.currentTarget.style.background = "var(--white)";
                        e.currentTarget.style.borderColor = "var(--border)";
                      }}
                    >
                      📥
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ══════════════════════════════════════
  // VIEW 3 — Live Attendance
  // ══════════════════════════════════════
  const presentCount =
    currentSession?.records.filter((r) => r.status === "PRESENT").length || 0;
  const lateCount =
    currentSession?.records.filter((r) => r.status === "LATE").length || 0;
  const absentCount =
    currentSession?.records.filter((r) => r.status === "ABSENT").length || 0;
  const pendingCount =
    currentSession?.records.filter((r) => r.status === "PENDING").length || 0;
  const totalCount = currentSession?.records.length || 0;

  return (
    <div className="dashboard">
      <Navbar title={selectedSubject.name} />
      <main className="dashboard-content">
        <div style={{ marginBottom: "16px" }}>
          <button onClick={backToSubjects} className="btn-back">
            ← Back to Subjects
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "12px" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: "12px" }}>
            {success}
          </div>
        )}

        {/* Session control card */}
        <div className="user-management-card" style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "4px",
                }}
              >
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--ink)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {selectedSubject.name}
                </p>
                <span className="subject-code">{selectedSubject.code}</span>
                {currentSession && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px",
                      background: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    🔴 SESSION ONGOING
                  </span>
                )}
              </div>
              {currentSession && (
                <p style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                  Started {formatTime(currentSession.scheduledStart)} · Ends{" "}
                  {formatTime(currentSession.scheduledEnd)}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {!currentSession ? (
                <button
                  onClick={startAttendance}
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ minWidth: "160px" }}
                >
                  {actionLoading ? "Starting…" : "▶ Start Attendance"}
                </button>
              ) : (
                <button
                  onClick={endAttendance}
                  disabled={actionLoading}
                  style={{
                    minWidth: "140px",
                    padding: "9px 18px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: actionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {actionLoading ? "Ending…" : "⏹ End Session"}
                </button>
              )}
              <button onClick={viewAttendanceHistory} className="btn-secondary">
                📊 View History
              </button>
            </div>
          </div>
        </div>

        {/* Live stats */}
        {currentSession && totalCount > 0 && (
          <div className="stats-grid" style={{ marginBottom: "20px" }}>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-content">
                <div className="stat-label">Pending</div>
                <div className="stat-value" style={{ color: "#64748b" }}>
                  {pendingCount}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-label">Present</div>
                <div className="stat-value" style={{ color: "#10b981" }}>
                  {presentCount}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏰</div>
              <div className="stat-content">
                <div className="stat-label">Late</div>
                <div className="stat-value" style={{ color: "#f59e0b" }}>
                  {lateCount}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❌</div>
              <div className="stat-content">
                <div className="stat-label">Absent</div>
                <div className="stat-value" style={{ color: "#ef4444" }}>
                  {absentCount}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-label">Total</div>
                <div className="stat-value">{totalCount}</div>
              </div>
            </div>
          </div>
        )}

        {currentSession ? (
          <div className="management-section">
            <p className="section-title">Attendance List</p>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Section</th>
                    <th>Arrival Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSession.records.map((record) => (
                    <tr key={record.id}>
                      <td
                        style={{
                          fontFamily: "monospace",
                          fontSize: "12px",
                          color: "var(--ink-muted)",
                        }}
                      >
                        {record.student.studentId}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {formatDisplayName(
                          record.student.surname,
                          record.student.firstName,
                          record.student.middleInitial,
                        )}
                      </td>
                      <td>
                        <span
                          className="subject-code"
                          style={{ fontSize: "11px" }}
                        >
                          {record.student.section}
                        </span>
                      </td>
                      <td
                        style={{ fontSize: "13px", color: "var(--ink-muted)" }}
                      >
                        {formatTime(record.arrivalTime)}
                      </td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "60px 0" }}>
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>
              No active session.
            </p>
            <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>
              Click <strong>▶ Start Attendance</strong> to begin tracking, or{" "}
              <strong>📊 View History</strong> to see past records.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default TeacherDashboard;
