import { useState, useEffect } from "react";
import { getTodayClockIn, clockIn, clockOut } from "../../lib/db";

function fmtTimer(ms) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--:--";
}
function fmtDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// Confirmation modal shown before clocking out — project, user, times, total
function ClockOutModal({ project, userName, clockInIso, onConfirm, onCancel, busy }) {
  const outIso = new Date().toISOString();
  const total = new Date(outIso) - new Date(clockInIso);
  const Row = ({ l, v }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
      <span style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</span>
      <span style={{ fontSize: 14, color: "#ccc" }}>{v}</span>
    </div>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, width: "100%", maxWidth: 380, padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", marginBottom: 14 }}>CLOCK OUT OF THIS SITE?</div>
        <Row l="Project" v={project.street} />
        <Row l="Worker" v={userName} />
        <Row l="Clocked in" v={fmtTime(clockInIso)} />
        <Row l="Clock out" v={fmtTime(outIso)} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 16px" }}>
          <span style={{ fontSize: 12, color: "#555", fontFamily: "Barlow Condensed, sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>Total on site</span>
          <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, color: "#e07b39" }}>{fmtDuration(total)}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 14 }}>CANCEL</button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, letterSpacing: 0.5 }}>{busy ? "…" : "CONFIRM CLOCK OUT"}</button>
        </div>
      </div>
    </div>
  );
}

// Persistent on-site indicator. Tap to clock in (off) or open the clock-out modal (on).
// Calls onChange() after any change so parents can refresh attendance counts/muster.
export default function OnSiteIndicator({ user, project, onChange }) {
  const [ts, setTs] = useState(undefined); // undefined=loading, null=off, row=on
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);

  const load = () => getTodayClockIn(user.id).then(row => setTs(row || null));
  useEffect(() => { load(); }, [user.id]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  if (ts === undefined) return null;

  const onThis = ts && ts.project_id === project.id;
  const onOther = ts && ts.project_id !== project.id;

  const tap = async () => {
    if (busy) return;
    if (onThis) { setModal(true); return; }
    setBusy(true);
    if (onOther) {
      if (window.confirm("You're clocked in on another job. Clock out there and clock in here?")) {
        await clockOut(user.id); await clockIn(user.id, project.id); await load(); onChange?.();
      }
    } else {
      await clockIn(user.id, project.id); await load(); onChange?.();
    }
    setBusy(false);
  };

  const confirmOut = async () => {
    setBusy(true);
    await clockOut(user.id);
    await load();
    setModal(false);
    setBusy(false);
    onChange?.();
  };

  const c = onThis
    ? { fg: "#22c55e", bg: "#06200e", bd: "#166534", label: "ON SITE", extra: fmtTimer(now - new Date(ts.clock_in).getTime()) }
    : onOther
      ? { fg: "#f59e0b", bg: "#251d00", bd: "#92400e", label: "OTHER SITE", extra: "tap" }
      : { fg: "#ef4444", bg: "#2a0c0c", bd: "#7f1d1d", label: "OFF SITE", extra: "tap in" };

  return (
    <>
      <button onClick={tap} disabled={busy} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 14,
        background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
        fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, letterSpacing: 0.5, cursor: "pointer",
        WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap",
      }}>
        <span style={{ fontSize: 8 }}>●</span>
        {c.label}
        <span style={{ opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{c.extra}</span>
      </button>
      {modal && onThis && <ClockOutModal project={project} userName={user.name} clockInIso={ts.clock_in} onConfirm={confirmOut} onCancel={() => setModal(false)} busy={busy} />}
    </>
  );
}
