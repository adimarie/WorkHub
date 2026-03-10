# Workhub — Build Summary

**Project:** The Animist Apothecary — Transformational Practice Management
**Practitioner:** Adi Marie
**Location:** Topanga Canyon, Los Angeles, California
**Built:** March 2026
**Live site:** https://adimarie.github.io/WorkHub/
**GitHub repo:** https://github.com/adimarie/WorkHub
**Supabase project:** https://supabase.com/dashboard/project/wdecjlrfulsdklqeetqb

---

## Infrastructure

### GitHub Pages ✅
- Repo: `adimarie/WorkHub` (public)
- Deploys from `main` branch, root `/`
- CI auto-bumps version on every push (see `version.json`)
- Never bump version locally — CI handles it

### Tailwind CSS v4 ✅
- Config: `styles/tailwind.css` (CSS-first, no `tailwind.config.js`)
- Output: `styles/tailwind.out.css` (committed — GitHub Pages has no build step)
- Scripts: `npm run css:build` / `npm run css:watch`
- Design tokens in `@theme` block: earthy wine/cream/gold/sage palette

### Supabase ✅
- **Project ref:** `wdecjlrfulsdklqeetqb`
- **Region:** us-west-2
- **Org:** The Animist Apothecary (`pkluemscykienrwnbpta`)
- **URL:** `https://wdecjlrfulsdklqeetqb.supabase.co`
- **Anon key:** stored in `shared/supabase.js`
- **Secrets set:** `RESEND_API_KEY`, `FROM_EMAIL`, `GEMINI_API_KEY`
- **Storage buckets:** `media` (public), `documents` (private)
- **Note:** Supabase CLI incompatible with macOS 11 — use Management API via curl for all operations

---

## Database Schema

All tables use UUID PKs, RLS enabled, `is_archived` soft-delete flag.
Always filter client-side: `.filter(s => !s.is_archived)`

| Table | Purpose | RLS Policy |
|---|---|---|
| `clients` | Client records, contact info, notes, tags | Authenticated only |
| `services` | Offerings catalog with category, duration, price | Public read |
| `appointments` | Scheduled sessions linked to client + service | Authenticated only |
| `intake_forms` | JSONB form responses per client | Authenticated only |
| `mentorship_containers` | Ongoing packages with session tracking | Authenticated only |
| `payments` | Payment records linked to appointments/containers | Authenticated only |

**Service config tables** (created as services are added):
- `telnyx_config`, `resend_config`, `square_config`, `stripe_config`, `signwell_config`

---

## Edge Functions

Deployed via Supabase Management API (not CLI). Function source lives in `supabase/functions/`.

| Function | URL | Auth | Purpose |
|---|---|---|---|
| `send-email` | `.../functions/v1/send-email` | JWT required | Send transactional email via Resend |
| `gemini` | `.../functions/v1/gemini` | JWT required | AI features via Google Gemini 2.0 Flash |

**To deploy/update a function** (no CLI available):
```bash
FUNC_BODY=$(cat supabase/functions/SLUG/index.ts)
curl -s -X PATCH "https://api.supabase.com/v1/projects/wdecjlrfulsdklqeetqb/functions/SLUG" \
  -H "Authorization: Bearer sbp_87ab2eec3403e1545ae73ba3738cd4df51287ee7" \
  -H "Content-Type: application/json" \
  -d "{\"body\": $(echo "$FUNC_BODY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
```

---

## Shared Client Modules

| File | Purpose |
|---|---|
| `shared/supabase.js` | Supabase client, URL + anon key, storage helpers |
| `shared/auth.js` | Auth widget, Google OAuth, `requireAuth()` guard, login modal |
| `shared/admin.css` | Admin + auth UI styles, design tokens |
| `shared/email-service.js` | `sendEmail()` + `emailTemplates` (appointmentConfirmation, intakeFormInvitation, notification) |
| `shared/ai-service.js` | `ai(prompt, opts)` + `aiHelpers` (draftMessage, summarizeNotes, suggestIntakeQuestions, writeServiceDescription) |

---

## Authentication

