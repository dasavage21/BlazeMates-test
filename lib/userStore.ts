import type { SupabaseClient } from "@supabase/supabase-js";

type UserRowUpdate = {
  name?: string | null;
  bio?: string | null;
  strain?: string | null;
  style?: string | null;
  looking_for?: string | null;
  image_url?: string | null;
  age?: number | null;
  username?: string | null;
  preferred_strains?: string[] | null;
  consumption_methods?: string[] | null;
  experience_level?: string | null;
  cultivation_interest?: boolean | null;
  favorite_activities?: string[] | null;
  session_preferences?: string[] | null;
  interests?: string[] | null;
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
    console.error("Error checking existing user:", fetchError);
    return { error: fetchError };
  }

  if (existing) {
    console.log("Updating existing user:", userId);
    const result = await supabase.from("users").update(values).eq("id", userId);
    console.log("Update result:", result);
    return result;
  }

  console.log("Inserting new user:", userId, values);
  const result = await supabase.from("users").insert([{ id: userId, ...values }]);
  console.log("Insert result:", result);
  return result;
}
