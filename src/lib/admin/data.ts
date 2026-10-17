import 'server-only'
import { createSessionClient } from '@/lib/supabase/server'
import type { AppointmentStatus } from '@/lib/types'

/*
 * Dashboard reads. Every query runs with the signed-in staff member's session,
 * so row-level security decides what each role can see (a stylist only ever
 * receives their own appointments, whatever the filters say).
 */

export type AdminAppointment = {
  id: string
  reference: string
  status: AppointmentStatus
  source: string
  startsAt: string
  endsAt: string
  serviceId: string
  serviceName: string
  stylistId: string
  stylistName: string
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  customerNotes: string | null
  internalNotes: string | null
  priceEtb: number
  priceType: 'fixed' | 'from'
  durationMin: number
  bufferMin: number
  amountPaidEtb: number | null
  cancelReason: string | null
  cancelledBy: string | null
  createdAt: string
}

const APPOINTMENT_COLUMNS =
  'id, reference, status, source, starts_at, ends_at, service_id, service_name, stylist_id, customer_id, customer_name, customer_phone, customer_email, customer_notes, internal_notes, price_etb, price_type, duration_min, buffer_min, amount_paid_etb, cancel_reason, cancelled_by, created_at, stylist:stylists(display_name)'

function mapAppointment(r: Record<string, unknown>): AdminAppointment {
  const stylist = r.stylist as { display_name?: string } | null
  return {
    id: String(r.id),
    reference: String(r.reference),
    status: r.status as AppointmentStatus,
    source: String(r.source),
    startsAt: String(r.starts_at),
    endsAt: String(r.ends_at),
    serviceId: String(r.service_id),
    serviceName: String(r.service_name),
    stylistId: String(r.stylist_id),
    stylistName: stylist?.display_name ?? '—',
    customerId: String(r.customer_id),
    customerName: String(r.customer_name),
    customerPhone: String(r.customer_phone),
    customerEmail: (r.customer_email as string | null) ?? null,
    customerNotes: (r.customer_notes as string | null) ?? null,
    internalNotes: (r.internal_notes as string | null) ?? null,
    priceEtb: Number(r.price_etb),
    priceType: r.price_type === 'from' ? 'from' : 'fixed',
    durationMin: Number(r.duration_min),
    bufferMin: Number(r.buffer_min),
    amountPaidEtb: r.amount_paid_etb === null ? null : Number(r.amount_paid_etb),
    cancelReason: (r.cancel_reason as string | null) ?? null,
    cancelledBy: (r.cancelled_by as string | null) ?? null,
    createdAt: String(r.created_at),
  }
}

export type AppointmentFilters = {
  from?: string
  to?: string
  status?: AppointmentStatus | 'live'
  stylistId?: string
  serviceId?: string
  customerId?: string
  q?: string
  limit?: number
  ascending?: boolean
}

/** Characters with meaning in PostgREST filter syntax are stripped from search text. */
const sanitize = (q: string) => q.replace(/[,()*%\\:"]/g, ' ').trim()

export async function listAppointments(filters: AppointmentFilters = {}): Promise<AdminAppointment[]> {
  const db = await createSessionClient()
  let query = db.from('appointments').select(APPOINTMENT_COLUMNS)
  if (filters.from) query = query.gte('starts_at', filters.from)
  if (filters.to) query = query.lt('starts_at', filters.to)
  if (filters.status === 'live') query = query.in('status', ['pending', 'confirmed'])
  else if (filters.status) query = query.eq('status', filters.status)
  if (filters.stylistId) query = query.eq('stylist_id', filters.stylistId)
  if (filters.serviceId) query = query.eq('service_id', filters.serviceId)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.q) {
    const q = sanitize(filters.q)
    if (/^OS-?[2-9A-HJKMNP-Z]{6}$/i.test(q)) {
      query = query.eq('reference', q.toUpperCase().replace(/^OS(?!-)/, 'OS-'))
    } else if (q) {
      const digits = q.replace(/\D/g, '')
      const clauses = [`customer_name.ilike.*${q}*`, ...(digits.length >= 4 ? [`customer_phone.ilike.*${digits.slice(-9)}*`] : [])]
      query = query.or(clauses.join(','))
    }
  }
  const { data, error } = await query.order('starts_at', { ascending: filters.ascending ?? true }).limit(filters.limit ?? 300)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapAppointment(r as Record<string, unknown>))
}

