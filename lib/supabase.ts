import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type MonthlySurvivalSupabaseClient = SupabaseClient<any, any, any>;

let runtimeClient: MonthlySurvivalSupabaseClient | null = null;

function normalizeSupabaseUrl(value: string): string {
  return value.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export const isSupabaseConfigured = Boolean(rawUrl && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(normalizeSupabaseUrl(rawUrl), publishableKey) as MonthlySurvivalSupabaseClient
  : null;

export async function getSupabaseClient(): Promise<MonthlySurvivalSupabaseClient | null> {
  if (supabase) return supabase;
  if (runtimeClient) return runtimeClient;
  if (typeof window === "undefined") return null;

  const response = await fetch("/api/public-config", { cache: "no-store" });
  if (!response.ok) return null;
  const config = await response.json() as {
    supabaseUrl?: string;
    publishableKey?: string;
  };

  if (!config.supabaseUrl || !config.publishableKey) return null;
  runtimeClient = createClient(normalizeSupabaseUrl(config.supabaseUrl), config.publishableKey) as MonthlySurvivalSupabaseClient;
  return runtimeClient;
}
