import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";

function formatDisplayName(surname, firstName, middleInitial) {
  if (!surname || !firstName) return "";
  const mi = middleInitial ? ` ${middleInitial.trim().toUpperCase()}.` : "";
  return `${surname.trim().toUpperCase()}, ${firstName.trim()}${mi}`;
}

function Sections({ dark, toggleDark }) {
  const navigate = useNavigate();

  const [students,      setStudents]      = useState([]);
  const [sections,      setSections]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);   // currently selected section name
  const [filter,        setFilter]        = useState("all");  // pill filter
  const [search,        setSearch]        = useState("");
  const [newSection,    setNewSection]    = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionError,  setSectionError]  = useState("");
  const [successMsg,    setSuccessMsg]    = useState("");

  const loadAll = () =>
    Promise.all([api.get("/students"), api.get("/sections")])
      .then(([sRes, secRes]) => {
        setStudents(sRes.data);
        setSections(secRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => { loadAll(); }, []);

  const handleLogout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("name");
    navigate("/");
  };

  const handleAddSection = () => {
    const name = newSection.trim().toUpperCase();
    if (!name) return;
    setSectionError(""); setSuccessMsg(""); setAddingSection(true);
    api.post("/sections", { name })
      .then(() => { setNewSection(""); setSuccessMsg(`✅ Section "${name}" added.`); return loadAll(); })
      .then(() => setAddingSection(false))
      .catch(err => { setSectionError(err.response?.data?.message || "Failed to add section"); setAddingSection(false); });
  };

  const handleDeleteSection = (sectionName) => {
    if (!window.confirm(`Delete section "${sectionName}"?\n\nThis cannot be undone.`)) return;
    setSectionError(""); setSuccessMsg("");
    api.delete(`/sections/${encodeURIComponent(sectionName)}`)
      .then(() => { setSuccessMsg(`Section "${sectionName}" deleted.`); if (selected === sectionName) setSelected(null); return loadAll(); })
      .catch(err => setSectionError(err.response?.data?.message || "Failed to delete section"));
  };

  // Derived data
  const studentsBySection = students.reduce((acc, s) => {
    if (!acc[s.section]) acc[s.section] = [];
    acc[s.section].push(s);
    return acc;
  }, {});

  const activeSections = Object.keys(studentsBySection).sort();
  const allSections = [...sections, ...activeSections.filter(s => !sections.includes(s))].sort();

  const filteredSections = filter === "all" ? allSections : allSections.filter(s => s === filter);

  const selectedStudents = selected ? (studentsBySection[selected] || []).slice().sort((a, b) => a.surname.localeCompare(b.surname)) : [];
  const filteredStudents = selectedStudents.filter(s =>
    formatDisplayName(s.surname, s.firstName, s.middleInitial).toLowerCase().includes(search.toLowerCase()) ||
    (s.studentId || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalStudents = students.length;

  return (
    <div className="dashboard">
      <Sidebar role="ADMIN" dark={dark} onToggleDark={toggleDark} onLogout={handleLogout} />

      <div className="main-area">
        <div className="topbar">
          <span className="tb-title">Sections</span>
          <span className="tb-date">{new Date().toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
        </div>

        <main className="main-content">
          <div className="page-header">
            <div>
              <h1>Sections</h1>
              <p>{allSections.length} sections · {totalStudents} total students</p>
            </div>
          </div>

          {sectionError && <div className="alert alert-error">{sectionError}</div>}
          {successMsg   && <div className="alert alert-success">{successMsg}</div>}

          {/* Add new section */}
          <div className="management-section" style={{ marginBottom: "20px" }}>
            <p className="section-title">Add New Section</p>
            <p className="section-subtitle">New sections become available immediately on the Pi registration script.</p>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                className="form-input"
                style={{ maxWidth: "280px" }}
                placeholder="e.g. BSCPE 4-3"
                value={newSection}
                onChange={e => { setNewSection(e.target.value.toUpperCase()); setSectionError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAddSection()}
              />
              <button className="btn btn-primary" onClick={handleAddSection} disabled={addingSection || !newSection.trim()}>
                {addingSection ? "Adding…" : "+ Add Section"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner" /><p>Loading…</p></div>
          ) : allSections.length === 0 ? (
            <div className="empty-state">
              <h3>No sections yet</h3>
              <p>Add a section above to get started.</p>
            </div>
          ) : (
            <>
              {/* Filter pills */}
              <div className="section-filter-pills">
                <button className={`section-pill${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>All</button>
                {allSections.map(s => (
                  <button key={s} className={`section-pill${filter === s ? " active" : ""}`}
                    onClick={() => { setFilter(s); setSelected(s); setSearch(""); }}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Split layout */}
              <div className="section-layout">
                {/* Section list */}
                <div className="section-list">
                  <div className="section-label" style={{ marginBottom: "4px" }}>Sections</div>
                  {filteredSections.map(s => {
                    const count = studentsBySection[s]?.length || 0;
                    return (
                      <div key={s} className={`section-list-item${selected === s ? " selected" : ""}`}
                        onClick={() => { setSelected(s); setSearch(""); }}>
                        <div className="s-name">{s}</div>
                        <div className="s-meta">{count} student{count !== 1 ? "s" : ""}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Section detail */}
                <div className="section-detail">
                  {!selected ? (
                    <div className="empty-state"><p>Select a section to view details.</p></div>
                  ) : (
                    <>
                      {/* Info card */}
                      <div className="section-detail-card">
                        <div className="section-detail-header">
                          <div className="section-avatar">
                            {selected.replace(/[^A-Z0-9]/g, "").slice(0, 4)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em" }}>{selected}</div>
                            <div style={{ fontSize: "12.5px", color: "var(--ink-faint)" }}>CPE Department</div>
                          </div>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSection(selected)}>🗑 Delete</button>
                        </div>
                        <div className="section-stats-row">
                          {[
                            { label: "Total Students", value: selectedStudents.length },
                            { label: "Regular",        value: selectedStudents.filter(s => s.status === "Regular").length },
                            { label: "Irregular",      value: selectedStudents.filter(s => s.status === "Irregular").length },
                          ].map((stat, i) => (
                            <div key={i} className="section-stat">
                              <div className="section-stat-val">{stat.value}</div>
                              <div className="section-stat-lbl">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Student roster */}
                      <div className="user-management-card" style={{ padding: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Student Roster</span>
                          <input
                            className="form-input"
                            style={{ width: "200px", padding: "6px 10px", fontSize: "12.5px" }}
                            placeholder="Search student…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                        </div>
                        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
                          <table className="data-table">
                            <thead>
                              <tr><th>#</th><th>Student ID</th><th>Name</th><th>Dataset Name</th></tr>
                            </thead>
                            <tbody>
                              {filteredStudents.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--ink-faint)" }}>
                                  {search ? "No students match the search." : "No students in this section yet."}
                                </td></tr>
                              ) : filteredStudents.map((s, i) => (
                                <tr key={s.id}>
                                  <td style={{ color: "var(--ink-faint)", fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>{String(i + 1).padStart(2, "0")}</td>
                                  <td style={{ fontSize: "11.5px", color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>{s.studentId}</td>
                                  <td style={{ fontWeight: 600 }}>{formatDisplayName(s.surname, s.firstName, s.middleInitial)}</td>
                                  <td style={{ fontSize: "12px", color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
                                    {s.datasetName || <span style={{ fontStyle: "italic" }}>not set</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Sections;