export async function getAppointment(id: string) {
  const db = await createSessionClient()
  const [{ data: appt }, { data: events }, { data: notifications }] = await Promise.all([
    db.from('appointments').select(APPOINTMENT_COLUMNS).eq('id', id).maybeSingle(),
    db.from('appointment_events').select('id, event, actor_type, details, created_at').eq('appointment_id', id).order('created_at'),
    db.from('notification_log').select('id, event, channel, recipient, status, error, created_at, sent_at').eq('appointment_id', id).order('created_at'),
  ])
  if (!appt) return null
  return {
    appointment: mapAppointment(appt as Record<string, unknown>),
    events: (events ?? []) as { id: number; event: string; actor_type: string; details: Record<string, unknown>; created_at: string }[],
    notifications: (notifications ?? []) as { id: string; event: string; channel: string; recipient: string; status: string; error: string | null; created_at: string; sent_at: string | null }[],
  }
}

export type AdminStylist = {
  id: string
  slug: string
  displayName: string
  title: string | null
  bio: string | null
  photoPath: string | null
  isActive: boolean
  acceptsOnlineBooking: boolean
  sortOrder: number
  isDemo: boolean
  serviceIds: string[]
}

export async function listStylists(): Promise<AdminStylist[]> {
  const db = await createSessionClient()
  const { data } = await db
    .from('stylists')
    .select('id, slug, display_name, title, bio, photo_path, is_active, accepts_online_booking, sort_order, is_demo, stylist_services(service_id)')
    .order('sort_order')
    .order('display_name')
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    title: r.title,
    bio: r.bio,
    photoPath: r.photo_path,
    isActive: r.is_active,
    acceptsOnlineBooking: r.accepts_online_booking,
    sortOrder: r.sort_order,
    isDemo: r.is_demo,
    serviceIds: ((r.stylist_services as { service_id: string }[] | null) ?? []).map((s) => s.service_id),
  }))
}

export type AdminService = {
  id: string
  slug: string
  name: string
  summary: string | null
  description: string | null
  imagePath: string | null
  priceEtb: number
  priceType: 'fixed' | 'from'
  durationMin: number
  bufferMin: number | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  isDemo: boolean
  categoryId: string | null
  categoryName: string | null
}

export async function listServices(): Promise<AdminService[]> {
  const db = await createSessionClient()
  const { data } = await db
    .from('services')
    .select('id, slug, name, summary, description, image_path, price_etb, price_type, duration_min, buffer_min, is_active, is_featured, sort_order, is_demo, category_id, category:service_categories(name)')
    .order('sort_order')
    .order('name')
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    description: r.description,
    imagePath: r.image_path,
    priceEtb: r.price_etb,
    priceType: r.price_type,
    durationMin: r.duration_min,
    bufferMin: r.buffer_min,
    isActive: r.is_active,
    isFeatured: r.is_featured,
    sortOrder: r.sort_order,
    isDemo: r.is_demo,
    categoryId: r.category_id,
    categoryName: (r.category as { name?: string } | null)?.name ?? null,
  }))
}

export async function listCategories() {
  const db = await createSessionClient()
  const { data } = await db.from('service_categories').select('id, slug, name, description, sort_order').order('sort_order').order('name')
  return (data ?? []) as { id: string; slug: string; name: string; description: string | null; sort_order: number }[]
}

export async function dashboardSummary(from: string, to: string) {
  const db = await createSessionClient()
  const { data, error } = await db.rpc('dashboard_summary', { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return data as {
    total: number
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    no_show: number
    recorded_revenue_etb: number
    expected_revenue_etb: number
  }
}
