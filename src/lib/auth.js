// Auth is now handled by Supabase in App.jsx
// This file is kept for any helper functions needed elsewhere

import { supabase } from "./supabase";

export async function signOut() {
  await supabase.auth.signOut();
}
