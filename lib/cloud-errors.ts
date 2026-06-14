export function cloudErrorMessage(error: unknown, action: "save" | "load" | "setup" | "login"): string {
  const fallback = `Cloud ${action} failed.`;
  const detail = errorDetail(error, fallback);
  const lower = detail.toLowerCase();

  if (lower.includes("supabase is not configured")) {
    return "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the deployed app environment.";
  }
  if (lower.includes("relation") && lower.includes("does not exist")) {
    return `Supabase schema is incomplete: ${detail}. Run SUPABASE_SETUP.md in the Supabase SQL Editor.`;
  }
  if (lower.includes("schema cache") || lower.includes("could not find the table")) {
    return `Supabase cannot find the required table: ${detail}. Run SUPABASE_SETUP.md and redeploy/retry.`;
  }
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("violates row-level security")) {
    return `Supabase RLS blocked this ${action}. Confirm the household policies and that the user is logged in. Detail: ${detail}`;
  }
  if (lower.includes("jwt") || lower.includes("auth") || lower.includes("session")) {
    return `Cloud authentication is not ready. Login again, then retry. Detail: ${detail}`;
  }

  return detail;
}

function errorDetail(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      typeof record.message === "string" ? record.message : "",
      typeof record.code === "string" ? `code ${record.code}` : "",
      typeof record.details === "string" ? record.details : "",
      typeof record.hint === "string" ? `hint: ${record.hint}` : "",
    ].filter(Boolean);

    if (parts.length) return parts.join(" | ");
  }

  return fallback;
}
