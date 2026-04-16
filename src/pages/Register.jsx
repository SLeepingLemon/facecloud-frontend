import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = function (e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    api
      .post("/auth/register", { name, email, password, role })
      .then(function () {
        setSuccess("Account created successfully! You can now sign in.");
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
      })
      .catch(function (err) {
        var msg = err.response
          ? err.response.data.message
          : "Registration failed. Please try again.";
        setError(msg);
        setLoading(false);
      });
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: "480px" }}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-badge">🎓</div>
          <span className="auth-logo-name">FaceCloud</span>
        </div>

        {/* Header */}
        <div className="auth-header">
          <h1 className="auth-title">Create an Account</h1>
          <p className="auth-subtitle">Register as a teacher to get started</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Juan dela Cruz"
              value={name}
              onChange={function (e) {
                setName(e.target.value);
              }}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. juan@pup.edu.ph"
              value={email}
              onChange={function (e) {
                setEmail(e.target.value);
              }}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={function (e) {
                setPassword(e.target.value);
              }}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={function (e) {
                setConfirmPassword(e.target.value);
              }}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              value={role}
              onChange={function (e) {
                setRole(e.target.value);
              }}
              required
              disabled={loading}
            >
              <option value="TEACHER">Teacher</option>
            </select>
            <p className="form-help">
              Only teachers can self-register. Contact an administrator for
              admin access.
            </p>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="auth-link">
          Already have an account? <Link to="/">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
