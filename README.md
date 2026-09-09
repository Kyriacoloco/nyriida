# Consortia Advisory OS — app

The staff app and client portal, one codebase. React + Vite, talks to Supabase project `uirbiqfkgnfnfugfclmu` directly;
every rule is enforced by the database, the app only calls functions and shows what comes back.

## Deploy (10 minutes, once)

1. Create a GitHub repo `consortia-os-app`, unzip this into it, push.
2. Vercel → Add New Project → import the repo. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL` = `https://uirbiqfkgnfnfugfclmu.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = Supabase → Project Settings → API → anon public key
4. Supabase → Authentication → URL Configuration: set Site URL to your Vercel URL and add `https://<your-app>.vercel.app/**` to Redirect URLs. Without this the sign-in link bounces.
5. Open the app, enter your email, click the link. If you see "Not staff", run README step 4 of the backend repo.

Each later slice is a zip you unzip over this folder and push. Vercel redeploys on push.

## Local

```
cp .env.example .env    # fill the anon key
npm install && npm run dev
```

## Slice 1 (this drop)

- Sign in by magic link; only rows in `staff` get past the door
- Leads board: columns from `pipeline_stages`, cards from `leads_board`, Fathom links, Convert to engagement
- Engagements list with stage filters
- Engagement detail: stepper, next-step card per stage, Stripe deposit link, financials checklist, Call 2 recording,
  fee and approaches with the invoice split shown live, decline with reason, client details, invoices with Mark paid, activity feed

Every "move" button calls `staff_advance_engagement`; if a gate isn't met the database says why and the app shows it.

## Coming

2 Portal + NDA/letter generation and click-to-sign · 3 Invoice PDFs · 4 Projects, tasks, reviews, time · 5 Dashboard, Documents, Clients, Reports
