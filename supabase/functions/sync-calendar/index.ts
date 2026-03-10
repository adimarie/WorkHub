import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GOOGLE_CALENDAR_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get access token: " + JSON.stringify(data));
  return data.access_token;
}

// deno-lint-ignore no-explicit-any
function buildEventBody(appt: any) {
  const start = appt.scheduled_at as string;
  const durationMin = (appt.duration_minutes as number) || appt.services?.duration_minutes || 60;
  const end = new Date(new Date(start).getTime() + durationMin * 60000).toISOString();

  const clientName = appt.clients?.full_name as string | undefined;
  const serviceName = appt.services?.name as string | undefined;
  const notes = appt.notes as string | undefined;

  return {
    summary: [serviceName, clientName ? `w/ ${clientName}` : null].filter(Boolean).join(" — "),
    description: [
      notes,
      `\nAppointment ID: ${appt.id}`,
      `Status: ${appt.status}`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: start, timeZone: "America/Los_Angeles" },
    end: { dateTime: end, timeZone: "America/Los_Angeles" },
    status: appt.status === "cancelled" ? "cancelled" : "confirmed",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

    const { action, appointmentId } = await req.json();
    if (!action || !appointmentId) {
      return new Response(JSON.stringify({ error: "action and appointmentId required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
    const accessToken = await getAccessToken();
    const calBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    if (action === "delete") {
      const { data: appt } = await sbAdmin
        .from("appointments")
        .select("google_event_id")
        .eq("id", appointmentId)
        .single();

      if (appt?.google_event_id) {
        await fetch(`${calBase}/${appt.google_event_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        await sbAdmin
          .from("appointments")
          .update({ google_event_id: null, google_meet_link: null })
          .eq("id", appointmentId);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Fetch appointment with joined client and service names
    const { data: appt, error: apptErr } = await sbAdmin
      .from("appointments")
      .select(`
        *,
        clients(full_name),
        services(name, duration_minutes)
      `)
      .eq("id", appointmentId)
      .single();

    if (apptErr || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const eventBody = buildEventBody(appt);

    let googleEventId = appt.google_event_id;
    let meetLink = appt.google_meet_link;
    let calRes: Response;

    if (action === "create" || !googleEventId) {
      calRes = await fetch(calBase, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      });
    } else {
      // upsert / update
      calRes = await fetch(`${calBase}/${googleEventId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      });
    }

    const calData = await calRes.json();
    if (!calRes.ok) {
      return new Response(JSON.stringify({ error: "Calendar API error", details: calData }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    googleEventId = calData.id;
    meetLink = calData.conferenceData?.entryPoints?.find(
      // deno-lint-ignore no-explicit-any
      (e: any) => e.entryPointType === "video"
    )?.uri || null;

    await sbAdmin
      .from("appointments")
      .update({ google_event_id: googleEventId, google_meet_link: meetLink })
      .eq("id", appointmentId);

    return new Response(JSON.stringify({ ok: true, googleEventId, meetLink }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
