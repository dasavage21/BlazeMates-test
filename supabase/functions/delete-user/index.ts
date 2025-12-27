import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

interface DeleteUserRequestBody {
  userId?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    const [scheme, token] = authHeader.split(" ");
    if (!token || scheme?.toLowerCase() !== "bearer") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid bearer token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let payload: DeleteUserRequestBody;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: tokenUser, error: tokenError } = await supabase.auth.getUser(token);
    if (tokenError || !tokenUser?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid access token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bodyUserId = payload.userId?.trim();
    const targetUserId = bodyUserId ?? tokenUser.user.id;

    if (!isUuid(targetUserId)) {
      return new Response(
        JSON.stringify({ error: "Invalid userId format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (targetUserId !== tokenUser.user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authError && !authError.message?.toLowerCase().includes("user not found")) {
      return new Response(
        JSON.stringify({ error: `Auth delete failed: ${authError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: userRowError } = await supabase.from("users").delete().eq("id", targetUserId);
    if (userRowError) {
      return new Response(
        JSON.stringify({ error: `Users delete failed: ${userRowError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const storagePaths = [
      `${targetUserId}/avatar.jpg`,
      `avatars/${targetUserId}/avatar.jpg`,
    ];
    const { error: storageError } = await supabase.storage.from("avatars").remove(storagePaths);
    if (storageError && !storageError.message?.toLowerCase().includes("not found")) {
      console.warn("Avatar cleanup warning:", storageError.message);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Delete user error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});