/**
 * Runs the real Convex functions against convex-test's in-memory backend.
 *
 * Callers are simulated the way the app makes them:
 *   - the Next.js server: public booking functions with the server secret;
 *   - staff: Convex Auth identities whose subject is "<userId>|<sessionId>";
 *   - anonymous visitors: no identity, no secret.
 */
import { api, internal } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import schema from '@convex/schema'
import { convexTest } from 'convex-test'
import { vi } from 'vitest'

export const modules = import.meta.glob('../../convex/**/*.ts')
export const SECRET = 'test-server-secret-0123456789abcdef'

export type Salon = Awaited<ReturnType<typeof createSalon>>

/** Today's date in Addis Ababa as YYYY-MM-DD. */
export function addisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date())
}

/** The first date with the given weekday (0 = Sunday) at least `minDaysAhead` days out. */
export function nextWeekday(dow: number, minDaysAhead = 2): string {
  const [y, m, d] = addisToday().split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + minDaysAhead))
  while (date.getUTCDay() !== dow) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Salon-local wall-clock time → epoch ms (Addis Ababa is UTC+3, no DST). */
export const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+03:00`)

/** Inverse of `at`: an instant → "HH:MM" in Addis Ababa. */
export function localTime(ms: number | string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))
}

/** The error code a Convex call rejects with (ConvexError data.code), or its message. */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data
    return data?.code ?? (error as Error).message
  }
  throw new Error('Expected the call to fail, but it succeeded')
}

export const customer = { name: 'Hana Tesfaye', phone: '+251911223344', email: 'hana@example.com' }

/**
 * The verified seed plus the catalogue and team the tests use:
 *  - Silk press: 60 min, 15 min clean-up buffer. Braids: 180 min, default buffer (10).
 *  - Ama: Mon–Sat 08:00–17:00, lunch 12:00–13:00, does silk press + braids.
 *  - Bethel: Mon–Sat 10:00–20:00, silk press only.
 *  - Logins: owner (admin), desk (receptionist), Ama (stylist), a stranger with
 *    a valid account but no staff profile, and a second account for later use.
 */
export async function createSalon() {
  vi.stubEnv('CONVEX_SERVER_SECRET', SECRET)
  const t = convexTest(schema, modules)
  await t.mutation(internal.seed.verified, {})

  const ids = await t.run(async (ctx) => {
    const now = Date.now()
    const service = (slug: string, name: string, priceEtb: number, durationMin: number, bufferMin: number | undefined, isActive: boolean) =>
      ctx.db.insert('services', { slug, name, priceEtb, priceType: 'fixed', durationMin, bufferMin, isActive, isFeatured: false, sortOrder: 0, isDemo: false, updatedAt: now })
    const silkPress = await service('silk-press', 'Silk press', 1500, 60, 15, true)
    const braids = await service('knotless-braids', 'Knotless braids', 4500, 180, undefined, true)
    const retired = await service('retired-service', 'Retired service', 900, 30, undefined, false)

    const stylist = (slug: string, displayName: string, sortOrder: number) =>
      ctx.db.insert('stylists', { slug, displayName, isActive: true, acceptsOnlineBooking: true, sortOrder, isDemo: false, updatedAt: now })
    const ama = await stylist('ama', 'Ama', 1)
    const bethel = await stylist('bethel', 'Bethel', 2)
    await ctx.db.insert('stylistContacts', { stylistId: ama, phone: '+251911000001', updatedAt: now })
    for (const [stylistId, serviceId] of [[ama, silkPress], [ama, braids], [ama, retired], [bethel, silkPress]] as const) {
      await ctx.db.insert('stylistServices', { stylistId, serviceId })
    }
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      await ctx.db.insert('workingHours', { stylistId: ama, weekday, startsAt: '08:00', endsAt: '17:00' })
      await ctx.db.insert('workingHours', { stylistId: bethel, weekday, startsAt: '10:00', endsAt: '20:00' })
      await ctx.db.insert('stylistBreaks', { stylistId: ama, weekday, startsAt: '12:00', endsAt: '13:00', label: 'Lunch' })
    }

    const user = (email: string) => ctx.db.insert('users', { email })
    const admin = await user('owner@example.com')
    const admin2 = await user('owner2@example.com')
    const reception = await user('desk@example.com')
    const stylistUser = await user('ama@example.com')
    const stranger = await user('stranger@example.com')
    const profile = (userId: Id<'users'>, fullName: string, email: string, role: 'admin' | 'receptionist' | 'stylist', stylistId?: Id<'stylists'>) =>
      ctx.db.insert('staffProfiles', { userId, fullName, email, role, stylistId, isActive: true, updatedAt: now })
    const adminProfile = await profile(admin, 'Owner', 'owner@example.com', 'admin')
    await profile(reception, 'Front desk', 'desk@example.com', 'receptionist')
    await profile(stylistUser, 'Ama', 'ama@example.com', 'stylist', ama)

    return { silkPress, braids, retired, ama, bethel, admin, admin2, reception, stylistUser, stranger, adminProfile }
  })

  const as = (userId: Id<'users'>) => t.withIdentity({ subject: `${userId}|test-session`, issuer: 'test' })

  return {
    t,
    ids,
    owner: as(ids.admin),
    desk: as(ids.reception),
    stylist: as(ids.stylistUser),
    stranger: as(ids.stranger),
    as,
    /** Book online through the public API, exactly as the Next.js route does. */
    book(opts: { startsAt: number; stylistId?: Id<'stylists'> | null; serviceId?: Id<'services'>; phone?: string; name?: string; policy?: boolean }) {
      return t.mutation(api.booking.book, {
        serverSecret: SECRET,
        serviceId: opts.serviceId ?? ids.silkPress,
        stylistId: opts.stylistId ?? null,
        startsAt: opts.startsAt,
        fullName: opts.name ?? customer.name,
        phone: opts.phone ?? customer.phone,
        email: customer.email,
        policyAccepted: opts.policy ?? true,
      })
    },
    /** Online slots for a date as "HH:MM" with the number of free stylists. */
    async slots(date: string, stylistId: Id<'stylists'> | null = null, serviceId: Id<'services'> = ids.silkPress) {
      const rows = await t.query(api.booking.availability, { serverSecret: SECRET, serviceId, stylistId, date, now: Date.now() })
      return rows.map((r) => ({ time: localTime(r.slotStart), free: r.stylistsFree }))
    },
    async times(date: string, stylistId: Id<'stylists'> | null = null, serviceId: Id<'services'> = ids.silkPress) {
      return (await this.slots(date, stylistId, serviceId)).map((s) => s.time)
    },
    /** Insert an appointment directly (for states the API cannot reach, e.g. in the past). */
    insertAppointment(opts: { stylistId: Id<'stylists'>; startsAt: number; status?: 'pending' | 'confirmed' | 'cancelled'; priceEtb?: number; phone?: string }) {
      return t.run(async (ctx) => {
        const phone = opts.phone ?? '+251922000000'
        const existing = await ctx.db.query('customers').withIndex('by_phoneE164', (q) => q.eq('phoneE164', phone)).unique()
        const customerId =
          existing?._id ?? (await ctx.db.insert('customers', { fullName: 'Walk In', phoneE164: phone, isDemo: false, searchText: 'Walk In', updatedAt: Date.now() }))
        const reference = `OS-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01ILO]/g, 'X')}`
        return await ctx.db.insert('appointments', {
          reference,
          serviceId: ids.silkPress,
          stylistId: opts.stylistId,
          customerId,
          status: opts.status ?? 'confirmed',
          source: 'phone',
          startsAt: opts.startsAt,
          endsAt: opts.startsAt + 60 * 60_000,
          blockedUntil: opts.startsAt + 75 * 60_000,
          serviceName: 'Silk press',
          priceEtb: opts.priceEtb ?? 1500,
          priceType: 'fixed',
          durationMin: 60,
          bufferMin: 15,
          customerName: 'Walk In',
          customerPhone: phone,
          isDemo: false,
          searchText: 'Walk In',
          updatedAt: Date.now(),
        })
      })
    },
  }
}
