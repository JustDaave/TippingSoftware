import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let client: SupabaseClient | null = null;

// Privileged client. Server-only: the secret key must never reach the browser.
export function db(): SupabaseClient {
  if (!client) {
    const { url, secretKey } = supabaseEnv();
    client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
