// Auth is now handled by Supabase in App.jsx
// This file is kept for any helper functions needed elsewhere

import { supabase } from "./supabase";
import { logAudit } from "./db";

// Records the logout while the session is still valid (auth.uid() must resolve), then
// signs out. All sign-out controls route through here so logout is consistently audited.
export async function signOut() {
  await logAudit("logout", { entityType: "auth" });
  await supabase.auth.signOut();
}
