import { getSupabaseClient } from "./supabase";
import type { FinanceData } from "./types";

export type CloudUser = {
  id: string;
  email?: string;
};

export async function getCurrentCloudUser(): Promise<CloudUser | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function loginOrCreateCloudUser(email: string, password: string): Promise<CloudUser> {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.data.user) {
    return { id: login.data.user.id, email: login.data.user.email ?? undefined };
  }

  const signup = await supabase.auth.signUp({ email, password });
  if (signup.error || !signup.data.user) {
    throw signup.error ?? login.error ?? new Error("Login failed.");
  }
  if (!signup.data.session) {
    throw new Error("Account created. Please confirm email if required, then login again.");
  }

  return { id: signup.data.user.id, email: signup.data.user.email ?? undefined };
}

export async function logoutCloudUser(): Promise<void> {
  const supabase = await getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function ensureHousehold(user: CloudUser): Promise<string> {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const existing = await supabase
    .from("households")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from("households")
    .insert({ name: "Monthly Survival", owner_id: user.id })
    .select("id")
    .single();

  if (created.error || !created.data?.id) throw created.error ?? new Error("Household create failed.");
  const householdId = created.data.id as string;

  const member = await supabase
    .from("household_members")
    .upsert({ household_id: householdId, user_id: user.id, role: "owner" });

  if (member.error) throw member.error;
  return householdId;
}

export async function saveCloudSnapshot(householdId: string, data: FinanceData): Promise<void> {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const user = await getCurrentCloudUser();
  const result = await supabase.from("finance_snapshots").insert({
    household_id: householdId,
    data,
    source: "web",
    created_by: user?.id,
  });
  if (result.error) throw result.error;
}

export async function loadLatestCloudSnapshot(householdId: string): Promise<FinanceData | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase
    .from("finance_snapshots")
    .select("data")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data?.data as FinanceData | undefined) ?? null;
}
