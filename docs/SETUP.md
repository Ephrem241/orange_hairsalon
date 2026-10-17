# Setup: database, accounts and first administrator

This connects the site to Supabase. That enables online booking, the dashboard, notifications and uploads. Allow about 20 minutes.

## 1. Create a Supabase project

1. In [supabase.com](https://supabase.com), create a project.
   - Region: **eu-central-1 (Frankfurt)** is closest to Addis Ababa among common regions.
   - Save the database password somewhere safe.
2. Free-plan organisations allow two active projects. Pause an unused one or upgrade if you hit the limit.
3. Under **Project Settings → API Keys**, copy:
   - the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - the **publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - the **secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY`. This is server only; never put it in browser code or commit it.

Put these, plus the security secrets below, in `.env.local`:

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # BOOKING_COOKIE_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))"   # RATE_LIMIT_SALT
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"   # CRON_SECRET
```

## 2. Apply the database migrations

The migrations live in `supabase/migrations/`, in this order:

1. foundation
2. tables
3. security
4. booking engine
5. storage
6. verified seed

**Option A — Supabase CLI (recommended, no Docker needed for remote pushes):**

```bash
npx supabase login
npx supabase init            # only if supabase/config.toml does not exist yet; keep existing migrations
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push         # applies every migration in order
```

**Option B — SQL Editor:** open each file in order and run it.

The final migration seeds only the verified details:
- the name, phone (+251 91 241 9748), address (Ednamoll Street) and opening hours;
- the real gallery photographs and reels.

**Never run `supabase/seed.demo.sql` on production.** It is a sample menu and team for development projects only, and it ends with the SQL that removes everything it created.

## 3. Lock down sign-ups

Staff accounts are created only by an admin. There is no public registration page.

In **Authentication → Sign In / Providers**:
- **Email:** enabled.
- **Allow new users to sign up:** **off**.
- Optionally raise the **minimum password length** to 12.

Even if sign-ups were left on, a new account has no `profiles` row and therefore no access. The database treats it as a member of the public.

In **API Settings → Exposed schemas**, keep the default (`public`, `graphql_public`). The `private` schema holds internal functions and must **not** be exposed.

## 4. Create the first administrator

```bash
npm run admin:create -- --email owner@yoursalon.com --name "Owner Name"
```

The command prints a one-time temporary password. Sign in at `/admin/login`, then change it under **Account**. Add the rest of the team from **Staff & access**:
- **Reception:** appointments, clients and messages.
- **Stylist:** their own diary and schedule. Each stylist login is linked to a stylist profile.

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
5. Make a test booking at `/book` and confirm it from **Appointments**.

## 6. Notifications (optional)

| Channel | What's needed | Without it |
|---|---|---|
| Email | A [Resend](https://resend.com) account and a verified sending domain. Set `RESEND_API_KEY` and `EMAIL_FROM`. | Each email is logged as **skipped** with the reason. |
| WhatsApp | A WhatsApp Business Platform (Cloud API) app in Meta Business Manager, plus message templates approved for each event. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TEMPLATE_*`. Each template body takes {{1}} name, {{2}} service, {{3}} date, {{4}} time, {{5}} reference. | Skipped. A wa.me chat link is **not** used as a notification. |
| Reminders | The daily cron (see DEPLOYMENT.md) sends reminders for the next day's confirmed appointments. | — |

**Settings → Notifications** shows whether each provider is connected. **Notifications** lists every attempt as sent, failed or skipped, with a Retry button.

## 7. Verify against the live project

Use a **development** project, never production. Then run:

```bash
npm run test:integration
```

This fires ten simultaneous bookings at one slot and expects exactly one to succeed. It also checks that the publishable key cannot read appointments, customers or private contact details. It creates and removes its own temporary records.
