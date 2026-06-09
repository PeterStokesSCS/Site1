// Supabase client factories for the sandbox suite.
//   - adminClient(): SERVICE-ROLE key — BYPASSES RLS. Seed/reset ONLY. Never in the app.
//   - userClient(): ANON key signed in as a real seeded user — RLS IS ENFORCED. This is
//     what the isolation/RBAC tests use, because it reproduces the real attack surface.
//
// All keys come from the environment (.env.test, git-ignored). The service-role key is
// entered only in the terminal — never committed, never pasted into chat.
import "./loadenv.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Seed/reset need the service key; tests only need url+anon (+ a manifest).
export const haveSeedEnv = () => Boolean(url && anon && service);
export const haveTestEnv = () => Boolean(url && anon);

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient() {
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (terminal/.env.test only)");
  return createClient(url, service, noPersist);
}

export async function userClient(email, password) {
  const client = createClient(url, anon, noPersist);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client, user: data.user };
}

export function envSummary() {
  return { url: Boolean(url), anon: Boolean(anon), service: Boolean(service) };
}
