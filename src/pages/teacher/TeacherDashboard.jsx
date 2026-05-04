import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "Unknown";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}
function formatTime(ds) {
  if (!ds) return "--:--";
  return new Date(ds).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDate(ds) {
  return new Date(ds).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function formatHHMM(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function formatSchedules(schedules) {
  if (!schedules || schedules.length === 0) return "No schedule set";
  return schedules
    .map(
      (s) =>
        `${FULL_DAYS[s.dayOfWeek]} ${formatHHMM(s.startTime)} to ${formatHHMM(s.endTime)}`,
    )
    .join(" | ");
}

function StatusBadge({ status }) {
  const map = {
    PENDING: { bg: "var(--surface2)", color: "var(--ink-faint)" },
    PRESENT: { bg: "var(--green-bg)", color: "var(--green)" },
    LATE: { bg: "var(--amber-bg)", color: "var(--amber)" },
    ABSENT: { bg: "var(--red-bg)", color: "var(--red)" },
  };
  const c = map[status] || map.PENDING;
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontFamily: "var(--font-mono)",
      }}
    >
      {status}
    </span>
  );
}

function TeacherDashboard({ dark, toggleDark }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Teacher";

  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [activeSessions, setActiveSessions] = useState({});
  const [attendanceHistory, setAttendanceHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [overrideLoading, setOverrideLoading] = useState({});

  const sseRef = useRef(null);
  const selectedClassRef = useRef(null);
  const currentSessionRef = useRef(null);
  useEffect(() => {
    selectedClassRef.current = selectedClass;
  }, [selectedClass]);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Derive section-aware class list from subjects
  // Each entry: { key, subjectId, subjectCode, subjectName, section, schedules, subject, enrollments }
  const classes = useMemo(() => {
    const result = [];
    subjects.forEach((subject) => {
      const sectionMap = {};
      subject.schedules.forEach((sch) => {
        const sec = sch.section || "";
        if (!sectionMap[sec]) sectionMap[sec] = [];
        sectionMap[sec].push(sch);
      });
      if (Object.keys(sectionMap).length === 0) {
        result.push({
          key: `${subject.id}-`,
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          section: null,
          schedules: [],
          subject,
          enrollments: subject.enrollments,
        });
      } else {
        Object.entries(sectionMap).forEach(([section, schedules]) => {
          result.push({
            key: `${subject.id}-${section}`,
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            section: section || null,
            schedules,
            subject,
            enrollments: subject.enrollments.filter(
              (e) => e.student?.section === section,
            ),
          });
        });
      }
    });
    return result;
  }, [subjects]);

  // ── SSE ────────────────────────────────────────────────────────
  const closeSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  const openSSE = useCallback(
    (sessionId) => {
      closeSSE();
      const token = localStorage.getItem("token");
      if (!token) return;
      const es = new EventSource(
        `${api.defaults.baseURL}/attendance/stream/${sessionId}?token=${token}`,
      );
      es.addEventListener("connected", () =>
        console.log(`[SSE] Connected ${sessionId}`),
      );
      es.addEventListener("attendance_update", (e) => {
        const data = JSON.parse(e.data);
        setCurrentSession((prev) => {
          if (!prev) return prev;
          const exists = prev.records.some((r) => r.id === data.record.id);
          if (exists) {
            return {
              ...prev,
              records: prev.records.map((r) =>
                r.id === data.record.id ? data.record : r,
              ),
            };
          }
          return { ...prev, records: [...prev.records, data.record] };
        });
      });
      es.addEventListener("session_started", (e) => {
        const cls = selectedClassRef.current;
        if (cls) {
          const sectionParam = cls.section
            ? `?section=${encodeURIComponent(cls.section)}`
            : "";
          api
            .get(`/attendance/session/${cls.subjectId}${sectionParam}`)
            .then((res) => setCurrentSession(res.data))
            .catch(() => {});
        }
      });
      es.addEventListener("session_ended", () => {
        setCurrentSession(null);
        setSuccess("Session ended — attendance records saved.");
        closeSSE();
      });
      es.onerror = () => console.warn("[SSE] Connection dropped — auto-retry");
      sseRef.current = es;
    },
    [closeSSE],
  );

  useEffect(() => {
    if (currentSession?.id) openSSE(currentSession.id);
    else closeSSE();
    return () => closeSSE();
  }, [currentSession?.id]);

  useEffect(() => {
    fetchTeacherSubjects();
  }, []);

  // Poll all classes for active sessions
  useEffect(() => {
    if (classes.length === 0) return;
    const pollAll = () => {
      classes.forEach((cls) => {
        const sectionParam = cls.section
          ? `?section=${encodeURIComponent(cls.section)}`
          : "";
        api
          .get(`/attendance/session/${cls.subjectId}${sectionParam}`)
          .then((res) => {
            setActiveSessions((prev) => ({ ...prev, [cls.key]: !!res.data }));
            const selCls = selectedClassRef.current;
            if (res.data && !selCls && !showHistory) {
              // No class selected yet — auto-navigate to the live session
              setSelectedClass(cls);
              setCurrentSession(res.data);
            } else if (res.data && selCls?.key === cls.key && !currentSessionRef.current) {
              // Teacher is viewing this class but no session was showing —
              // Pi just auto-created one, update within the next poll cycle
              setCurrentSession(res.data);
            }
          })
          .catch(() =>
            setActiveSessions((prev) => ({ ...prev, [cls.key]: false })),
          );
      });
    };
    pollAll();
    const interval = setInterval(pollAll, 10000);
    return () => clearInterval(interval);
  }, [classes]);

  // 30s refresh of current session while viewing
  useEffect(() => {
    if (!selectedClass || showHistory) return;
    const refresh = () => {
      const sectionParam = selectedClass.section
        ? `?section=${encodeURIComponent(selectedClass.section)}`
        : "";
      api
        .get(`/attendance/session/${selectedClass.subjectId}${sectionParam}`)
        .then((res) => setCurrentSession(res.data))
        .catch(() => {});
    };
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [selectedClass, showHistory]);

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

  const checkOngoingSession = (subjectId, section) => {
    const sectionParam = section
      ? `?section=${encodeURIComponent(section)}`
      : "";
    api
      .get(`/attendance/session/${subjectId}${sectionParam}`)
      .then((res) => setCurrentSession(res.data))
      .catch(() => setCurrentSession(null));
  };

  const handleClassClick = (cls) => {
    setSelectedClass(cls);
    setShowHistory(false);
    setError("");
    setSuccess("");
    checkOngoingSession(cls.subjectId, cls.section);
  };
  const backToSubjects = () => {
    closeSSE();
    setSelectedClass(null);
    setCurrentSession(null);
    setShowHistory(false);
    setAttendanceHistory(null);
    setError("");
    setSuccess("");
  };
  const backToAttendance = () => {
    setShowHistory(false);
    checkOngoingSession(selectedClass.subjectId, selectedClass.section);
  };

  const startAttendance = () => {
    if (!selectedClass) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    api
      .post("/attendance/session", {
        subjectId: selectedClass.subjectId,
        section: selectedClass.section,
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
    if (!selectedClass) return;
    setLoading(true);
    const sectionParam = selectedClass.section
      ? `?section=${encodeURIComponent(selectedClass.section)}`
      : "";
    api
      .get(`/attendance/report/${selectedClass.subjectId}${sectionParam}`)
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

  const handleOverride = (recordId, newStatus) => {
    setOverrideLoading((prev) => ({ ...prev, [recordId]: true }));
    api
      .put(`/attendance/record/${recordId}`, { status: newStatus })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to override status.");
      })
      .finally(() => {
        setOverrideLoading((prev) => ({ ...prev, [recordId]: false }));
      });
  };

  // ── CSV helpers ────────────────────────────────────────────────
  const getScheduleSlots = () => {
    const schedules = selectedClass?.schedules || [];
    if (schedules.length === 0) return [];
    return schedules.map((sch) => ({
      label: `${FULL_DAYS[sch.dayOfWeek]} ${formatHHMM(sch.startTime)} – ${formatHHMM(sch.endTime)}`,
      startTime: sch.startTime,
      endTime: sch.endTime,
      dayOfWeek: sch.dayOfWeek,
    }));
  };

  const exportToCSV = (slot) => {
    if (!attendanceHistory?.report || !attendanceHistory?.sessions) return;
    const toHHMM = (dateStr) => {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const fmtDate = (dateStr) => {
      const d = new Date(dateStr);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    };
    const subjectCode = selectedClass.subjectCode || "";
    const subjectName = selectedClass.subjectName || "";
    const facultyName =
      selectedClass.subject.teachers?.[0]?.teacher?.name || userName || "N/A";
    const sectionLabel = selectedClass.section || "";
    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const matchingSessions = [...attendanceHistory.sessions]
      .filter(
        (s) =>
          new Date(s.scheduledStart).getDay() === slot.dayOfWeek &&
          toHHMM(s.scheduledStart) === slot.startTime &&
          toHHMM(s.scheduledEnd) === slot.endTime,
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (matchingSessions.length === 0) {
      alert(`No sessions found for ${slot.label}`);
      return;
    }
    const NL = "\n";
    let csv = "";
    csv += `"Subject Code:","${subjectCode}","","Subject Name:","${subjectName}"${NL}`;
    csv += `"Year & Section:","${sectionLabel}","","Schedule:","${slot.label}"${NL}`;
    csv += `"Room:","311","","Faculty-in-Charge:","${facultyName}"${NL}`;
    csv += `"Date Generated:","${exportDate}"${NL}${NL}`;
    csv += `No.,Last Name,First Name,MI,Date,Status${NL}`;
    const sortedReport = [...attendanceHistory.report].sort((a, b) =>
      (a.student.surname || "").localeCompare(b.student.surname || ""),
    );
    let rowNo = 1;
    matchingSessions.forEach((session) => {
      const dateStr = fmtDate(session.date);
      sortedReport.forEach((row) => {
        const record = session.records?.find(
          (r) => r.studentId === row.student.id,
        );
        const status = record?.status || "ABSENT";
        csv += `${rowNo},"${(row.student.surname || "").trim().toUpperCase()}","${(row.student.firstName || "").trim()}","${(row.student.middleInitial || "").trim().toUpperCase()}","${dateStr}","${status}"${NL}`;
        rowNo++;
      });
    });
    const safeSlot = slot.label.replace(/[^a-zA-Z0-9]/g, "_");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${subjectCode}_${safeSlot}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setShowExportPicker(false);
  };

  const exportLatestScheduleCSV = () => {
    if (!attendanceHistory?.sessions?.length) {
      alert("No sessions found.");
      return;
    }
    exportSessionCSV(
      [...attendanceHistory.sessions].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      )[0],
    );
  };

  const exportSessionCSV = (session) => {
    if (!attendanceHistory?.report) return;
    const toHHMM = (ds) => {
      const d = new Date(ds);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const fmtDate = (ds) => {
      const d = new Date(ds);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    };
    const sessionDay = FULL_DAYS[new Date(session.scheduledStart).getDay()];
    const scheduleLabel = `${sessionDay} ${formatHHMM(toHHMM(session.scheduledStart))} – ${formatHHMM(toHHMM(session.scheduledEnd))}`;
    const subjectCode = selectedClass.subjectCode || "";
    const subjectName = selectedClass.subjectName || "";
    const sectionLabel = selectedClass.section || "";
    const facultyName =
      selectedClass.subject.teachers?.[0]?.teacher?.name || userName || "N/A";
    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const NL = "\n";
    let csv = "";
    csv += `"Subject Code:","${subjectCode}","","Subject Name:","${subjectName}"${NL}`;
    csv += `"Year & Section:","${sectionLabel}","","Schedule:","${scheduleLabel}"${NL}`;
    csv += `"Room:","311","","Faculty-in-Charge:","${facultyName}"${NL}`;
    csv += `"Date:","${fmtDate(session.date)}","","Date Generated:","${exportDate}"${NL}${NL}`;
    csv += `No.,Last Name,First Name,MI,Status${NL}`;
    const sortedReport = [...attendanceHistory.report].sort((a, b) =>
      (a.student.surname || "").localeCompare(b.student.surname || ""),
    );
    sortedReport.forEach((row, idx) => {
      const record = session.records?.find(
        (r) => r.studentId === row.student.id,
      );
      const status =
        (record?.status || "ABSENT") === "PENDING"
          ? "ABSENT"
          : record?.status || "ABSENT";
      csv += `${idx + 1},"${(row.student.surname || "").trim().toUpperCase()}","${(row.student.firstName || "").trim()}","${(row.student.middleInitial || "").trim().toUpperCase()}","${status}"${NL}`;
    });
    const d = new Date(session.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${subjectCode}_${dateKey}_${sessionDay}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Stats ───────────────────────────────────────────────────────
  const presentCount =
    currentSession?.records.filter((r) => r.status === "PRESENT").length || 0;
  const lateCount =
    currentSession?.records.filter((r) => r.status === "LATE").length || 0;
  const absentCount =
    currentSession?.records.filter((r) => r.status === "ABSENT").length || 0;
  const pendingCount =
    currentSession?.records.filter((r) => r.status === "PENDING").length || 0;
  const totalCount = currentSession?.records.length || 0;

  const filteredRecords = (currentSession?.records || []).filter((r) => {
    const matchSearch = formatDisplayName(
      r.student.surname,
      r.student.firstName,
      r.student.middleInitial,
    )
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchFilter = statusFilter === "ALL" || r.status === statusFilter;
    return matchSearch && matchFilter;
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totalStudents = classes.reduce(
    (s, cls) => s + cls.enrollments.length,
    0,
  );
  const activeLive = classes.filter((cls) => activeSessions[cls.key]).length;

  // ══════════════════════════════════════════════════════════════
  // VIEW 1 — Class Cards (My Classes)
  // ══════════════════════════════════════════════════════════════
  if (!selectedClass) {
    return (
      <div className="dashboard">
        <Sidebar
          role="TEACHER"
          dark={dark}
          onToggleDark={toggleDark}
          onLogout={handleLogout}
        />
        <div className="main-area">
          <div className="topbar">
            <span className="tb-title">My Classes</span>
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
            {/* Welcome banner */}
            <div className="welcome-banner" style={{ marginBottom: "24px" }}>
              <div className="welcome-watermark">FC</div>
              <div className="welcome-inner">
                <h2>Good morning, {userName}!</h2>
                <p>{today}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid stats-grid-3">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-content">
                  <div className="stat-label">Classes</div>
                  <div className="stat-value">{classes.length}</div>
                  <div className="stat-sub">Section–subject pairs</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-label">Students</div>
                  <div className="stat-value">{totalStudents}</div>
                  <div className="stat-sub">Total enrolled</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📡</div>
                <div className="stat-content">
                  <div className="stat-label">Active Now</div>
                  <div className="stat-value">{activeLive}</div>
                  <div className="stat-sub">Session running</div>
                </div>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="section-label">My Classes</div>

            {loading ? (
              <div className="empty-state">
                <div className="spinner" />
                <p>Loading classes…</p>
              </div>
            ) : classes.length === 0 ? (
              <div className="empty-state">
                <h3>No classes assigned</h3>
                <p>
                  Contact your administrator to be assigned to a subject with
                  sections enrolled.
                </p>
              </div>
            ) : (
              <div className="subjects-grid">
                {classes.map((cls) => {
                  const isLive = activeSessions[cls.key];
                  return (
                    <div
                      key={cls.key}
                      className="subject-card"
                      style={{
                        border: `1px solid ${isLive ? "rgba(14,165,233,0.4)" : "var(--border)"}`,
                        boxShadow: isLive
                          ? "0 0 0 3px rgba(14,165,233,0.08)"
                          : "none",
                        cursor: "pointer",
                      }}
                      onClick={() => handleClassClick(cls)}
                    >
                      <div className="subject-card-inner">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            marginBottom: "8px",
                          }}
                        >
                          <span className="subject-code">
                            {cls.subjectCode}
                          </span>
                          {isLive && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              <div
                                style={{
                                  width: "7px",
                                  height: "7px",
                                  borderRadius: "50%",
                                  background: "var(--green)",
                                  animation: "pulse 1.5s infinite",
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "var(--green)",
                                  fontFamily: "var(--font-mono)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Live
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Section badge — prominently shown */}
                        {cls.section && (
                          <div style={{ marginBottom: "6px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                background: "var(--sky-4)",
                                color: "var(--sky-dark)",
                                borderRadius: "5px",
                                fontSize: "11px",
                                fontWeight: 700,
                                fontFamily: "var(--font-mono)",
                                border: "1px solid rgba(14,165,233,.2)",
                              }}
                            >
                              {cls.section}
                            </span>
                          </div>
                        )}
                        <div
                          className="subject-name"
                          style={{ marginBottom: "4px" }}
                        >
                          {cls.subjectName}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--ink-faint)",
                            fontFamily: "var(--font-mono)",
                            marginBottom: "14px",
                          }}
                        >
                          {cls.schedules.map((s, i) => (
                            <span key={i}>
                              {i > 0 ? " · " : ""}
                              {DAY_SHORT[s.dayOfWeek]} {s.startTime}–{s.endTime}
                            </span>
                          ))}
                        </div>
                        <div style={{ marginBottom: "14px" }}>
                          <span className="badge badge-neutral">
                            {cls.enrollments.length} students
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {isLive ? (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClassClick(cls);
                                }}
                              >
                                View Live Session
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClass(cls);
                                  checkOngoingSession(
                                    cls.subjectId,
                                    cls.section,
                                  );
                                }}
                              >
                                End Session
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClassClick(cls);
                              }}
                            >
                              Start Session
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClass(cls);
                              setShowHistory(false);
                              setLoading(true);
                              const sectionParam = cls.section
                                ? `?section=${encodeURIComponent(cls.section)}`
                                : "";
                              api
                                .get(
                                  `/attendance/report/${cls.subjectId}${sectionParam}`,
                                )
                                .then((res) => {
                                  setAttendanceHistory(res.data);
                                  setShowHistory(true);
                                  setLoading(false);
                                })
                                .catch(() => {
                                  setError("Failed to load history.");
                                  setLoading(false);
                                });
                            }}
                          >
                            History
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VIEW 2 — Attendance History
  // ══════════════════════════════════════════════════════════════
  if (showHistory && attendanceHistory) {
    const avgRate =
      attendanceHistory.report.length > 0
        ? Math.round(
            attendanceHistory.report.reduce((s, r) => s + r.attendanceRate, 0) /
              attendanceHistory.report.length,
          )
        : 0;
    const standingType = (r) =>
      r >= 90 ? "status-good" : r >= 75 ? "status-warning" : "status-poor";
    const standingLabel = (r) => (r >= 90 ? "Good" : r >= 75 ? "Fair" : "Poor");
    const classTitle = `${selectedClass.subjectName}${selectedClass.section ? ` · ${selectedClass.section}` : ""}`;
    return (
      <div className="dashboard">
        <Sidebar
          role="TEACHER"
          dark={dark}
          onToggleDark={toggleDark}
          onLogout={handleLogout}
        />
        <div className="main-area">
          <div className="topbar">
            <span className="tb-title">{classTitle} — History</span>
          </div>
          <main className="main-content">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "24px",
                flexWrap: "wrap",
              }}
            >
              <button className="btn-back" onClick={backToSubjects}>
                ← Back to Classes
              </button>
              <button className="btn-back" onClick={backToAttendance}>
                ← Back to Attendance
              </button>
              <div style={{ flex: 1 }} />
              {showExportPicker ? (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                    Select schedule:
                  </span>
                  {getScheduleSlots().map((slot, i) => (
                    <button
                      key={i}
                      className="btn btn-ghost btn-sm"
                      onClick={() => exportToCSV(slot)}
                    >
                      {slot.label}
                    </button>
                  ))}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowExportPicker(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    getScheduleSlots().length > 1
                      ? setShowExportPicker(true)
                      : exportLatestScheduleCSV()
                  }
                >
                  📥 Export Schedule
                </button>
              )}
            </div>

            <div className="stats-grid stats-grid-3">
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

            {/* Attendance report table */}
            <div
              className="user-management-card"
              style={{ padding: 0, marginBottom: "20px" }}
            >
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  Attendance Report — {classTitle}
                </div>
              </div>
              <div
                className="table-container"
                style={{ border: "none", borderRadius: 0 }}
              >
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
                    {attendanceHistory.report.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          style={{
                            padding: "32px",
                            textAlign: "center",
                            color: "var(--ink-faint)",
                          }}
                        >
                          No data yet.
                        </td>
                      </tr>
                    ) : (
                      attendanceHistory.report.map((row) => {
                        const rate = row.attendanceRate;
                        const fillColor =
                          rate >= 90
                            ? "var(--green)"
                            : rate >= 75
                              ? "var(--amber)"
                              : "var(--red)";
                        return (
                          <tr key={row.student.id}>
                            <td
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "12px",
                                color: "var(--ink-faint)",
                              }}
                            >
                              {row.student.studentId}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {formatDisplayName(
                                row.student.surname,
                                row.student.firstName,
                                row.student.middleInitial,
                              )}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 7px",
                                  background: "var(--sky-4)",
                                  color: "var(--sky-dark)",
                                  borderRadius: "5px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-mono)",
                                  border: "1px solid rgba(14,165,233,.2)",
                                }}
                              >
                                {row.student.section}
                              </span>
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                fontFamily: "var(--font-mono)",
                                fontWeight: 600,
                                color: "var(--ink-muted)",
                              }}
                            >
                              {row.totalSessions}
                            </td>
                            <td className="present-count">{row.present}</td>
                            <td className="late-count">{row.late}</td>
                            <td className="absent-count">{row.absent}</td>
                            <td className="attendance-rate">
                              <div className="progress-bar">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${rate}%`,
                                    background: fillColor,
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-mono)",
                                  flexShrink: 0,
                                }}
                              >
                                {rate}%
                              </span>
                            </td>
                            <td>
                              <span
                                className={`status-badge ${standingType(rate)}`}
                              >
                                {standingLabel(rate)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Session history list */}
            <div className="user-management-card" style={{ padding: 0 }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  Session History
                </div>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {attendanceHistory.sessions.length === 0 ? (
                  <div
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: "var(--ink-faint)",
                    }}
                  >
                    No sessions yet.
                  </div>
                ) : (
                  attendanceHistory.sessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className="session-date">
                        {formatDate(session.date)}
                      </div>
                      <div className="session-details">
                        <span>
                          {formatTime(session.scheduledStart)} –{" "}
                          {formatTime(session.scheduledEnd)}
                        </span>
                        <span
                          className="session-status"
                          style={{ color: "var(--green)" }}
                        >
                          {session.status}
                        </span>
                      </div>
                      <button
                        className="btn-icon"
                        style={{ color: "var(--sky-dark)" }}
                        onClick={() => exportSessionCSV(session)}
                        title="Export session"
                      >
                        ↓
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VIEW 3 — Live Session
  // ══════════════════════════════════════════════════════════════
  const classTitle = `${selectedClass.subjectName}${selectedClass.section ? ` · ${selectedClass.section}` : ""}`;
  return (
    <div className="dashboard">
      <Sidebar
        role="TEACHER"
        dark={dark}
        onToggleDark={toggleDark}
        onLogout={handleLogout}
      />
      <div className="main-area">
        <div className="topbar">
          <span className="tb-title">
            {classTitle}
            {currentSession && (
              <span className="tb-live" style={{ marginLeft: "10px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "var(--green)",
                    display: "inline-block",
                    animation: "pulse 1.5s infinite",
                  }}
                />
                Session Live
              </span>
            )}
          </span>
        </div>
        <main className="main-content">
          <div style={{ marginBottom: "16px" }}>
            <button className="btn-back" onClick={backToSubjects}>
              ← Back to Classes
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Session header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
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
                <h1
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--ink)",
                    letterSpacing: "-.02em",
                    margin: 0,
                  }}
                >
                  {selectedClass.subjectName}
                </h1>
                {selectedClass.section && (
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
                    {selectedClass.section}
                  </span>
                )}
                {currentSession && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px",
                      background: "var(--green-bg)",
                      border: "1px solid var(--green-border)",
                      borderRadius: "20px",
                    }}
                  >
                    <div
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "var(--green)",
                        animation: "pulse 1.5s infinite",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--green)",
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Session Live
                    </span>
                  </div>
                )}
                {!currentSession && (
                  <span className="badge badge-neutral">Session Ended</span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--ink-faint)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {selectedClass.subjectCode} ·{" "}
                {selectedClass.schedules
                  ?.map(
                    (s, i) =>
                      `${i > 0 ? " " : ""}${DAY_SHORT[s.dayOfWeek]} ${s.startTime}–${s.endTime}`,
                  )
                  .join(" ")}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {!currentSession ? (
                <button
                  className="btn btn-primary"
                  onClick={startAttendance}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Starting…" : "▶ Start Attendance"}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      viewAttendanceHistory();
                    }}
                  >
                    Export CSV
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={endAttendance}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Ending…" : "End Session"}
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={viewAttendanceHistory}
              >
                History
              </button>
            </div>
          </div>

          {/* 5-stat pills */}
          {currentSession && (
            <div className="session-stat-pills">
              {[
                {
                  label: "Pending",
                  count: pendingCount,
                  color: "var(--ink-faint)",
                  bg: "var(--surface2)",
                  border: "var(--ink-faint)",
                },
                {
                  label: "Present",
                  count: presentCount,
                  color: "var(--green)",
                  bg: "var(--green-bg)",
                  border: "var(--green)",
                },
                {
                  label: "Late",
                  count: lateCount,
                  color: "var(--amber)",
                  bg: "var(--amber-bg)",
                  border: "var(--amber)",
                },
                {
                  label: "Absent",
                  count: absentCount,
                  color: "var(--red)",
                  bg: "var(--red-bg)",
                  border: "var(--red)",
                },
                {
                  label: "Total",
                  count: totalCount,
                  color: "var(--sky)",
                  bg: "var(--sky-5)",
                  border: "var(--sky)",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="session-stat-pill"
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}33`,
                  }}
                >
                  <div
                    className="session-stat-count"
                    style={{ color: s.color }}
                  >
                    {s.count}
                  </div>
                  <div
                    className="session-stat-label"
                    style={{ color: s.color }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search + filter */}
          {currentSession && (
            <div
              className="user-management-card"
              style={{ padding: "12px 16px", marginBottom: "14px" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  className="form-input"
                  style={{ flex: "1", minWidth: "160px", maxWidth: "300px" }}
                  placeholder="Search student…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="status-filter-bar">
                  {["ALL", "PRESENT", "LATE", "ABSENT", "PENDING"].map((f) => (
                    <button
                      key={f}
                      className={`status-filter-btn${statusFilter === f ? " active" : ""}`}
                      onClick={() => setStatusFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Records table */}
          {currentSession ? (
            <div className="user-management-card" style={{ padding: 0 }}>
              <div
                className="table-container"
                style={{ border: "none", borderRadius: 0 }}
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Section</th>
                      <th>Status</th>
                      <th>Override</th>
                      <th>Arrival Time</th>
                      <th>Face Scan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: "32px",
                            textAlign: "center",
                            color: "var(--ink-faint)",
                          }}
                        >
                          No matching records.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record) => {
                        const canOverride =
                          record.status === "PRESENT" ||
                          record.status === "LATE";
                        return (
                          <tr key={record.id}>
                            <td
                              style={{
                                fontSize: "11.5px",
                                color: "var(--ink-faint)",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {record.student.studentId}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {formatDisplayName(
                                record.student.surname,
                                record.student.firstName,
                                record.student.middleInitial,
                              )}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 7px",
                                  background: "var(--sky-4)",
                                  color: "var(--sky-dark)",
                                  borderRadius: "5px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-mono)",
                                  border: "1px solid rgba(14,165,233,.2)",
                                }}
                              >
                                {record.student.section}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status={record.status} />
                            </td>
                            <td>
                              {canOverride ? (
                                <select
                                  value={record.status}
                                  disabled={!!overrideLoading[record.id]}
                                  onChange={(e) =>
                                    handleOverride(record.id, e.target.value)
                                  }
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    fontFamily: "var(--font-mono)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    padding: "3px 6px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    background: "var(--surface2)",
                                    color: "var(--ink)",
                                    cursor: overrideLoading[record.id]
                                      ? "wait"
                                      : "pointer",
                                    opacity: overrideLoading[record.id]
                                      ? 0.5
                                      : 1,
                                  }}
                                >
                                  <option value="PRESENT">PRESENT</option>
                                  <option value="LATE">LATE</option>
                                  <option value="ABSENT">ABSENT</option>
                                </select>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--ink-faint)",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                color: "var(--ink-faint)",
                                fontFamily: "var(--font-mono)",
                                fontSize: "12px",
                              }}
                            >
                              {formatTime(record.arrivalTime)}
                            </td>
                            <td>
                              {record.status !== "PENDING" &&
                              record.status !== "ABSENT" ? (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--green)",
                                  }}
                                >
                                  ✓ Verified
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--ink-faint)",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "60px 0" }}>
              <h3>No active session</h3>
              <p>
                Click <strong>▶ Start Attendance</strong> to begin, or{" "}
                <strong>History</strong> to see past records.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default TeacherDashboard;
