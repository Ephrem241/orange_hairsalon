/** Shared value validators (the enum types of the old Postgres schema). */
import { v, type Infer } from 'convex/values'

export const staffRoleValidator = v.union(v.literal('admin'), v.literal('receptionist'), v.literal('stylist'))
export type StaffRole = Infer<typeof staffRoleValidator>

export const appointmentStatusValidator = v.union(
  v.literal('pending'),
  v.literal('confirmed'),
  v.literal('completed'),
  v.literal('cancelled'),
  v.literal('no_show'),
)
export type AppointmentStatus = Infer<typeof appointmentStatusValidator>

export const bookingSourceValidator = v.union(v.literal('online'), v.literal('phone'), v.literal('walk_in'))
export type BookingSource = Infer<typeof bookingSourceValidator>

export const appointmentEventValidator = v.union(
  v.literal('created'),
  v.literal('confirmed'),
  v.literal('rejected'),
  v.literal('cancelled'),
  v.literal('rescheduled'),
  v.literal('completed'),
  v.literal('no_show'),
)

export const priceTypeValidator = v.union(v.literal('fixed'), v.literal('from'))

export const notificationChannelValidator = v.union(v.literal('email'), v.literal('whatsapp'))
export const notificationStatusValidator = v.union(
  v.literal('pending'),
  v.literal('sent'),
  v.literal('failed'),
  v.literal('skipped'),
)
export const notificationEventValidator = v.union(
  v.literal('requested'),
  v.literal('confirmed'),
  v.literal('rescheduled'),
  v.literal('cancelled'),
  v.literal('reminder'),
  v.literal('salon_alert'),
)

export const galleryMediaTypeValidator = v.union(v.literal('image'), v.literal('video'))
export const gallerySourceValidator = v.union(v.literal('salon'), v.literal('illustrative'))

export const reviewSourceValidator = v.union(
  v.literal('google'),
  v.literal('tripadvisor'),
  v.literal('facebook'),
  v.literal('instagram'),
  v.literal('in_person'),
  v.literal('other'),
)

export const socialsValidator = v.object({
  instagram: v.optional(v.string()),
  facebook: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  youtube: v.optional(v.string()),
  telegram: v.optional(v.string()),
})

/** Live appointments occupy the diary; the rest are history. */
export const LIVE_STATUSES = ['pending', 'confirmed'] as const satisfies readonly AppointmentStatus[]
export const isLive = (status: AppointmentStatus) => status === 'pending' || status === 'confirmed'
