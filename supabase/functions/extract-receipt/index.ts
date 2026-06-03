// SITE1 — Receipt / document extraction Edge Function
// Takes a public file URL (image or PDF), sends it to Claude, and returns
// structured commercial data for human review. Never auto-saves.
//
// Deploy:  supabase functions deploy extract-receipt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

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
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const PROMPT = `You are reading a construction-business receipt, invoice, or quote.
Extract these fields and respond with ONLY a JSON object, no prose:
{
  "vendor": string | null,        // supplier/business name
  "amount": number | null,        // GST-inclusive grand total, digits only
  "gst": number | null,           // GST/tax amount if shown
  "date": string | null,          // document date as YYYY-MM-DD
  "ref": string | null,           // invoice/receipt/order number if shown
  "description": string | null    // 3-8 word summary of what was purchased
}
Australian receipts: GST is usually 10%. If a field is not visible, use null.
Return strictly valid JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  let imageUrl: string;
  try {
    ({ imageUrl } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!imageUrl) return json({ error: "imageUrl required" }, 400);

  // Fetch the uploaded file
  const fileRes = await fetch(imageUrl);
  if (!fileRes.ok) return json({ error: `Could not fetch file (${fileRes.status})` }, 400);
  const contentType = fileRes.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const b64 = bytesToBase64(bytes);

  const isPdf = contentType.includes("pdf") || imageUrl.toLowerCase().endsWith(".pdf");
  const docBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: contentType.startsWith("image/") ? contentType : "image/jpeg", data: b64 } };

  // Call Claude
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: [docBlock, { type: "text", text: PROMPT }] }],
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: "Claude request failed", detail }, 502);
  }

  const ai = await aiRes.json();
  const text = ai?.content?.find((c: { type: string }) => c.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "Could not parse extraction", raw: text }, 422);

  try {
    return json({ data: JSON.parse(match[0]) });
  } catch {
    return json({ error: "Invalid JSON from model", raw: text }, 422);
  }
});
