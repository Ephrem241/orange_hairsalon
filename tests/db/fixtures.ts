import type { Db } from './harness'

export const ids = {
  silkPress: '00000000-0000-4000-8000-000000000001',
  braids: '00000000-0000-4000-8000-000000000002',
  retired: '00000000-0000-4000-8000-000000000003',
  ama: '00000000-0000-4000-8000-0000000000a1', // works mornings, does both services
  bethel: '00000000-0000-4000-8000-0000000000b2', // works afternoons, silk press only
  admin: '00000000-0000-4000-8000-00000000ad01',
  admin2: '00000000-0000-4000-8000-00000000ad02',
  reception: '00000000-0000-4000-8000-00000000fe01',
  stylistUser: '00000000-0000-4000-8000-00000000a1a1',
  stranger: '00000000-0000-4000-8000-00000000dead',
} as const

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

/** Salon-local wall-clock time → ISO instant (Addis Ababa is UTC+3, no DST). */
export const at = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString()

/** Inverse of `at`: an instant → "HH:MM" in Addis Ababa. */
export function localTime(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/**
 * Catalogue + team used by the booking tests (inserted as the database owner):
 *  - Silk press: 60 min, 15 min clean-up buffer. Braids: 180 min, default buffer (10).
 *  - Ama: Mon–Sat 08:00–17:00, lunch 12:00–13:00, does silk press + braids.
 *  - Bethel: Mon–Sat 10:00–20:00, silk press only.
 */
export async function seedSalon(db: Db) {
  await db.exec(`
    insert into public.services (id, slug, name, price_etb, duration_min, buffer_min, is_active) values
      ('${ids.silkPress}', 'silk-press', 'Silk press', 1500, 60, 15, true),
      ('${ids.braids}', 'knotless-braids', 'Knotless braids', 4500, 180, null, true),
      ('${ids.retired}', 'retired-service', 'Retired service', 900, 30, null, false);

    insert into public.stylists (id, slug, display_name, sort_order) values
      ('${ids.ama}', 'ama', 'Ama', 1),
      ('${ids.bethel}', 'bethel', 'Bethel', 2);

    insert into public.stylist_contacts (stylist_id, phone) values ('${ids.ama}', '+251911000001');

    insert into public.stylist_services (stylist_id, service_id) values
      ('${ids.ama}', '${ids.silkPress}'), ('${ids.ama}', '${ids.braids}'),
      ('${ids.ama}', '${ids.retired}'), ('${ids.bethel}', '${ids.silkPress}');

    insert into public.working_hours (stylist_id, weekday, starts_at, ends_at)
      select '${ids.ama}'::uuid, d, '08:00'::time, '17:00'::time from generate_series(1, 6) d
      union all
      select '${ids.bethel}'::uuid, d, '10:00'::time, '20:00'::time from generate_series(1, 6) d;

    insert into public.stylist_breaks (stylist_id, weekday, starts_at, ends_at, label)
      select '${ids.ama}'::uuid, d, '12:00'::time, '13:00'::time, 'Lunch' from generate_series(1, 6) d;

    insert into auth.users (id, email) values
      ('${ids.admin}', 'owner@example.com'), ('${ids.admin2}', 'owner2@example.com'),
      ('${ids.reception}', 'desk@example.com'), ('${ids.stylistUser}', 'ama@example.com'),
      ('${ids.stranger}', 'stranger@example.com');

    insert into public.profiles (id, full_name, role, stylist_id) values
      ('${ids.admin}', 'Owner', 'admin', null),
      ('${ids.reception}', 'Front desk', 'receptionist', null),
      ('${ids.stylistUser}', 'Ama', 'stylist', '${ids.ama}');
  `)
}

export const customer = {
  name: 'Hana Tesfaye',
  phone: '+251911223344',
  email: 'hana@example.com',
}

/** Book online through the public RPC, exactly as the API route does (service role). */
export function bookOnlineSql() {
  return `select public.book_appointment($1, $2, $3, $4, $5, $6, $7, $8) as result`
}

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
let refCounter = 0

/** A valid, unique booking reference for directly inserted fixtures. */
function nextFixtureReference(): string {
  let n = ++refCounter
  let code = ''
  for (let i = 0; i < 6; i++) {
    code = REF_ALPHABET[n % REF_ALPHABET.length] + code
    n = Math.floor(n / REF_ALPHABET.length)
  }
  return `OS-${code}`
}

/** Insert an appointment directly as the owner (for states the API cannot reach, e.g. in the past). */
export async function insertAppointment(
  db: Db,
  opts: { stylistId: string; startsAt: string; status?: string; priceEtb?: number; amountPaidEtb?: number },
): Promise<string> {
  await db.query(
    `insert into public.customers (full_name, phone_e164) values ('Walk In', '+251922000000')
     on conflict (phone_e164) do nothing`,
  )
  const { rows } = await db.query<{ id: string }>(
    `insert into public.appointments (
       reference, service_id, stylist_id, customer_id, status, starts_at, service_name,
       price_etb, price_type, duration_min, buffer_min, customer_name, customer_phone, amount_paid_etb)
     select $1, $2, $3, c.id, $4::public.appointment_status, $5, 'Silk press', $6, 'fixed', 60, 15,
            'Walk In', '+251922000000', $7
     from public.customers c where c.phone_e164 = '+251922000000'
     returning id`,
    [
      nextFixtureReference(),
      ids.silkPress,
      opts.stylistId,
      opts.status ?? 'confirmed',
      opts.startsAt,
      opts.priceEtb ?? 1500,
      opts.amountPaidEtb ?? null,
    ],
  )
  return rows[0].id
}
