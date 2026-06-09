import { useState, useEffect, useRef } from "react";

// Deep-link helper for list screens with no separate detail view: scrolls the
// targeted row into view and briefly highlights it. One-shot per focusId.
//
// Usage:
//   const { rowRef, highlightId } = useFocusRow(focusId, items !== null);
//   <div ref={rowRef(item.id)} style={{ ...(highlightId === item.id ? FOCUS_HL : null) }} />
export function useFocusRow(focusId, ready) {
  const refs = useRef({});
  const consumed = useRef(null);
  const [highlightId, setHighlightId] = useState(null);

  const rowRef = (id) => (el) => { if (el) refs.current[id] = el; else delete refs.current[id]; };

  useEffect(() => {
    if (!focusId || !ready || consumed.current === focusId) return;
    const el = refs.current[focusId];
    if (!el) return;                      // row not present (e.g. filtered out) — leave it
    consumed.current = focusId;
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* non-DOM env */ }
    setHighlightId(focusId);
    const t = setTimeout(() => setHighlightId(null), 2400);
    return () => clearTimeout(t);
  }, [focusId, ready]);

  return { rowRef, highlightId };
}

export const FOCUS_HL = { outline: "2px solid #e07b39", outlineOffset: 2 };
