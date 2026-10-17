# Deployment (Vercel)

1. **Push and import.** Push the repository to GitHub, then **Add New → Project** in Vercel and import it. Vercel detects Next.js.
2. **Set environment variables** under **Settings → Environment Variables**. Each one is described in `.env.example`.
   - Required for production:
     - `NEXT_PUBLIC_SITE_URL` (the real domain, e.g. `https://orangesalon.et`)
     - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
     - `BOOKING_COOKIE_SECRET`, `RATE_LIMIT_SALT`, `CRON_SECRET`
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`, and the `WHATSAPP_*` variables.
   - Do **not** set `DEMO_CONTENT` in production. It is ignored on production deployments anyway.
3. **Deploy.** The build runs `next build`.
4. **Add your domain** under **Settings → Domains**, then update `NEXT_PUBLIC_SITE_URL` and redeploy.
5. **Cron.** `vercel.json` schedules `/api/cron/reminders` daily at 14:00 UTC (17:00 in Addis Ababa).
   - Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
   - The Hobby plan allows one run per day, which is what reminders need.
6. **Check Supabase Auth URLs.** Under **Authentication → URL Configuration**, set the Site URL to your domain.

## After each deploy

- Visit `/`, `/services`, `/book` and `/admin/login`.
- Check Search Console with `/sitemap.xml`.
- Make one real test booking, then cancel it from the dashboard.

## Database changes

New migrations go in `supabase/migrations/` with a later timestamp. Apply them with `npx supabase db push` before deploying code that depends on them. Run `npm test` first: the PGlite database tests run every migration from scratch.

## Security checklist

- [ ] `SUPABASE_SECRET_KEY` exists only in Vercel's server environment, never in a `NEXT_PUBLIC_*` variable.
- [ ] Auth sign-ups are disabled and the `private` schema is not exposed.
- [ ] `BOOKING_COOKIE_SECRET` is 32+ random characters and differs between environments.
- [ ] `seed.demo.sql` has never been run against production; `select count(*) from services where is_demo` returns 0.
- [ ] Security headers are on: HSTS, X-Frame-Options and nosniff are set in `next.config.ts`.
- [ ] The integration suite passes against a staging project.
