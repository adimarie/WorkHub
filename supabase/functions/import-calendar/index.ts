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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Date range: 2 years back → 1 year ahead
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 2);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1);

    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
    const accessToken = await getAccessToken();

    // Fetch all existing google_event_ids already in Supabase
    const { data: existing } = await sbAdmin
      .from("appointments")
      .select("google_event_id")
      .not("google_event_id", "is", null);

    const existingIds = new Set((existing || []).map((r: { google_event_id: string }) => r.google_event_id));

    // Page through Google Calendar events
    let pageToken: string | null = null;
    const toInsert = [];
    let totalFetched = 0;

    do {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      );
      url.searchParams.set("timeMin", timeMin.toISOString());
      url.searchParams.set("timeMax", timeMax.toISOString());
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Google Calendar API error", details: data }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // deno-lint-ignore no-explicit-any
      for (const event of (data.items || []) as any[]) {
        totalFetched++;

        // Skip all-day events (no dateTime) and already-imported events
        if (!event.start?.dateTime) continue;
        if (existingIds.has(event.id)) continue;

        const startAt = new Date(event.start.dateTime);
        const endAt = event.end?.dateTime ? new Date(event.end.dateTime) : null;
        const durationMin = endAt
          ? Math.round((endAt.getTime() - startAt.getTime()) / 60000)
          : 60;

        // Determine status
        let status = "confirmed";
        if (event.status === "cancelled") status = "cancelled";

        // Meet link if present
        const meetLink = event.conferenceData?.entryPoints?.find(
          // deno-lint-ignore no-explicit-any
          (e: any) => e.entryPointType === "video"
        )?.uri || null;

        // Build notes from description + attendees
        const parts = [];
        if (event.description) parts.push(event.description.trim());
        if (event.attendees?.length) {
          const others = event.attendees
            // deno-lint-ignore no-explicit-any
            .filter((a: any) => !a.self)
            // deno-lint-ignore no-explicit-any
            .map((a: any) => a.displayName || a.email)
            .join(", ");
          if (others) parts.push(`Attendees: ${others}`);
        }

        toInsert.push({
          scheduled_at: startAt.toISOString(),
          duration_minutes: durationMin,
          status,
          location: event.location || null,
          notes: parts.length ? parts.join("\n\n") : null,
          google_event_id: event.id,
          google_meet_link: meetLink,
          // Store original title in notes prefix so it's not lost
          // client_id and service_id left null — assign in admin UI
        });

        // Also store the event title in notes
        if (event.summary) {
          const last = toInsert[toInsert.length - 1];
          last.notes = [`[${event.summary}]`, last.notes].filter(Boolean).join("\n\n");
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    // Batch insert in chunks of 100
    let imported = 0;
    const CHUNK = 100;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error } = await sbAdmin.from("appointments").insert(chunk);
      if (error) {
        return new Response(JSON.stringify({ error: "Insert failed", details: error }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      imported += chunk.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      totalFetched,
      skippedAlreadyImported: existingIds.size,
      imported,
      message: `Imported ${imported} events (${totalFetched - imported} skipped: already in Supabase or all-day events)`,
    }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
