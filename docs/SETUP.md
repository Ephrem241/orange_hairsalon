# Setup: database, accounts and first administrator

This connects the site to [Convex](https://convex.dev). That enables online booking, the dashboard, notifications and uploads. Allow about 20 minutes.

Convex holds everything: the data, the booking engine (`convex/`), staff sign-in (Convex Auth) and uploaded photos and videos. Each project has a **development** deployment (for you and for tests) and a **production** deployment (the live site). They never share data.

## 1. Create the Convex project

```bash
npx convex login     # once per computer; opens the browser
npx convex dev       # first run: create a project (e.g. "orange-salon"), then leave it running
```

`npx convex dev` writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.local` and pushes the code in `convex/` every time it changes. Keep it running while you develop (or use `npm run convex:dev`).

> **No account yet?** `CONVEX_AGENT_MODE=anonymous npx convex dev` runs a local deployment on this computer instead. Link it to an account later with `npx convex login` followed by `npx convex dev --configure`. Data from the local deployment is not copied across.

## 2. Set the secrets

```bash
npm run convex:env
```

This sets the following on the development deployment:

| Variable | What it is |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS` | Keys Convex Auth uses to sign staff sessions |
| `SITE_URL` | The website's address (`http://localhost:3000` in development) |
| `CONVEX_SERVER_SECRET` | Lets the Next.js server — and only it — call the booking API |

It also adds the matching `CONVEX_SERVER_SECRET` and the other local secrets (`BOOKING_COOKIE_SECRET`, `RATE_LIMIT_SALT`, `CRON_SECRET`) to `.env.local`. Running it again rotates the keys and signs everyone out.

Check with `npx convex env list` (it lists names; never paste the values anywhere).

## 3. Seed the verified details

```bash
npx convex run seed:verified
```

This writes only the details the salon has confirmed:
- the name, phone (+251 91 241 9748), address (Ednamoll Street) and opening hours;
- the real gallery photographs and reels.

It is safe to run again: existing rows are left alone.

**Demo data (development only).** To try booking with a sample menu and team:

```bash
npx convex env set ALLOW_DEMO_SEED true
npx convex run seed:demo          # every row is flagged as demo and labelled on the site
npx convex run seed:removeDemo    # deletes all of it again, with any test bookings
```

Never set `ALLOW_DEMO_SEED` on production. `seed:demo` refuses to run without it.

## 4. Create the first administrator

```bash
npm run admin:create -- --email owner@yoursalon.com --name "Owner Name"
```

The command prints a one-time temporary password. Sign in at `/admin/login`, then change it under **Account**.

There is no public sign-up. Staff accounts are created only here or by an admin under **Staff & access**:
- **Reception:** appointments, clients and messages.
- **Stylist:** their own diary and schedule. Each stylist login is linked to a stylist profile.

An account without an active staff profile has no dashboard access, and deactivating someone takes effect on their next request.

## 5. Fill in the salon (Dashboard)

1. **Settings:**
   - Check the business details.
   - Add WhatsApp, email and social links only if they're real.
   - Paste the Google Maps link.
   - Review the booking policy, lead time, booking window and cancellation cutoff.
   - Add holiday closures.
2. **Services:** add the real menu with ETB prices, durations and clean-up buffers. "Bookable" services appear online.
3. **Stylists & hours:**
   - Add each stylist and tick the services they perform.
   - Set weekly hours and breaks, and add time off.
   - Online slots exist only where a stylist works, the salon is open, and nothing else is booked.
4. **Gallery and reviews:**
   - Add verified reviews with their source link.
   - Mark any non-salon imagery as illustrative.
   - Uploads (JPEG, PNG, WebP or AVIF up to 8 MB; MP4 or WebM up to 50 MB) are stored in Convex file storage.
5. Make a test booking at `/book` and confirm it from **Appointments**.

## 6. Notifications (optional)

| Channel | What's needed | Without it |
|---|---|---|
| Email | A [Resend](https://resend.com) account and a verified sending domain. Set `RESEND_API_KEY` and `EMAIL_FROM`. | Each email is logged as **skipped** with the reason. |
| WhatsApp | A WhatsApp Business Platform (Cloud API) app in Meta Business Manager, plus message templates approved for each event. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TEMPLATE_*`. Each template body takes {{1}} name, {{2}} service, {{3}} date, {{4}} time, {{5}} reference. | Skipped. A wa.me chat link is **not** used as a notification. |
| Reminders | The daily cron (see DEPLOYMENT.md) sends reminders for the next day's confirmed appointments. | — |

These variables belong to the Next.js app (`.env.local`, or Vercel), not to Convex.

**Settings → Notifications** shows whether each provider is connected. **Notifications** lists every attempt as sent, failed or skipped, with a Retry button.

## 7. Verify against the development deployment

Use the **development** deployment, never production, with the demo seed loaded. Then run:

```bash
npm run test:integration
```

This fires ten simultaneous bookings at one slot and expects exactly one to succeed. It also checks that the booking API refuses calls without the server secret, that dashboard functions refuse callers without a staff session, and that public queries expose no private contact details. Its one booking is cancelled afterwards.

Set `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` (an admin on that deployment) to also check an upload end to end.
