# Deployment (Vercel + Convex)

The website runs on Vercel; the backend (`convex/`) runs on the project's Convex **production** deployment. Each Vercel production build deploys both, so they never drift apart.

1. **Push and import.** Push the repository to GitHub, then **Add New → Project** in Vercel and import it. Vercel detects Next.js.
2. **Connect Convex.**
   - In the Convex dashboard, open the project's **Production** deployment → **Settings → Deploy key** and generate a production deploy key.
   - In Vercel, set **Build Command** to `npx convex deploy --cmd 'npm run build'`. It pushes `convex/` to production, then builds the site with `NEXT_PUBLIC_CONVEX_URL` pointing at it.
3. **Set up the production deployment** (once, from your computer):

   ```bash
   npx convex deploy                                                   # first push of convex/ to production
   npm run convex:env -- --prod --site-url https://orangesalon.et      # auth keys, SITE_URL, server secret
   npx convex run --prod seed:verified
   npm run admin:create -- --prod --email owner@yoursalon.com --name "Owner Name"
   ```

   Production keys are separate from development ones; nothing carries across.
4. **Set environment variables in Vercel** under **Settings → Environment Variables**. Each one is described in `.env.example`.
   - Required for production:
     - `CONVEX_DEPLOY_KEY` (the production deploy key from step 2)
     - `CONVEX_SERVER_SECRET` — copy it from the Convex dashboard (**Production → Settings → Environment Variables**)
     - `NEXT_PUBLIC_SITE_URL` (the real domain, e.g. `https://orangesalon.et`)
     - `BOOKING_COOKIE_SECRET`, `RATE_LIMIT_SALT`, `CRON_SECRET`
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`, and the `WHATSAPP_*` variables.
   - Do **not** set `DEMO_CONTENT` in production. It is ignored on production deployments anyway.
5. **Deploy.**
6. **Add your domain** under **Settings → Domains**. Then update `NEXT_PUBLIC_SITE_URL` in Vercel and `SITE_URL` on Convex (`npx convex env set --prod SITE_URL https://…`), and redeploy.
7. **Cron.** `vercel.json` schedules `/api/cron/reminders` daily at 14:00 UTC (17:00 in Addis Ababa).
   - Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
   - The Hobby plan allows one run per day, which is what reminders need.
   - Old rate-limit records are pruned hourly by a Convex cron (`convex/crons.ts`).

## After each deploy

- Visit `/`, `/services`, `/book` and `/admin/login`.
- Check Search Console with `/sitemap.xml`.
- Make one real test booking, then cancel it from the dashboard.

## Backend changes

Code in `convex/` deploys with every Vercel production build. Run `npm test` first: the `convex-test` suite exercises the booking engine, permissions and seeds in memory.

When changing `convex/schema.ts` on a deployment that already has data, add new fields as optional first; Convex refuses a push that existing documents don't match.

## Security checklist

- [ ] `CONVEX_SERVER_SECRET` exists only in Convex and in Vercel's server environment, never in a `NEXT_PUBLIC_*` variable, and differs between development and production.
- [ ] `CONVEX_DEPLOY_KEY` is set only in Vercel.
- [ ] `BOOKING_COOKIE_SECRET` is 32+ random characters and differs between environments.
- [ ] `ALLOW_DEMO_SEED` is not set on production, and `npx convex run --prod public:services` shows no `isDemo: true` rows.
- [ ] Security headers are on: HSTS, X-Frame-Options and nosniff are set in `next.config.ts`.
- [ ] The integration suite passes against the development deployment.