| Page | Path | Purpose |
|---|---|---|
| Login | `login.html` | Google OAuth + email/password fallback |
| OAuth Callback | `auth/callback.html` | Handles Supabase redirect, exchanges token |
| Admin Dashboard | `admin/index.html` | Protected — redirects to `login.html` if not authenticated |

**Auth flow:** `login.html` → Google → `wdecjlrfulsdklqeetqb.supabase.co/auth/v1/callback` → `auth/callback.html` → `admin/index.html`

**Google OAuth status:** ⚠️ NOT YET ACTIVE — requires Google Cloud credentials (see Next Steps)
**Email/password login:** ✅ works now

**Admin page guard pattern:**
```js
requireAuth(function(user, sb) {
  // your page code here
});
```

---

## Admin Dashboard

| Page | Path | Status |
|---|---|---|
| Dashboard | `admin/index.html` | ✅ Built — live stat counts from all 6 tables |
| Clients | `admin/clients.html` | 🔲 Not yet built |
| Appointments | `admin/appointments.html` | 🔲 Not yet built |
| Services | `admin/services.html` | 🔲 Not yet built |
| Mentorship | `admin/mentorship.html` | 🔲 Not yet built |
| Payments | `admin/payments.html` | 🔲 Not yet built |
| Intake Forms | `admin/intake-forms.html` | 🔲 Not yet built |

---

## Public Website — The Animist Apothecary

**Design system:** Cormorant Garamond serif, wine/cream/gold/sage palette, `styles/site.css`
**Source material:** bodyworkandbotanicals.com (scraped March 2026)

### Pages Built

| Page | File | Content Status |
|---|---|---|
| Homepage | `index.html` | ✅ Fully written — hero, evolution story, 9 offering cards, who I serve, how to begin, newsletter |
| Dagara Divinations | `divinations.html` | ✅ Fully written — what is divination, 3-step process, call to action |
| Mythopoetic Being | `mythopoetic-being.html` | ✅ Fully written — 6 symbolic territories, 4-stage arc, who it calls, 3 container formats |
| Massage Therapy | `massage-therapy.html` | ✅ Real copy + scaffold for pricing/modalities |
| About | `about.html` | ✅ Real credentials + scaffold for bio & philosophy |
| Offerings | `offerings.html` | ✅ Full grid + three modes of engagement |
| Somatic Bodywork | `somatic-bodywork.html` | ✅ Real copy + scaffold for session details |
| Ceremonial Bodywork | `ceremonial-bodywork.html` | 🔲 Scaffold — awaiting your description |
| The Luminous Breath | `sacred-breath.html` | 🔲 Scaffold — awaiting your description |
| Guidance & Counsel | `guidance-counseling.html` | 🔲 Scaffold — awaiting your description |
| Mentorship Containers | `mentorship.html` | 🔲 Scaffold — awaiting container details & pricing |
| Group Gatherings | `gatherings.html` | 🔲 Scaffold — awaiting upcoming events & format |
| Single Sessions | `single-sessions.html` | 🔲 Scaffold — awaiting session descriptions & pricing |
| Contact | `contact.html` | ✅ Full intake form — interest radio, referral dropdown, thank-you state |
| Writings | `writings.html` | ✅ Newsletter + placeholder post grid |

