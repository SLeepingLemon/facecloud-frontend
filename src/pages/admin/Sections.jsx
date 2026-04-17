import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function Sections() {
  const navigate = useNavigate();
  const userName = localStorage.getItem("name") || "Admin";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]); // all managed sections from DB
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("all");
  const [newSection, setNewSection] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadAll = () =>
    Promise.all([api.get("/students"), api.get("/sections")])
      .then(([sRes, secRes]) => {
        setStudents(sRes.data);
        setSections(secRes.data); // array of section name strings
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    loadAll();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  const handleAddSection = () => {
    const name = newSection.trim().toUpperCase();
    if (!name) return;
    setSectionError("");
    setSuccessMsg("");
    setAddingSection(true);
    api
      .post("/sections", { name })
      .then(() => {
        setNewSection("");
        setSuccessMsg(`✅ Section "${name}" added successfully.`);
        return loadAll();
      })
      .then(() => setAddingSection(false))
      .catch((err) => {
        setSectionError(err.response?.data?.message || "Failed to add section");
        setAddingSection(false);
      });
  };

  const handleDeleteSection = (sectionName) => {
    if (
      !window.confirm(
        `Delete section "${sectionName}"?\n\nThis cannot be undone.`,
      )
    )
      return;
    setSectionError("");
    setSuccessMsg("");
    api
      .delete(`/sections/${encodeURIComponent(sectionName)}`)
      .then(() => {
        setSuccessMsg(`Section "${sectionName}" deleted.`);
        if (activeSection === sectionName) setActiveSection("all");
        return loadAll();
      })
      .catch((err) =>
        setSectionError(
          err.response?.data?.message || "Failed to delete section",
        ),
      );
  };

  // Group students by their section
  const studentsBySection = students.reduce((acc, s) => {
    if (!acc[s.section]) acc[s.section] = [];
    acc[s.section].push(s);
    return acc;
  }, {});

  // Sections that have students
  const activeSections = Object.keys(studentsBySection).sort();

  // ALL sections to show in pills = DB list + any student sections not in DB
  // This ensures newly added (empty) sections appear as pills immediately
  const allPillSections = [
    ...sections,
    ...activeSections.filter((s) => !sections.includes(s)),
  ].sort();

  // When "All" is selected — show every section (including empty ones)
  // so admins can see and delete them from the table header
  const visibleSections =
    activeSection === "all"
      ? allPillSections
      : allPillSections.filter((s) => s === activeSection);

  const goToImport = () => navigate("/admin/manage-classes", {});

  const inputStyle = {
    flex: 1,
    maxWidth: "320px",
    padding: "9px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: "13px",
    fontFamily: "inherit",
    color: "var(--ink)",
    background: "var(--white)",
    outline: "none",
  };

  const thStyle = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 700,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--ink-muted)",
  };

  return (
    <div className="dashboard">
      {/* ── NAVBAR ── */}
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
            <button className="nav-link active">Sections</button>
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

        {/* ── Page header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 className="page-title" style={{ marginBottom: "4px" }}>
              Sections
            </h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {!loading && (
                <span style={{ color: "var(--ink-faint)" }}>
                  {sections.length} section{sections.length !== 1 ? "s" : ""} ·{" "}
                  {students.length} total students
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={goToImport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "var(--sky)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            📂 Import CSV
          </button>
        </div>

        {/* ── Add Section card ── */}
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: "4px",
            }}
          >
            Add New Section
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--ink-faint)",
              marginBottom: "12px",
            }}
          >
            New sections become available on the Pi immediately. Sections with
            students appear in the list below.
          </p>
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="e.g. BSCPE5-1"
              value={newSection}
              onChange={(e) => {
                setNewSection(e.target.value.toUpperCase());
                setSectionError("");
                setSuccessMsg("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={handleAddSection}
              disabled={addingSection || !newSection.trim()}
              style={{
                padding: "9px 20px",
                background:
                  addingSection || !newSection.trim()
                    ? "var(--border)"
                    : "var(--sky)",
                color:
                  addingSection || !newSection.trim()
                    ? "var(--ink-muted)"
                    : "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: "inherit",
                cursor:
                  addingSection || !newSection.trim()
                    ? "not-allowed"
                    : "pointer",
                transition: "background 0.15s",
              }}
            >
              {addingSection ? "Adding…" : "+ Add Section"}
            </button>
          </div>
          {sectionError && (
            <p style={{ color: "#dc2626", fontSize: "13px", marginTop: "8px" }}>
              {sectionError}
            </p>
          )}
          {successMsg && (
            <p style={{ color: "#16a34a", fontSize: "13px", marginTop: "8px" }}>
              {successMsg}
            </p>
          )}
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: "60px 0" }}>
            <p style={{ color: "var(--ink-faint)" }}>Loading…</p>
          </div>
        ) : (
          <>
            {/* ── Students grouped by section ── */}
            {allPillSections.length === 0 ? (
              <div className="empty-state" style={{ padding: "40px 0" }}>
                <p style={{ fontSize: "16px", marginBottom: "8px" }}>
                  No sections yet.
                </p>
                <p style={{ color: "var(--ink-faint)", fontSize: "13px" }}>
                  Add a section above, then add students via{" "}
                  <button
                    onClick={goToImport}
                    style={{
                      color: "var(--sky)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      padding: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    Import CSV
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                {/* Section filter pills */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "20px",
                    padding: "14px 20px",
                    background: "var(--white)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSection("all")}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "20px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      border:
                        activeSection === "all"
                          ? "none"
                          : "1px solid var(--border)",
                      background:
                        activeSection === "all" ? "var(--sky)" : "var(--white)",
                      color:
                        activeSection === "all" ? "#fff" : "var(--ink-muted)",
                      fontSize: "13px",
                      fontWeight: activeSection === "all" ? 700 : 500,
                    }}
                  >
                    All{" "}
                    <span
                      style={{
                        marginLeft: "4px",
                        fontSize: "11px",
                        opacity: 0.8,
                      }}
                    >
                      {students.length}
                    </span>
                  </button>
                  {allPillSections.map((sec) => {
                    const isActive = activeSection === sec;
                    const count = studentsBySection[sec]?.length || 0;
                    const isEmpty = count === 0;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => !isEmpty && setActiveSection(sec)}
                        style={{
                          padding: "6px 16px",
                          borderRadius: "20px",
                          fontFamily: "inherit",
                          cursor: isEmpty ? "default" : "pointer",
                          border: isActive ? "none" : "1px solid var(--border)",
                          background: isActive
                            ? "var(--sky)"
                            : isEmpty
                              ? "var(--sky-5)"
                              : "var(--white)",
                          color: isActive
                            ? "#fff"
                            : isEmpty
                              ? "var(--ink-faint)"
                              : "var(--ink-muted)",
                          fontSize: "13px",
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        {sec}
                        <span
                          style={{
                            marginLeft: "4px",
                            fontSize: "11px",
                            opacity: 0.8,
                          }}
                        >
                          {isEmpty ? "empty" : count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Section tables */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "28px",
                  }}
                >
                  {visibleSections.map((section) => {
                    const sectionStudents = (studentsBySection[section] || [])
                      .slice()
                      .sort((a, b) => a.surname.localeCompare(b.surname));
                    return (
                      <div
                        key={section}
                        style={{
                          background: "var(--white)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-lg)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 24px",
                            background: "var(--sky-5)",
                            borderBottom: "1px solid rgba(14,165,233,0.25)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "14px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "17px",
                                fontWeight: 700,
                                color: "var(--sky)",
                                fontFamily: "var(--font-heading)",
                              }}
                            >
                              {section}
                            </span>
                            <span
                              style={{
                                fontSize: "13px",
                                color: "var(--ink-muted)",
                                background: "var(--white)",
                                border: "1px solid var(--border)",
                                borderRadius: "20px",
                                padding: "2px 12px",
                                fontWeight: 500,
                              }}
                            >
                              {sectionStudents.length} student
                              {sectionStudents.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(section)}
                            style={{
                              padding: "5px 14px",
                              background: "none",
                              border: "1px solid #fca5a5",
                              borderRadius: "var(--radius-sm)",
                              color: "#dc2626",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            🗑 Delete Section
                          </button>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "13px",
                            }}
                          >
                            <thead>
                              <tr
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                <th
                                  style={{
                                    ...thStyle,
                                    padding: "10px 12px 10px 24px",
                                    width: "48px",
                                  }}
                                >
                                  #
                                </th>
                                <th style={thStyle}>Student ID</th>
                                <th style={thStyle}>Name</th>
                                <th
                                  style={{
                                    ...thStyle,
                                    padding: "10px 24px 10px 12px",
                                  }}
                                >
                                  Dataset Name
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectionStudents.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    style={{
                                      padding: "24px",
                                      textAlign: "center",
                                      color: "var(--ink-faint)",
                                      fontSize: "13px",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    No students in this section yet.
                                  </td>
                                </tr>
                              ) : (
                                sectionStudents.map((s, idx) => (
                                  <tr
                                    key={s.id}
                                    style={{
                                      borderBottom: "1px solid var(--border)",
                                    }}
                                  >
                                    <td
                                      style={{
                                        padding: "10px 12px 10px 24px",
                                        color: "var(--ink-faint)",
                                        fontSize: "12px",
                                      }}
                                    >
                                      {idx + 1}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 12px",
                                        fontFamily: "monospace",
                                        fontSize: "12px",
                                        color: "var(--ink-muted)",
                                      }}
                                    >
                                      {s.studentId}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 12px",
                                        fontWeight: 500,
                                        color: "var(--ink)",
                                      }}
                                    >
                                      {formatDisplayName(
                                        s.surname,
                                        s.firstName,
                                        s.middleInitial,
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 24px 10px 12px",
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
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Sections;
