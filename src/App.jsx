import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { signOut } from "./lib/auth";
import LoginScreen      from "./components/auth/LoginScreen";
import BuilderApp       from "./components/builder/BuilderApp";
import SupervisorApp    from "./components/supervisor/SupervisorApp";
import WorkerApp        from "./components/worker/WorkerApp";
import SubcontractorApp from "./components/subcontractor/SubcontractorApp";
import ClientApp        from "./components/client/ClientApp";
import OfficeAdminApp   from "./components/office/OfficeAdminApp";
import DevSwitcher      from "./components/shared/DevSwitcher";

const DEV_MODE = new URLSearchParams(window.location.search).has("dev");

function Loading() {
  return (
    <div style={{
      minHeight: "100dvh", background: "#0c0c0c",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        fontFamily: "Barlow Condensed, sans-serif",
        fontSize: 28, fontWeight: 700, letterSpacing: 3,
        textTransform: "uppercase", color: "#333",
        animation: "pulse 1.5s ease-in-out infinite",
      }}>
        <span style={{ color: "#e07b3966" }}>SITE</span>1
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  // Still loading
  if (session === undefined) return <Loading />;

  // Not logged in
  if (!session) return <LoginScreen />;

  // Logged in but profile not loaded yet
  if (!profile) return <Loading />;

  // Dev mode — role override via URL param, but ONLY for real admin accounts.
  // A non-admin can never use ?dev=true to escalate their UI to another role.
  const isAdmin = profile.role === "builder" || profile.role === "office";
  const allowDev = DEV_MODE && isAdmin;
  const roleOverride = allowDev
    ? new URLSearchParams(window.location.search).get("role")
    : null;
  const role = roleOverride || profile.role;

  const user = {
    id: profile.id,
    name: profile.full_name || session.user.email,
    role,
    avatar: (profile.full_name || session.user.email)
      .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
    projectId: profile.project_id,
    email: session.user.email,
  };

  let view;
  switch (role) {
    case "builder":       view = <BuilderApp       user={user} />; break;
    case "supervisor":    view = <SupervisorApp     user={user} />; break;
    case "worker":        view = <WorkerApp         user={user} />; break;
    case "subcontractor": view = <SubcontractorApp  user={user} />; break;
    case "client":        view = <ClientApp         user={user} />; break;
    case "office":        view = <OfficeAdminApp    user={user} />; break;
    default:
      view = (
        <div style={{ minHeight: "100dvh", background: "#0c0c0c", color: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "DM Sans, sans-serif", padding: 20 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, color: "#555" }}>No role assigned</div>
          <div style={{ fontSize: 14, color: "#444", textAlign: "center" }}>Ask your administrator to assign a role to your account.</div>
          <button onClick={() => signOut()} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14 }}>SIGN OUT</button>
        </div>
      );
  }

  return (
    <>
      {view}
      {allowDev && <DevSwitcher />}
    </>
  );
}
