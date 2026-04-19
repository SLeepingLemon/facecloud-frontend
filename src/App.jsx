import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login            from "./pages/Login";
import AdminDashboard   from "./pages/admin/AdminDashboard";
import ManageUsers      from "./pages/admin/ManageUsers";
import ManageClasses    from "./pages/admin/ManageClasses";
import Sections         from "./pages/admin/Sections";
import Reports          from "./pages/admin/Reports";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ProtectedRoute   from "./routes/ProtectedRoute";
import useDarkMode      from "./hooks/useDarkMode";

function App() {
  // useDarkMode applies [data-theme="dark"] to <html> automatically
  const [dark, toggleDark] = useDarkMode();

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />

        {/* Admin */}
        <Route path="/admin/AdminDashboard" element={
          <ProtectedRoute allowedRole="ADMIN">
            <AdminDashboard dark={dark} toggleDark={toggleDark} />
          </ProtectedRoute>
        } />
        <Route path="/admin/manage-users" element={
          <ProtectedRoute allowedRole="ADMIN">
            <ManageUsers dark={dark} toggleDark={toggleDark} />
          </ProtectedRoute>
        } />
        <Route path="/admin/manage-classes" element={
          <ProtectedRoute allowedRole="ADMIN">
            <ManageClasses dark={dark} toggleDark={toggleDark} />
          </ProtectedRoute>
        } />
        <Route path="/admin/sections" element={
          <ProtectedRoute allowedRole="ADMIN">
            <Sections dark={dark} toggleDark={toggleDark} />
          </ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute allowedRole="ADMIN">
            <Reports dark={dark} toggleDark={toggleDark} />
          </ProtectedRoute>
        } />

        {/* Teacher */}
        <Route path="/teacher/TeacherDashboard" element={
          <ProtectedRoute allowedRole="TEACHER">
            <TeacherDashboard dark={dark} toggleDark={toggleDark} />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;