import type { SupabaseClient } from "@supabase/supabase-js";

type UserRowUpdate = {
  name?: string | null;
  bio?: string | null;
  strain?: string | null;
  style?: string | null;
  looking_for?: string | null;
  image_url?: string | null;
  age?: number | null;
};

export async function mergeUserRow(
  supabase: SupabaseClient,
  userId: string,
  values: UserRowUpdate
) {
  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError };
  }

  if (existing) {
    return supabase.from("users").update(values).eq("id", userId);
  }

  return supabase.from("users").insert([{ id: userId, ...values }]);
}
