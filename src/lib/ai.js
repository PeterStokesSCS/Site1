import { supabase } from "./supabase";

// Calls the extract-receipt Edge Function. Returns { data } with
// { vendor, amount, gst, date, ref, description } for human review.
export async function extractReceipt(imageUrl) {
  const { data, error } = await supabase.functions.invoke("extract-receipt", {
    body: { imageUrl },
  });

  if (error) {
    // FunctionsHttpError carries the function's response body in error.context
    try {
      const body = await error.context.json();
      const detail = typeof body.detail === "string" ? body.detail : body.detail ? JSON.stringify(body.detail) : "";
      const msg = [body.error, detail].filter(Boolean).join(" — ").slice(0, 400);
      return { error: { message: msg || error.message } };
    } catch {
      return { error: { message: error.message } };
    }
  }

  if (data?.error) return { error: { message: data.error } };
  return { data: data?.data || null };
}
