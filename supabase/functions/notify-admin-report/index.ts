import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReportNotification {
  report_id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  context?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { report_id, reporter_id, reported_id, reason, context }: ReportNotification = await req.json();

    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "admin@blazemates.com";
    const emailService = Deno.env.get("EMAIL_SERVICE");

    if (!emailService) {
      console.warn("EMAIL_SERVICE not configured. Logging notification instead.");
      console.log("New Report Notification:", {
        report_id,
        reporter_id,
        reported_id,
        reason,
        context,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Report logged (email service not configured)",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailBody = `
      New User Report Submitted
      
      Report ID: ${report_id}
      Reporter ID: ${reporter_id}
      Reported User ID: ${reported_id}
      Reason: ${reason}
      ${context ? `Context: ${context}` : ""}
      
      Time: ${new Date().toISOString()}
      
      Please review this report in the admin dashboard.
    `;

    let emailResult;

    if (emailService === "resend") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      emailResult = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "reports@blazemates.com",
          to: adminEmail,
          subject: "New User Report - Action Required",
          text: emailBody,
        }),
      });
    } else if (emailService === "sendgrid") {
      const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
      emailResult = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sendgridApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: adminEmail }] }],
          from: { email: "reports@blazemates.com" },
          subject: "New User Report - Action Required",
          content: [{ type: "text/plain", value: emailBody }],
        }),
      });
    }

    if (emailResult && !emailResult.ok) {
      throw new Error(`Email service error: ${await emailResult.text()}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin notification sent",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in notify-admin-report:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});