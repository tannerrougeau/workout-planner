import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase project for the community hub. These values are public by design: the anon key
 * only allows what the database's row level security permits. Override with VITE_* env vars.
 */
export const HUB_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL ?? "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "",
};

export const hubConfigured = Boolean(HUB_CONFIG.url && HUB_CONFIG.anonKey);

export const supabase: SupabaseClient | undefined = hubConfigured
  ? createClient(HUB_CONFIG.url, HUB_CONFIG.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } })
  : undefined;

export function db(): SupabaseClient {
  if (!supabase) throw new Error("The hub isn't set up yet.");
  return supabase;
}
