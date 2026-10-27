# Community hub setup (parked)

The community hub (events, map, invites, photo posts, nearby-event alerts by phone notification and email) is built on branch **`community-hub`** but parked as of 2026-10-27. Nothing here is needed until it's picked back up.

## What the branch contains
- `supabase/migrations/…_community_hub.sql`: tables, row level security, location search, photo storage bucket (10 MB, photos only), alert targeting
- `supabase/functions/notify-nearby/`: sends alerts by Web Push and/or Brevo email; one promotion per event, 3 per organizer per day
- `src/hub/`: the Hub tab (lazy-loaded), `public/push-sw.js` (notification handling in the service worker)
- `.env.production`: public settings only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`)

## Accounts needed
1. **Supabase** (free project). Note the Project URL and the anon/publishable key; both are public and go in `.env.production`. Never commit the service_role key.
2. **Brevo** (free, 300 emails/day) for sign-in links and alert emails:
   - Senders & IPs: add and confirm the sending address
   - SMTP & API → SMTP: copy the SMTP settings into Supabase → Authentication → Emails → SMTP Settings (this allows anyone to sign up, not just Supabase org members)
   - SMTP & API → API Keys: create a key and add it in Supabase → Edge Functions → Secrets as `BREVO_API_KEY`
   - Brevo's website field: the app's live address

## Setup steps
1. Run the migration in Supabase's SQL editor.
2. Generate notification keys with `npx web-push@3.6.7 generate-vapid-keys`. Put the public key in `.env.production`; set the private key only as a function secret. The keys generated on 2026-10-27 were kept outside the repo; regenerating is fine, since nobody has subscribed yet.
3. Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` the sender), `EMAIL_FROM`, `EMAIL_FROM_NAME`, `BREVO_API_KEY`, `APP_URL` (the live app address; set it as configuration, not code).
4. Deploy: `npx supabase@<pinned version> login`, then `functions deploy notify-nearby --project-ref <ref>`.
5. Authentication → URL Configuration: Site URL = the live app address. Redirect URLs: the live address with `/**`, `https://*--hackapptrial.netlify.app/**`, `http://localhost:5173/**`.
6. Rebase `community-hub` on `main`, open a PR, test sign-in, events, photos and alerts on the Netlify link.

## Known limits
- iPhone push alerts only work for the app added to the Home Screen (iOS 16.4+)
- Free tiers: Supabase 1 GB file storage; Brevo 300 emails/day; OpenStreetMap tiles are fine only at small scale
- Alert emails explain how to turn alerts off, but there's no one-click unsubscribe link yet
- Reports are reviewed in the Supabase dashboard; there's no admin screen
