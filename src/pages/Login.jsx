import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import api from "../services/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function LoginForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notRegistered, setNotRegistered] = useState(null); // { email }
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setError("");
    setNotRegistered(null);
  };

  // ── Shared success handler ──
  const handleLoginSuccess = useCallback(
    (data) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      if (data.role === "ADMIN") {
        navigate("/admin/AdminDashboard");
      } else if (data.role === "TEACHER") {
        navigate("/teacher/TeacherDashboard");
      } else {
        setError("Unknown role. Contact your administrator.");
      }
    },
    [navigate],
  );

  // ── Google SSO ──
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    clearMessages();
    try {
      const { data } = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });
      handleLoginSuccess(data);
    } catch (err) {
      const status = err.response?.status;
      const resData = err.response?.data;

      if (status === 403) {
        // Backend confirmed identity but no account exists yet
        setNotRegistered({ email: resData?.email || "" });
      } else {
        setError(
          resData?.message || "Google sign-in failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was cancelled or failed. Please try again.");
  };

  // ── Email + password login ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      handleLoginSuccess(data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "inherit",
    color: "#1a202c",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border 0.15s",
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
        padding: "40px 36px",
        width: "100%",
        maxWidth: "400px",
      }}
    >
      {/* Logo + Title */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#8B0000",
            margin: "0 auto 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
          }}
        >
          🎓
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#1a202c",
            fontFamily: "Georgia, serif",
            margin: "0 0 4px",
          }}
        >
          FaceCloud
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          PUP Computer Engineering · Attendance System
        </p>
      </div>

      {/* ── Not registered banner ── */}
      {notRegistered && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            {/* Warning icon */}
            <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>
              ⚠️
            </span>
            <div>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#92400e",
                  margin: "0 0 4px",
                }}
              >
                No account found
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "#78350f",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {notRegistered.email ? (
                  <>
                    <strong>{notRegistered.email}</strong> is not registered in
                    the system.
                  </>
                ) : (
                  "Your Google account is not registered in the system."
                )}{" "}
                Please contact your administrator to create an account for you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Generic error banner ── */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "#dc2626",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Google SSO ── */}
      {GOOGLE_CLIENT_ID && (
        <>
          <div style={{ marginBottom: "4px" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="outline"
              size="large"
              width="328"
              text="signin_with_google"
              shape="rectangular"
              logo_alignment="left"
            />
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "20px 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            <span
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                whiteSpace: "nowrap",
              }}
            >
              or sign in with email
            </span>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          </div>
        </>
      )}

      {/* ── Email + Password form ── */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <div>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: "5px",
            }}
          >
            Email Address
          </label>
          <input
            type="email"
            placeholder="faculty@pup.edu.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.border = "1px solid #8B0000")}
            onBlur={(e) => (e.target.style.border = "1px solid #e2e8f0")}
            autoComplete="email"
          />
        </div>
        <div>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: "5px",
            }}
          >
            Password
          </label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.border = "1px solid #8B0000")}
            onBlur={(e) => (e.target.style.border = "1px solid #e2e8f0")}
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: loading ? "#e2e8f0" : "#8B0000",
            color: loading ? "#94a3b8" : "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p
        style={{
          textAlign: "center",
          fontSize: "12px",
          color: "#94a3b8",
          marginTop: "20px",
          marginBottom: 0,
        }}
      >
        Don't have an account? Contact your administrator.
      </p>
    </div>
  );
}

function Login() {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #8B0000 0%, #6b0000 50%, #1a0000 100%)",
          padding: "20px",
        }}
      >
        <LoginForm />
      </div>
    );
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #8B0000 0%, #6b0000 50%, #1a0000 100%)",
          padding: "20px",
        }}
      >
        <LoginForm />
      </div>
    </GoogleOAuthProvider>
  );
}

export default Login;
