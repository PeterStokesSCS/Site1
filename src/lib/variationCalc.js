// Variation cost maths — pure functions, shared by the form, list and (later) PDF.
// Line item shape:
//   { id, description, mode: "margin"|"direct", cost, margin_pct, client_amount, gst_exempt }
//   margin mode → client = cost × (1 + margin_pct/100)
//   direct mode → builder enters client_amount; margin = client_amount − cost

export const GST_RATE = 0.10;

export function emptyLine() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, description: "", mode: "margin", cost: "", margin_pct: "", client_amount: "", gst_exempt: false };
}

export function lineClient(li) {
  const cost = Number(li.cost) || 0;
  if (li.mode === "margin") {
    const m = Number(li.margin_pct) || 0;
    return Math.round(cost * (1 + m / 100) * 100) / 100;
  }
  return Number(li.client_amount) || 0;
}

export function lineCost(li) { return Number(li.cost) || 0; }

// Roll a set of line items up into the full money breakdown.
export function computeTotals(lines = []) {
  let subtotal = 0, gst = 0, builderCost = 0;
  for (const li of lines) {
    const client = lineClient(li);
    subtotal += client;
    builderCost += lineCost(li);
    if (!li.gst_exempt) gst += client * GST_RATE;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  gst = Math.round(gst * 100) / 100;
  builderCost = Math.round(builderCost * 100) / 100;
  return {
    subtotal,
    gst,
    total: Math.round((subtotal + gst) * 100) / 100,
    builderCost,
    margin: Math.round((subtotal - builderCost) * 100) / 100,
    marginPct: builderCost > 0 ? Math.round(((subtotal - builderCost) / builderCost) * 1000) / 10 : 0,
  };
}

export const money = (n) => (n || n === 0) ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

// The next sequential variation ref for a project, e.g. SCS-017-V03.
export function nextRef(jobNumber, existingCount) {
  const base = jobNumber || "VAR";
  return `${base}-V${String((existingCount || 0) + 1).padStart(2, "0")}`;
}

// Append an immutable audit event.
export function pushAudit(trail, event, by, notes) {
  return [...(trail || []), { event, by: by || null, at: new Date().toISOString(), ...(notes ? { notes } : {}) }];
}

// Original contract + approved variations to date (uses total_inc_gst, falling back to amount).
export function approvedVariationsTotal(variations = []) {
  return variations.filter(v => v.status === "approved").reduce((s, v) => s + (Number(v.total_inc_gst ?? v.amount) || 0), 0);
}
