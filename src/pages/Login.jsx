import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import api from "../services/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function LoginForm() {
  const navigate = useNavigate();
  const [error,         setError]         = useState("");
  const [notRegistered, setNotRegistered] = useState(null);
  const [loading,       setLoading]       = useState(false);

  const handleLoginSuccess = useCallback((data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role",  data.role);
    localStorage.setItem("name",  data.name);
    if (data.role === "ADMIN")        navigate("/admin/AdminDashboard");
    else if (data.role === "TEACHER") navigate("/teacher/TeacherDashboard");
    else setError("Unknown role. Contact your administrator.");
  }, [navigate]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true); setError(""); setNotRegistered(null);
    try {
      const { data } = await api.post("/auth/google", { credential: credentialResponse.credential });
      handleLoginSuccess(data);
    } catch (err) {
      const status  = err.response?.status;
      const resData = err.response?.data;
      if (status === 403) setNotRegistered({ email: resData?.email || "" });
      else setError(resData?.message || "Google sign-in failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleGoogleError = () => setError("Google sign-in was cancelled or failed. Please try again.");

  const card = { background:"#fff", borderRadius:"16px", boxShadow:"0 4px 40px rgba(14,165,233,0.15),0 1px 8px rgba(0,0,0,0.08)", padding:"44px 40px", width:"100%", maxWidth:"400px", position:"relative", overflow:"hidden" };
  const font = { fontFamily:"Inter,system-ui,sans-serif" };

  return (
    <div style={card}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:"3px", background:"linear-gradient(90deg,#0ea5e9,#38bdf8,#7dd3fc)" }} />

      <div style={{ textAlign:"center", marginBottom:"32px" }}>
        <div style={{ width:"60px",height:"60px",borderRadius:"14px",background:"linear-gradient(135deg,#0284c7,#0ea5e9)",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",boxShadow:"0 4px 16px rgba(14,165,233,0.35)" }}>🎓</div>
        <h1 style={{ fontSize:"22px",fontWeight:800,color:"#0f172a",letterSpacing:"-0.02em",margin:"0 0 6px",...font }}>FaceCloud</h1>
        <p style={{ fontSize:"12.5px",color:"#64748b",margin:0,letterSpacing:"0.02em",...font }}>PUP Computer Engineering · Attendance System</p>
      </div>

      {notRegistered && (
        <div style={{ background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:"10px",padding:"14px 16px",marginBottom:"20px" }}>
          <div style={{ display:"flex",alignItems:"flex-start",gap:"10px" }}>
            <span style={{ fontSize:"18px",lineHeight:1,flexShrink:0 }}>⚠️</span>
            <div>
              <p style={{ fontSize:"13px",fontWeight:700,color:"#92400e",margin:"0 0 4px",...font }}>No account found</p>
              <p style={{ fontSize:"13px",color:"#78350f",margin:0,lineHeight:1.5,...font }}>
                {notRegistered.email ? <><strong>{notRegistered.email}</strong> is not registered in the system.</> : "Your Google account is not registered in the system."}
                {" "}Please contact your administrator to create an account for you.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:"10px",padding:"11px 14px",fontSize:"13px",color:"#dc2626",marginBottom:"20px",...font }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center",padding:"12px 0 20px",fontSize:"13px",color:"#64748b",...font }}>Signing in…</div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:"12px",alignItems:"center" }}>
          <p style={{ fontSize:"11px",color:"#94a3b8",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:600,...font }}>Sign in with</p>
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} useOneTap={false} theme="outline" size="large" width="320" text="signin_with_google" shape="rectangular" logo_alignment="center" />
        </div>
      )}

      <p style={{ textAlign:"center",fontSize:"12px",color:"#94a3b8",marginTop:"24px",marginBottom:0,lineHeight:1.6,...font }}>
        Don&apos;t have an account?<br />Contact your administrator to register.
      </p>
    </div>
  );
}

function Login() {
  const bg = { minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#0c4a6e 0%,#0369a1 45%,#0284c7 100%)",padding:"20px",position:"relative",overflow:"hidden" };
  const grid = { position:"absolute",inset:0,zIndex:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",backgroundSize:"28px 28px",pointerEvents:"none" };

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div style={bg}>
        <div style={grid} />
        <div style={{ position:"relative",zIndex:1,width:"100%",maxWidth:"400px" }}>
          <LoginForm />
          <p style={{ textAlign:"center",marginTop:"16px",fontSize:"12px",color:"rgba(186,230,253,0.6)",fontFamily:"Inter,system-ui,sans-serif" }}>
            VITE_GOOGLE_CLIENT_ID not set — check your environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div style={bg}>
        <div style={grid} />
        <div style={{ position:"relative",zIndex:1,width:"100%",maxWidth:"400px" }}>
          <LoginForm />
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default Login;