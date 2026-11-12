import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const allowedOrigin = Deno.env.get("CLINIC_APP_ORIGIN")?.replace(/\/$/, "");

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = allowedOrigin && origin === allowedOrigin ? allowedOrigin : "";
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] || character);
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });
  if (!allowedOrigin) return json(req, 500, { error: "CLINIC_APP_ORIGIN is not configured" });
  if ((req.headers.get("Origin") || "") !== allowedOrigin) {
    return json(req, 403, { error: "Origin not allowed" });
  }

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (contentLength > 16_384) return json(req, 413, { error: "Request too large" });

  let body: Record<string, unknown>;
  try {
    const parsedBody = await req.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return json(req, 400, { error: "Invalid request body" });
    }
    body = parsedBody as Record<string, unknown>;
  } catch {
    return json(req, 400, { error: "Invalid request body" });
  }

  const fullName = text(body.p_full_name, 100);
  const phone = text(body.p_phone, 30);
  const apptAt = text(body.p_appt_at, 50);
  const reason = text(body.p_reason, 500);
  const doctor = text(body.p_doctor, 100);
  const location = text(body.p_location, 100);
  const appointmentDate = apptAt ? new Date(apptAt) : null;
  if (!fullName || !phone || !reason || !doctor || !location || !appointmentDate || Number.isNaN(appointmentDate.getTime())) {
    return json(req, 400, { error: "Please provide valid appointment details" });
  }
  if (appointmentDate <= new Date()) return json(req, 400, { error: "Appointment time must be in the future" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json(req, 500, { error: "Server configuration is incomplete" });

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("book_appointment", {
    p_full_name: fullName,
    p_phone: phone,
    p_appt_at: appointmentDate.toISOString(),
    p_reason: reason,
    p_doctor: doctor,
    p_location: location,
  });
  if (error) {
    console.error("Appointment booking failed:", error.message);
    return json(req, 400, { error: error.message });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const notificationEmail = Deno.env.get("APPOINTMENT_NOTIFICATION_EMAIL");
  const fromEmail = Deno.env.get("APPOINTMENT_FROM_EMAIL");
  if (!resendApiKey || !notificationEmail || !fromEmail) {
    console.error("Appointment email settings are incomplete");
    return json(req, 200, { booking_code: data?.booking_code, notification_sent: false });
  }

  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(appointmentDate);
  const bookingCode = text(data?.booking_code, 30) || "Not available";
  const details = [
    ["Booking ID", bookingCode],
    ["Patient", fullName],
    ["Phone", phone],
    ["Date and time", dateLabel],
    ["Location", location],
    ["Doctor", doctor],
    ["Reason", reason],
  ];
  const html = `<h2>New appointment booking</h2><table>${details.map(([label, value]) =>
    `<tr><th align="left" style="padding:6px 12px 6px 0">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`
  ).join("")}</table>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [notificationEmail],
        subject: `New appointment booking: ${bookingCode}`,
        html,
      }),
    });
    if (!response.ok) {
      console.error("Appointment email delivery failed with status:", response.status);
      return json(req, 200, { booking_code: data?.booking_code, notification_sent: false });
    }
  } catch (error) {
    console.error("Appointment email delivery failed:", error);
    return json(req, 200, { booking_code: data?.booking_code, notification_sent: false });
  }

  return json(req, 200, { booking_code: data?.booking_code, notification_sent: true });
});
