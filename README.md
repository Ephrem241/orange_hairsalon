# Orange Salon — website & booking platform

A cinematic website and online appointment system for **Orange Salon**, Ednamoll Street, Addis Ababa, with a staff dashboard for appointments, clients, the service menu, the team's hours, the gallery and salon settings.

- **Public site:** home (full-screen film hero), services, gallery, about, contact.
- **Booking:**
  - Online booking runs from service to stylist to date and time, then details, review and a booking reference.
  - Clients can find their booking with its reference plus their phone number, then cancel or reschedule it.
- **Dashboard** (`/admin`):
  - Overview, appointments (list and day calendar), clients, services, stylists and hours, gallery, reviews, messages, notifications, settings, staff access and the audit log.
  - Roles are owner/admin, reception and stylist.
- **Stack:** Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS v4, Supabase (Postgres, Auth, Storage), Resend email (optional), WhatsApp Business Cloud API (optional), hosted on Vercel.

## Quick start (no database)

```bash
npm install
cp .env.example .env.local      # set DEMO_CONTENT=true to preview with sample data
npm run dev                      # http://localhost:3000
```

Without Supabase the site still works. It shows the salon's verified details and real photography, and the booking page offers a clearly labelled demo preview. Booking itself and the dashboard need the database: see **[docs/SETUP.md](docs/SETUP.md)**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests and database tests (PGlite, no Docker needed) |
| `npm run test:integration` | Concurrency and RLS checks against a real Supabase **dev** project (skipped until configured) |
| `npm run test:e2e` | Playwright smoke tests on desktop and mobile (`npx playwright install chromium` first) |
| `npm run admin:create -- --email … --name …` | Create the first administrator |
| `npm run media` | Re-encode the hero film, ambient video and photos from `images/` |

## How booking integrity works

The database is the single authority on availability (`supabase/migrations/…_booking_engine.sql`):

- **Availability.** `get_available_slots` works out bookable start times from four things:
  - salon opening hours;
  - each stylist's weekly hours and breaks;
  - time off and salon closures;
  - existing appointments, including each service's duration and clean-up buffer.

  Lead time and the booking window are applied too. All times are in Africa/Addis_Ababa.
- **No double bookings.** An `EXCLUDE USING gist` constraint makes overlapping live appointments for one stylist impossible. If two requests race for the same slot, only one insert can commit. The other gets `SLOT_TAKEN`, and the client is sent back to fresh times.
- **Public API.** The booking functions can be executed only with the server's secret key. Browsers cannot call them directly, so server-side validation and rate limits always apply.
- **Staff actions.** Confirming, declining, rescheduling and completing go through security-definer functions that check the caller's role and re-validate the slot. Row-level security limits each role to what it may see.
- **Statuses.** An appointment is *pending*, *confirmed*, *completed*, *cancelled* or *no-show*. Online bookings are requests until staff confirm them (configurable in Settings).
- **Customer self-service.** Booking pages open only with an encrypted, httpOnly 30-minute cookie, set after booking or after a reference-plus-phone check. A guessed URL shows nothing.

## Project layout

```
src/app/(site)/        public pages          src/app/admin/     dashboard (+ login)
src/app/api/           booking, contact, cron endpoints
src/components/        site, booking, admin, ui
src/lib/               data access, booking, notifications, validation, time, SEO
supabase/migrations/   schema, RLS, booking engine, storage, verified seed
supabase/seed.demo.sql development-only sample menu and team (never production)
tests/                 unit, db (PGlite), integration (live), e2e (Playwright)
scripts/               media pipeline, first-admin setup, screenshots
docs/                  SETUP, DEPLOYMENT, MEDIA
```

## Content rules

- **What the site publishes as fact:** only details the salon has verified. Today that's the phone number, the address, opening hours and genuine salon photography.
- **Hidden until real data exists:**
  - stylists, reviews, social links and the "our story" text;
  - the menu and prices;
  - before/after pairs, which must be genuine photos of the same client.
- **Demo data:** demo rows are flagged `is_demo`, carry a visible "Demo" badge, and are excluded from the sitemap.
