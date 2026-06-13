import { NextResponse } from "next/server";

function normalizeSupabaseUrl(value: string): string {
  return value.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export function GET() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";

  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  return NextResponse.json({
    configured: Boolean(supabaseUrl && publishableKey),
    supabaseUrl: supabaseUrl ? normalizeSupabaseUrl(supabaseUrl) : "",
    publishableKey,
  });
}
