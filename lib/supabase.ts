import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function normalizeSupabaseUrl(value: string): string {
  return value.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export const isSupabaseConfigured = Boolean(rawUrl && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(normalizeSupabaseUrl(rawUrl), publishableKey)
  : null;
