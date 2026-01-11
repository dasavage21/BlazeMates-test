import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import Stripe from "npm:stripe@17.5.0";

interface CreateCheckoutSessionBody {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  try {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    console.log("[Edge Function] Environment variables check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasStripeKey: !!stripeSecretKey,
    });

    if (!supabaseUrl || !serviceKey || !stripeSecretKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Internal server error - missing configuration" }),
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
      console.error("[Edge Function] Auth error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid access token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let payload: CreateCheckoutSessionBody;
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

    console.log("[Edge Function] Received payload:", payload);

    if (!payload.priceId || !payload.successUrl || !payload.cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: priceId, successUrl, cancelUrl" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    console.log("[Edge Function] Checking for existing subscription...");

    // Check if user has an existing active subscription
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("subscription_status, subscription_tier, stripe_customer_id, stripe_subscription_id")
      .eq("id", tokenUser.user.id)
      .maybeSingle();

    if (userError) {
      console.error("[Edge Function] Error fetching user data:", userError);
    }

    console.log("[Edge Function] User subscription data:", userData);

    // If user has an active subscription, cancel it before creating new one
    if (userData?.subscription_status === "active" && userData?.stripe_subscription_id) {
      console.log("[Edge Function] Canceling existing subscription:", userData.stripe_subscription_id);
      try {
        await stripe.subscriptions.cancel(userData.stripe_subscription_id);
        console.log("[Edge Function] Existing subscription canceled successfully");
      } catch (cancelError: any) {
        console.error("[Edge Function] Error canceling subscription:", cancelError);
        // Continue anyway - the subscription might already be canceled in Stripe
      }
    }

    console.log("[Edge Function] Creating Stripe checkout session...");

    const sessionParams: any = {
      payment_method_types: ["card"],
      line_items: [
        {
          price: payload.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: payload.successUrl,
      cancel_url: payload.cancelUrl,
      metadata: {
        user_id: tokenUser.user.id,
      },
      subscription_data: {
        metadata: {
          user_id: tokenUser.user.id,
        },
      },
    };

    // If user already has a Stripe customer ID, reuse it
    if (userData?.stripe_customer_id) {
      sessionParams.customer = userData.stripe_customer_id;
    } else {
      sessionParams.customer_email = tokenUser.user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("[Edge Function] Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[Edge Function] Create checkout session error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});