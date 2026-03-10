# External Services & Integrations

> This file is loaded on-demand. Referenced from CLAUDE.md.
> Each section is added by the setup wizard when a service is configured.

## API Cost Accounting (REQUIRED)

**Every feature that makes external API calls MUST log usage for cost tracking.**

When building or modifying any feature that calls a paid API, instrument it to log each API call with its cost data.

## Configured Services

### Supabase (Core)
- **Project:** wdecjlrfulsdklqeetqb (us-west-2)
- **Dashboard:** https://supabase.com/dashboard/project/wdecjlrfulsdklqeetqb
- **Storage buckets:** `media` (public), `documents` (private)
- **Webhook base URL:** `https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/`
- **Pre-constructed webhook URLs:**
  - Telnyx: `https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/telnyx-webhook`
  - SignWell: `https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/signwell-webhook`
  - Square: `https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/square-webhook`
  - Stripe: `https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/stripe-webhook`
  - Resend inbound: `https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/resend-inbound-webhook`

### Email (Resend) ✅
- **From:** `notifications@bodyworkandbotanicals.com` (display: "Workhub")
- **Secrets:** `RESEND_API_KEY`, `FROM_EMAIL` (stored in Supabase)
- **Edge function:** `send-email` — POST `{ to, subject, html, text?, replyTo?, cc? }`
- **Client module:** `shared/email-service.js` — `sendEmail(opts)` + `emailTemplates.*`
- **Templates:** `appointmentConfirmation`, `intakeFormInvitation`, `notification`
- **Free tier:** 3,000 emails/month
- **Dashboard:** https://resend.com/emails

### SMS (Telnyx)
- Config in `telnyx_config` table
- Edge functions: `send-sms`, `telnyx-webhook` (deploy with `--no-verify-jwt`)
- Cost: ~$0.004/message

### Payments (Square)
- Config in `square_config` table
- Edge function: `process-square-payment`
- Cost: 2.9% + 30c

### Payments + ACH (Stripe)
- Config in `stripe_config` table
- ACH: 0.8% capped at $5; Cards: 2.9% + 30c

### E-Signatures (SignWell)
- Config in `signwell_config` table
- Edge function: `signwell-webhook` (deploy with `--no-verify-jwt`)
- Free tier: 3-25 docs/month

### AI Features (Google Gemini) ✅
- **Model:** `gemini-2.0-flash` (default)
- **Secret:** `GEMINI_API_KEY` (stored in Supabase)
- **Edge function:** `gemini` — POST `{ prompt, systemPrompt?, model?, temperature?, maxTokens? }`
- **Client module:** `shared/ai-service.js` — `ai(prompt, opts?)` + `aiHelpers.*`
- **Practice helpers:** `draftMessage`, `summarizeNotes`, `suggestIntakeQuestions`, `writeServiceDescription`
- **System context:** pre-loaded with somatic/ceremonial practice persona
- **Free tier:** 1,500 req/day, 15 RPM (Gemini 2.0 Flash)
- **Dashboard:** https://aistudio.google.com/

### Object Storage (Cloudflare R2)
- Free tier: 10 GB storage, 10M reads/mo, 1M writes/mo, zero egress

### Google Calendar CRM ✅
- **Calendar ID:** `adimarie@bodyworkandbotanicals.com`
- **OAuth Client:** `781824716968-fdag0d6qdg620ovn65oc6lm5449ruof2.apps.googleusercontent.com` (Workhub)
- **Secrets (Supabase):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`
- **Edge functions:**
  - `sync-calendar` (JWT required) — create/update/delete Google Calendar events from appointments
  - `calendar-webhook` (no-verify-jwt) — receive Google push notifications, sync changes back to Supabase
- **Client module:** `shared/calendar-service.js` — `calendarService.sync(apptId)`, `.remove(apptId)`
- **Push channel:** ID `workhub-cal-channel-1`, resource `1G_3vEW5CTsD07sA_78IBbYOA_c`
- **⚠️ Channel expires: ~March 17, 2026** — re-run watch registration before then:
  ```bash
  # Get access token first, then:
  curl -X POST "https://www.googleapis.com/calendar/v3/calendars/adimarie%40bodyworkandbotanicals.com/events/watch" \
    -H "Authorization: Bearer ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"id":"workhub-cal-channel-2","type":"web_hook","address":"https://wdecjlrfulsdklqeetqb.supabase.co/functions/v1/calendar-webhook"}'
  ```
  (Increment channel ID each renewal — Google rejects reuse of an active channel ID)

<!-- Only the services you selected during setup will be active -->
