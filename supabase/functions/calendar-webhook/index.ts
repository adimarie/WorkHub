import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Receives Google Calendar push notifications — no JWT required
// Syncs external calendar changes (reschedules, cancellations) back to Supabase

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state, x-goog-message-number",
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
  if (!data.access_token) throw new Error("Failed to get access token");
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Google sends a sync notification first — acknowledge immediately
  const resourceState = req.headers.get("x-goog-resource-state");
  if (resourceState === "sync") {
    return new Response("ok", { status: 200, headers: CORS });
  }

  try {
    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
    const accessToken = await getAccessToken();

    // Fetch events modified in the last 2 minutes to find what changed
    const updatedMin = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    eventsUrl.searchParams.set("updatedMin", updatedMin);
    eventsUrl.searchParams.set("singleEvents", "true");
    eventsUrl.searchParams.set("maxResults", "20");

    const eventsRes = await fetch(eventsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const eventsData = await eventsRes.json();

    if (!eventsRes.ok || !eventsData.items) {
      return new Response("ok", { status: 200, headers: CORS });
    }

    for (const event of eventsData.items) {
      const { data: appt } = await sbAdmin
        .from("appointments")
        .select("id, scheduled_at, status, google_event_id")
        .eq("google_event_id", event.id)
        .single();

      if (!appt) continue;

      const updates: Record<string, unknown> = {};

      if (event.start?.dateTime) {
        const newStart = new Date(event.start.dateTime).toISOString();
        if (newStart !== appt.scheduled_at) {
          updates.scheduled_at = newStart;
        }
      }

      if (event.status === "cancelled" && appt.status !== "cancelled") {
        updates.status = "cancelled";
      }

      if (Object.keys(updates).length > 0) {
        await sbAdmin.from("appointments").update(updates).eq("id", appt.id);
      }
    }

    return new Response("ok", { status: 200, headers: CORS });
  } catch (err) {
    console.error("calendar-webhook error:", err);
    // Always 200 — never let Google retry-flood us
    return new Response("ok", { status: 200, headers: CORS });
  }
});
