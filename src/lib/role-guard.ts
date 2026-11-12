// Server-side role check shared by every command only the older adult's own account may run.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Row security limits *which* rows a caller touches; this limits *who* may act as the older adult.

type Client = SupabaseClient<Database>;

export const ELDER_ONLY_MESSAGE = "Only the person's own account can do this.";

export type ProfileRole = "elder" | "family" | string | null | undefined;

export function assertElder(role: ProfileRole, message: string = ELDER_ONLY_MESSAGE): void {
  if (role !== "elder") throw new Error(message);
}

export async function requireElder(
  sb: Client,
  userId: string,
  message: string = ELDER_ONLY_MESSAGE,
): Promise<void> {
  const { data, error } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  assertElder(data?.role, message);
}
