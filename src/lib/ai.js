import { supabase } from "./supabase";

// Calls the extract-receipt Edge Function. Returns { data } with
// { vendor, amount, gst, date, ref, description } for human review.
export async function extractReceipt(imageUrl) {
  const { data, error } = await supabase.functions.invoke("extract-receipt", {
    body: { imageUrl },
  });
  if (error) return { error };
  if (data?.error) return { error: { message: data.error } };
  return { data: data?.data || null };
}
