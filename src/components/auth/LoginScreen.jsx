import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { logAudit } from "../../lib/db";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const signIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logAudit("login_failed", { entityType: "auth", detail: { email } });
      setError(error.message === "Invalid login credentials"
        ? "Incorrect email or password."
        : error.message
      );
    } else {
      logAudit("login", { entityType: "auth" });
    }
    setLoading(false);
  };

  const sendReset = async (e) => {
    e.preventDefault();
    if (!email) { setError("Enter your email address first."); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) { setError(error.message); }
    else { setResetSent(true); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0c0c0c",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      fontFamily: "DM Sans, sans-serif",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#f0f0f0",
        }}>
          <span style={{ color: "#e07b39" }}>SITE</span>1
        </div>
        <div style={{ fontSize: 13, color: "#444", letterSpacing: 1, marginTop: 4 }}>
          BUILT FOR SITE
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 380,
        background: "#141414",
        border: "1px solid #1e1e1e",
        borderRadius: 16,
        padding: "28px 24px",
      }}>
        {!showReset ? (
          <>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 20 }}>
              SIGN IN
            </div>

            <form onSubmit={signIn}>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  style={inp}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={inp}
                />
              </div>

              {error && (
                <div style={{
                  background: "#2a0c0c",
                  border: "1px solid #ef444444",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#ef4444",
                  marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                style={{
                  width: "100%",
                  padding: "15px",
                  borderRadius: 10,
                  border: "none",
                  background: loading || !email || !password ? "#222" : "#e07b39",
                  color: loading || !email || !password ? "#555" : "#fff",
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: 18,
                  letterSpacing: 1,
                  cursor: loading || !email || !password ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "SIGNING IN..." : "SIGN IN"}
              </button>
            </form>

            <button
              onClick={() => { setShowReset(true); setError(null); }}
              style={{
                display: "block",
                margin: "16px auto 0",
                background: "none",
                border: "none",
                color: "#555",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Forgot password?
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 }}>
              RESET PASSWORD
            </div>

            {resetSent ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <div style={{ fontSize: 15, color: "#ccc", marginBottom: 6 }}>Check your email</div>
                <div style={{ fontSize: 13, color: "#555" }}>A reset link has been sent to {email}</div>
                <button onClick={() => { setShowReset(false); setResetSent(false); }} style={{ marginTop: 20, background: "none", border: "none", color: "#e07b39", fontSize: 14, cursor: "pointer" }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={sendReset}>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                  Enter your email and we'll send a reset link.
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
                </div>
                {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#e07b39", color: "#fff", fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, cursor: "pointer" }}>
                  {loading ? "SENDING..." : "SEND RESET LINK"}
                </button>
                <button type="button" onClick={() => { setShowReset(false); setError(null); }} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer" }}>
                  Back to sign in
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: "#333", textAlign: "center" }}>
        SCS Builders · Authorised users only
      </div>
    </div>
  );
}

const lbl = {
  display: "block",
  fontSize: 11,
  color: "#555",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontFamily: "Barlow Condensed, sans-serif",
  marginBottom: 6,
};

const inp = {
  width: "100%",
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  color: "#f0f0f0",
  fontSize: 16,
  padding: "12px 14px",
  fontFamily: "DM Sans, sans-serif",
  boxSizing: "border-box",
  outline: "none",
};