### Pages Still Needed (from original Squarespace nav)
- `the-otherworldly-elders.html` — was 401 protected on Squarespace; needs your content
- `somatic-journey.html` — scaffolded by agent (verify it's complete)

---

## Services Configured

| Service | Status | Details |
|---|---|---|
| GitHub Pages | ✅ Live | https://adimarie.github.io/WorkHub/ |
| Supabase | ✅ Connected | Project wdecjlrfulsdklqeetqb, 6 tables, RLS |
| Tailwind CSS v4 | ✅ Built | Earthy design tokens, css:build script |
| Resend (Email) | ✅ Live | Edge function deployed, secrets set, client module + templates |
| Google Gemini AI | ✅ Live | gemini-2.0-flash, practice system context, aiHelpers |
| Google OAuth | ⚠️ Pending | Code complete — needs Google Cloud OAuth credentials |
| Telnyx (SMS) | 🔲 Not started | |
| Square (Payments) | 🔲 Not started | |
| Stripe (Payments + ACH) | 🔲 Not started | |
| SignWell (E-signatures) | 🔲 Not started | |
| Cloudflare R2 (Storage) | 🔲 Not started | |
| DigitalOcean Droplet | 🔲 Not started | |
| Oracle Cloud ARM | 🔲 Not started | |

---

## Next Steps

### Immediate (unblock the site)

1. **Complete Google OAuth** — takes ~5 min:
   - Create Google Cloud project at https://console.cloud.google.com/projectcreate
   - OAuth consent screen: https://console.cloud.google.com/apis/credentials/consent (External)
   - Create OAuth client ID (Web application), add redirect URI: `https://wdecjlrfulsdklqeetqb.supabase.co/auth/v1/callback`
   - Enable Google provider: https://supabase.com/dashboard/project/wdecjlrfulsdklqeetqb/auth/providers
   - Paste Client ID → Claude will save to credentials and mark complete

2. **Fill scaffold pages** — paste your descriptions into:
   - `ceremonial-bodywork.html` — what happens in session, who it's for
   - `sacred-breath.html` — The Luminous Breath description
   - `guidance-counseling.html` — what a Plàtica is
   - `mentorship.html` — your three container offerings + investment
   - `gatherings.html` — upcoming events or recurring format
   - `single-sessions.html` — session types + pricing
   - `about.html` — your bio, origin story, philosophy

3. **Add your photos** — upload to Supabase `media` bucket or commit directly. All page hero areas are currently CSS gradient placeholders.

### Admin Panel (build out CRUD pages)
- `admin/clients.html` — list, add, edit clients
- `admin/appointments.html` — calendar or list view, status management
- `admin/services.html` — manage offerings catalog
- `admin/mentorship.html` — container tracking, session counter
- `admin/payments.html` — payment log, status updates
- `admin/intake-forms.html` — view submitted forms

### Payments
- Decide: **Square** (simpler, card-only) vs **Stripe** (card + ACH bank transfers — better for large containers)
- Likely want both: Stripe for large mentorship containers (ACH saves fees), Square for in-person sessions

### SMS (Telnyx)
- Useful for: appointment reminders, intake form nudges, post-session check-ins
- Requires: US phone number + 10DLC brand/campaign registration (takes 1–4 weeks for approval)
- Start registration early if you want SMS within a month

### E-signatures (SignWell)
- Useful for: client intake agreements, service contracts, container agreements
- Free tier: 3–25 docs/month (likely sufficient to start)

### Booking / Scheduling
- Currently: contact form only (manual scheduling)
- Future: integrate Calendly, Cal.com, or build custom booking into admin
- Consider: link Calendly from contact page as interim solution

### Domain
- Point `bodyworkandbotanicals.com` or `theanimistapothecary.com` to GitHub Pages:
  - Add CNAME record pointing to `adimarie.github.io`
  - Add custom domain in repo Settings → Pages

---

## Key Commands

```bash
# Push changes live
git add -A && git commit -m "message" && git push

# Rebuild Tailwind CSS (after adding new classes)
npm run css:build

# Run SQL query via Management API
curl -s -X POST "https://api.supabase.com/v1/projects/wdecjlrfulsdklqeetqb/database/query" \
  -H "Authorization: Bearer sbp_87ab2eec3403e1545ae73ba3738cd4df51287ee7" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM clients LIMIT 5;"}'

# Deploy/update edge function via API (no CLI on macOS 11)
FUNC_BODY=$(cat supabase/functions/SLUG/index.ts)
curl -s -X PATCH "https://api.supabase.com/v1/projects/wdecjlrfulsdklqeetqb/functions/SLUG" \
  -H "Authorization: Bearer sbp_87ab2eec3403e1545ae73ba3738cd4df51287ee7" \
  -H "Content-Type: application/json" \
  -d "{\"body\": $(echo "$FUNC_BODY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
```

---

## Credentials Location

All API keys and secrets: `docs/CREDENTIALS.md` (gitignored — never committed)
Supabase secrets (server-side): managed via Management API
See also: `docs/INTEGRATIONS.md` for service configs, webhook URLs, cost tiers
