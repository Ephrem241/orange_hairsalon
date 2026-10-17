/** Domain types shared by the public site, booking flow and dashboard. */

export type PriceType = 'fixed' | 'from'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type BookingSource = 'online' | 'phone' | 'walk_in'
export type StaffRole = 'admin' | 'receptionist' | 'stylist'

export type Socials = Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'telegram', string>>

export type BusinessSettings = {
  name: string
  tagline: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  addressLine: string | null
  city: string
  countryCode: string
  mapUrl: string | null
  latitude: number | null
  longitude: number | null
  socials: Socials
  aboutStory: string | null
  policyText: string | null
  onlineBookingEnabled: boolean
  minLeadMinutes: number
  maxAdvanceDays: number
  slotIntervalMin: number
  defaultBufferMin: number
  cancelCutoffHours: number
  allowCustomerCancel: boolean
  allowCustomerReschedule: boolean
  autoConfirm: boolean
  requireEmail: boolean
}

export type BusinessHours = { weekday: number; isClosed: boolean; opensAt: string | null; closesAt: string | null }

export type ServiceCategory = { id: string; slug: string; name: string; description: string | null; sortOrder: number }

export type Service = {
  id: string
  slug: string
  name: string
  summary: string | null
  description: string | null
  imagePath: string | null
  priceEtb: number
  priceType: PriceType
  durationMin: number
  bufferMin: number | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  isDemo: boolean
  category: { id: string; slug: string; name: string } | null
}

export type Stylist = {
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

export type GalleryItem = {
  id: string
  mediaType: 'image' | 'video'
  mediaPath: string
  posterPath: string | null
  beforePath: string | null
  caption: string | null
  altText: string
  category: string
  source: 'salon' | 'illustrative'
  width: number | null
  height: number | null
  isFeatured: boolean
  isPublished: boolean
  sortOrder: number
}

export type Review = {
  id: string
  authorName: string
  rating: number | null
  body: string
  source: 'google' | 'tripadvisor' | 'facebook' | 'instagram' | 'in_person' | 'other'
  sourceUrl: string | null
  reviewedOn: string | null
}

/** What the booking API returns after a successful request. */
export type BookingResult = {
  appointmentId: string
  reference: string
  status: AppointmentStatus
  stylistId: string
  startsAt: string
  endsAt: string
}

/** The customer-facing view of an appointment (no internal fields). */
export type CustomerBooking = {
  reference: string
  status: AppointmentStatus
  serviceId: string
  serviceName: string
  stylistName: string | null
  startsAt: string
  endsAt: string
  durationMin: number
  priceEtb: number
  priceType: PriceType
  customerName: string
  canCancel: boolean
  canReschedule: boolean
  changeDeadline: string
}
