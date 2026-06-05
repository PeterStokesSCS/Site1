// SITE1 — Subbie variation request → SITE1 variation fields (AI conversion).
// Reads an uploaded file (image/PDF) + an optional note and returns structured
// variation fields for the builder to review. Never fabricates; flags low-confidence fields.
//
// Deploy:  supabase functions deploy convert-variation
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (shared with extract-receipt)

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("EXTRACT_MODEL") || "claude-sonnet-4-6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

const PROMPT = `You are helping a builder turn a subcontractor's variation request into a structured record.
You are given the subbie's written note and/or an attached document (quote, photo, email).
Extract these fields and respond with ONLY a JSON object, no prose:
{
  "title": string | null,          // short title (4-8 words) for the variation
  "description": string | null,    // scope of works — what extra work is required
  "reason": string | null,         // why this variation is needed
  "cost": number | null,           // the subbie's quoted cost (ex GST) if a figure is given, digits only
  "eot": boolean,                  // true if extra time / delay is mentioned
  "eot_days": number | null,       // number of days claimed, if stated
  "eot_description": string | null,// basis for the time extension, if stated
  "flags": string[]               // names of any fields you could NOT confidently determine
}
Rules: Do not invent figures or scope that are not present. If unsure about a field, set it to null AND add its name to "flags". Australian construction context. Return strictly valid JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  let fileUrl: string | undefined, note: string | undefined;
  try { ({ fileUrl, note } = await req.json()); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!fileUrl && !note) return json({ error: "fileUrl or note required" }, 400);

  const content: unknown[] = [];

  // Attach the file if present.
  if (fileUrl) {
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return json({ error: `Could not fetch file (${fileRes.status})` }, 400);
    const contentType = fileRes.headers.get("content-type") || "image/jpeg";
    const b64 = bytesToBase64(new Uint8Array(await fileRes.arrayBuffer()));
    const isPdf = contentType.includes("pdf") || fileUrl.toLowerCase().endsWith(".pdf");
    content.push(isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: contentType.startsWith("image/") ? contentType : "image/jpeg", data: b64 } });
  }
  content.push({ type: "text", text: `Subcontractor's note:\n${note || "(none provided)"}\n\n${PROMPT}` });

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: "user", content }] }),
  });
  if (!aiRes.ok) return json({ error: "Claude request failed", detail: await aiRes.text() }, 502);

  const ai = await aiRes.json();
  const text = ai?.content?.find((c: { type: string }) => c.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "Could not parse conversion", raw: text }, 422);
  try { return json({ data: JSON.parse(match[0]) }); }
  catch { return json({ error: "Invalid JSON from model", raw: text }, 422); }
});
