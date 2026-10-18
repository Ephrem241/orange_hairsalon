import 'server-only'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import { staffQuery } from '@/lib/convex/server'
import { iso } from '@/lib/data/mappers'
import type { AppointmentStatus } from '@/lib/types'

/*
 * Dashboard reads. Every call carries the signed-in staff member's token, so
 * Convex decides what each role can see (a stylist only ever receives their
 * own appointments, whatever the filters say).
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

type AppointmentRow = FunctionReturnType<typeof api.appointments.list>[number]

function mapAppointment(r: AppointmentRow): AdminAppointment {
  return {
    id: r._id,
    reference: r.reference,
    status: r.status,
    source: r.source,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    stylistId: r.stylistId,
    stylistName: r.stylistName,
    customerId: r.customerId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail ?? null,
    customerNotes: r.customerNotes ?? null,
    internalNotes: r.internalNotes ?? null,
    priceEtb: r.priceEtb,
    priceType: r.priceType,
    durationMin: r.durationMin,
    bufferMin: r.bufferMin,
    amountPaidEtb: r.amountPaidEtb ?? null,
    cancelReason: r.cancelReason ?? null,
    cancelledBy: r.cancelledBy ?? null,
    createdAt: iso(r._creationTime),
  }
}

export type AppointmentFilters = {
  /** ISO instants */
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

export async function listAppointments(filters: AppointmentFilters = {}): Promise<AdminAppointment[]> {
  const rows = await staffQuery(api.appointments.list, {
    from: filters.from ? Date.parse(filters.from) : undefined,
    to: filters.to ? Date.parse(filters.to) : undefined,
    status: filters.status,
    stylistId: filters.stylistId as Id<'stylists'> | undefined,
    serviceId: filters.serviceId as Id<'services'> | undefined,
    customerId: filters.customerId as Id<'customers'> | undefined,
    q: filters.q,
    limit: filters.limit,
    ascending: filters.ascending,
  })
  return rows.map(mapAppointment)
}

export async function getAppointment(id: string) {
  const detail = await staffQuery(api.appointments.get, { id: id as Id<'appointments'> })
  if (!detail) return null
  return {
    appointment: mapAppointment(detail.appointment),
    events: detail.events.map((e) => ({ id: e._id, event: e.event, actorType: e.actorType, details: e.details, createdAt: iso(e._creationTime) })),
    notifications: detail.notifications.map((n) => ({
      id: n._id,
      event: n.event,
      channel: n.channel,
      recipient: n.recipient,
      status: n.status,
      error: n.error ?? null,
      createdAt: iso(n._creationTime),
      sentAt: n.sentAt ? iso(n.sentAt) : null,
    })),
  }
}

export type AdminStylist = {
  id: string
  slug: string
  displayName: string
  title: string | null
  bio: string | null
  /** Stored reference (for forms) and its displayable URL. */
  photoPath: string | null
  photoUrl: string | null
  isActive: boolean
  acceptsOnlineBooking: boolean
  sortOrder: number
  isDemo: boolean
  serviceIds: string[]
}

export async function listStylists(): Promise<AdminStylist[]> {
  const rows = await staffQuery(api.stylists.list, {})
  return rows.map((r) => ({
    id: r._id,
    slug: r.slug,
    displayName: r.displayName,
    title: r.title ?? null,
    bio: r.bio ?? null,
    photoPath: r.photoPath ?? null,
    photoUrl: r.photoUrl ?? null,
    isActive: r.isActive,
    acceptsOnlineBooking: r.acceptsOnlineBooking,
    sortOrder: r.sortOrder,
    isDemo: r.isDemo,
    serviceIds: r.serviceIds,
  }))
}

export type AdminService = {
  id: string
  slug: string
  name: string
  summary: string | null
  description: string | null
  /** Stored reference (for forms) and its displayable URL. */
  imagePath: string | null
  imageUrl: string | null
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
  const rows = await staffQuery(api.catalog.listServices, {})
  return rows.map((r) => ({
    id: r._id,
    slug: r.slug,
    name: r.name,
    summary: r.summary ?? null,
    description: r.description ?? null,
    imagePath: r.imagePath ?? null,
    imageUrl: r.imageUrl ?? null,
    priceEtb: r.priceEtb,
    priceType: r.priceType,
    durationMin: r.durationMin,
    bufferMin: r.bufferMin ?? null,
    isActive: r.isActive,
    isFeatured: r.isFeatured,
    sortOrder: r.sortOrder,
    isDemo: r.isDemo,
    categoryId: r.categoryId ?? null,
    categoryName: r.categoryName,
  }))
}

export async function listCategories() {
  const rows = await staffQuery(api.catalog.listCategories, {})
  return rows.map((c) => ({ id: c._id, slug: c.slug, name: c.name, description: c.description ?? null, sortOrder: c.sortOrder }))
}

export async function dashboardSummary(from: string, to: string) {
  return await staffQuery(api.appointments.summary, { from: Date.parse(from), to: Date.parse(to) })
}

/** Upcoming time off (ends after now), mapped for display. */
export async function upcomingTimeOff(scope?: string | 'salon') {
  const rows = await staffQuery(api.stylists.upcomingTimeOff, {
    from: Date.now(),
    scope: scope as Id<'stylists'> | 'salon' | undefined,
  })
  return rows.map((t) => ({ id: t._id, stylistId: t.stylistId ?? null, startsAt: iso(t.startsAt), endsAt: iso(t.endsAt), reason: t.reason ?? null }))
}
