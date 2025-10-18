// Edge Function: delete-user
// Notes:
// - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (auto-injected).
// - POST JSON: { "userId": "<uuid>" }

import { createClient } from "@supabase/supabase-js";
/// <reference lib="deno.ns" />
interface DeleteUserRequestBody {
  userId?: string;
}

const json = (body: unknown, status = 200, cors = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(cors
        ? {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type, authorization",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          }
        : {}),
    },
  });

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

interface EnvVars {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight if needed
  if (req.method === "OPTIONS") return json({}, 204, true);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, true);

  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") {
    return json({ error: "Missing or invalid bearer token" }, 401, true);
  }

  let payload: DeleteUserRequestBody;
  try {
    payload = await req.json() as DeleteUserRequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400, true);
  }

  const env: EnvVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const supabaseUrl: string | undefined = env.SUPABASE_URL;
  const serviceKey: string | undefined = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration missing" }, 500, true);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: tokenUser, error: tokenError } = await supabase.auth.getUser(token);
  if (tokenError || !tokenUser?.user) {
    return json({ error: "Invalid access token" }, 401, true);
  }

  const bodyUserId = payload.userId?.trim();
  const targetUserId = bodyUserId ?? tokenUser.user.id;

  if (!isUuid(targetUserId)) {
    return json({ error: "Invalid userId format" }, 400, true);
  }

  if (targetUserId !== tokenUser.user.id) {
    return json({ error: "Forbidden" }, 403, true);
  }

  // 1) Delete from Auth
  const { error: authError }: { error: { message: string } | null } = await supabase.auth.admin.deleteUser(targetUserId);
  if (authError && !authError.message?.toLowerCase().includes("user not found")) {
    return json({ error: `Auth delete failed: ${authError.message}` }, 500, true);
  }

  // 2) Delete from profiles (idempotent: ignore "not found")
  const { error: profileError }: { error: { message: string } | null } = await supabase.from("profiles").delete().eq("id", targetUserId);
  if (profileError && !profileError.message?.toLowerCase().includes("row level security")) {
    return json({ error: `Profiles delete failed: ${profileError.message}` }, 500, true);
  }

  const { error: userRowError }: { error: { message: string } | null } = await supabase.from("users").delete().eq("id", targetUserId);
  if (userRowError) {
    return json({ error: `Users delete failed: ${userRowError.message}` }, 500, true);
  }

  const storagePaths = [
    `${targetUserId}/avatar.jpg`,
    `avatars/${targetUserId}/avatar.jpg`,
  ];
  const { error: storageError } = await supabase.storage.from("avatars").remove(storagePaths);
  if (storageError && !storageError.message?.toLowerCase().includes("not found")) {
    console.warn("Avatar cleanup warning:", storageError.message);
  }

  return json({ success: true }, 200, true);
}
