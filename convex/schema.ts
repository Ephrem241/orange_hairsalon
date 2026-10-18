/**
 * Orange Salon — data model.
 *
 * Conventions:
 *   * Instants are epoch milliseconds. Salon calendar dates are "YYYY-MM-DD" and
 *     wall-clock times "HH:MM", both Africa/Addis_Ababa (UTC+3, no DST).
 *   * Optional fields are absent rather than null; the Next.js mappers turn
 *     them into null for the UI.
 *   * Rules the old Postgres CHECK constraints enforced live in lib/validate.ts
 *     and are applied by every mutation that writes the field.
 */
import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  appointmentEventValidator,
  appointmentStatusValidator,
  bookingSourceValidator,
  galleryMediaTypeValidator,
  gallerySourceValidator,
  notificationChannelValidator,
  notificationEventValidator,
  notificationStatusValidator,
  priceTypeValidator,
  reviewSourceValidator,
  socialsValidator,
  staffRoleValidator,
} from './lib/validators'

export default defineSchema({
  ...authTables,

  // Single document. Everything the public site shows about the salon.
  businessSettings: defineTable({
    name: v.string(),
    tagline: v.optional(v.string()),
    phone: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    email: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    city: v.string(),
    countryCode: v.string(),
    mapUrl: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    socials: socialsValidator,
    aboutStory: v.optional(v.string()),
    policyText: v.optional(v.string()),
    onlineBookingEnabled: v.boolean(),
    minLeadMinutes: v.number(),
    maxAdvanceDays: v.number(),
    slotIntervalMin: v.number(),
    defaultBufferMin: v.number(),
    cancelCutoffHours: v.number(),
    allowCustomerCancel: v.boolean(),
    allowCustomerReschedule: v.boolean(),
    autoConfirm: v.boolean(),
    requireEmail: v.boolean(),
    updatedAt: v.number(),
  }),

  // Single document. Staff-only notification preferences.
  notificationSettings: defineTable({
    emailEnabled: v.boolean(),
    whatsappEnabled: v.boolean(),
    salonAlertEmail: v.optional(v.string()),
    remindersEnabled: v.boolean(),
    updatedAt: v.number(),
  }),

  // Weekday follows Date#getUTCDay on the salon date: 0 = Sunday … 6 = Saturday.
  businessHours: defineTable({
    weekday: v.number(),
    isClosed: v.boolean(),
    opensAt: v.optional(v.string()),
    closesAt: v.optional(v.string()),
  }).index('by_weekday', ['weekday']),

  serviceCategories: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    isDemo: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_sortOrder', ['sortOrder']),

  services: defineTable({
    categoryId: v.optional(v.id('serviceCategories')),
    slug: v.string(),
    name: v.string(),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    imagePath: v.optional(v.string()),
    priceEtb: v.number(),
    priceType: priceTypeValidator,
    durationMin: v.number(),
    bufferMin: v.optional(v.number()),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
    isDemo: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_categoryId', ['categoryId'])
    .index('by_isActive_and_sortOrder', ['isActive', 'sortOrder'])
    .index('by_sortOrder', ['sortOrder']),

  stylists: defineTable({
    slug: v.string(),
    displayName: v.string(),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoPath: v.optional(v.string()),
    isActive: v.boolean(),
    acceptsOnlineBooking: v.boolean(),
    sortOrder: v.number(),
    isDemo: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_isActive_and_sortOrder', ['isActive', 'sortOrder'])
    .index('by_sortOrder', ['sortOrder']),

  // Private contact details, kept apart so public stylist reads can never expose them.
  stylistContacts: defineTable({
    stylistId: v.id('stylists'),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_stylistId', ['stylistId']),

  stylistServices: defineTable({
    stylistId: v.id('stylists'),
    serviceId: v.id('services'),
  })
    .index('by_stylistId_and_serviceId', ['stylistId', 'serviceId'])
    .index('by_serviceId', ['serviceId']),

  workingHours: defineTable({
    stylistId: v.id('stylists'),
    weekday: v.number(),
    startsAt: v.string(),
    endsAt: v.string(),
  }).index('by_stylistId_and_weekday', ['stylistId', 'weekday']),

  stylistBreaks: defineTable({
    stylistId: v.id('stylists'),
    weekday: v.number(),
    startsAt: v.string(),
    endsAt: v.string(),
    label: v.optional(v.string()),
  }).index('by_stylistId_and_weekday', ['stylistId', 'weekday']),

  // No stylistId = the whole salon is closed (public holidays, events).
  timeOff: defineTable({
    stylistId: v.optional(v.id('stylists')),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.optional(v.string()),
    createdBy: v.optional(v.id('users')),
  }).index('by_stylistId_and_endsAt', ['stylistId', 'endsAt']),

  customers: defineTable({
    fullName: v.string(),
    phoneE164: v.string(),
    email: v.optional(v.string()),
    staffNotes: v.optional(v.string()),
    isDemo: v.boolean(),
    // Name plus phone variants, for the dashboard's search box.
    searchText: v.string(),
    updatedAt: v.number(),
  })
    .index('by_phoneE164', ['phoneE164'])
    .searchIndex('search_text', { searchField: 'searchText' }),

  appointments: defineTable({
    reference: v.string(),
    serviceId: v.id('services'),
    stylistId: v.id('stylists'),
    customerId: v.id('customers'),
    status: appointmentStatusValidator,
    source: bookingSourceValidator,
    startsAt: v.number(),
    // Derived from duration and buffer by lib/appointments.ts on every write.
    endsAt: v.number(),
    blockedUntil: v.number(),
    // Snapshots, so later catalogue edits never rewrite booking history.
    serviceName: v.string(),
    priceEtb: v.number(),
    priceType: priceTypeValidator,
    durationMin: v.number(),
    bufferMin: v.number(),
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    customerNotes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    policyAcceptedAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
    cancelledBy: v.optional(v.union(v.literal('customer'), v.literal('staff'))),
    amountPaidEtb: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdBy: v.optional(v.id('users')),
    isDemo: v.boolean(),
    searchText: v.string(),
    updatedAt: v.number(),
  })
    .index('by_reference', ['reference'])
    .index('by_startsAt', ['startsAt'])
    .index('by_stylistId_and_startsAt', ['stylistId', 'startsAt'])
    .index('by_status_and_startsAt', ['status', 'startsAt'])
    .index('by_customerId_and_startsAt', ['customerId', 'startsAt'])
    .index('by_serviceId', ['serviceId'])
    .searchIndex('search_text', { searchField: 'searchText', filterFields: ['stylistId', 'status'] }),

  appointmentEvents: defineTable({
    appointmentId: v.id('appointments'),
    event: appointmentEventValidator,
    actorType: v.union(v.literal('customer'), v.literal('staff'), v.literal('system')),
    actorId: v.optional(v.id('users')),
    details: v.object({
      source: v.optional(v.string()),
      status: v.optional(v.string()),
      // Statuses for status changes; ISO instants for reschedules.
      from: v.optional(v.string()),
      to: v.optional(v.string()),
      fromStylistId: v.optional(v.id('stylists')),
      toStylistId: v.optional(v.id('stylists')),
      reason: v.optional(v.string()),
      amountPaidEtb: v.optional(v.number()),
    }),
  }).index('by_appointmentId', ['appointmentId']),

  // mediaPath / posterPath / beforePath hold either a Convex storage id or a
  // site-relative path ("/images/…") for assets shipped with the app.
  galleryItems: defineTable({
    mediaType: galleryMediaTypeValidator,
    mediaPath: v.string(),
    posterPath: v.optional(v.string()),
    beforePath: v.optional(v.string()),
    caption: v.optional(v.string()),
    altText: v.string(),
    category: v.string(),
    source: gallerySourceValidator,
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    isFeatured: v.boolean(),
    isPublished: v.boolean(),
    sortOrder: v.number(),
    updatedAt: v.number(),
  })
    .index('by_sortOrder', ['sortOrder'])
    .index('by_isPublished_and_sortOrder', ['isPublished', 'sortOrder']),

  // Verified reviews only: each carries its source so it can be traced.
  reviews: defineTable({
    authorName: v.string(),
    rating: v.optional(v.number()),
    body: v.string(),
    source: reviewSourceValidator,
    sourceUrl: v.optional(v.string()),
    reviewedOn: v.optional(v.string()),
    isPublished: v.boolean(),
    sortOrder: v.number(),
    updatedAt: v.number(),
  })
    .index('by_sortOrder', ['sortOrder'])
    .index('by_isPublished_and_sortOrder', ['isPublished', 'sortOrder']),

  contactMessages: defineTable({
    fullName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    message: v.string(),
    status: v.union(v.literal('new'), v.literal('read'), v.literal('archived')),
  }).index('by_status', ['status']),

  // Dashboard access. A sign-in account without an active profile has no access.
  staffProfiles: defineTable({
    userId: v.id('users'),
    fullName: v.string(),
    email: v.string(),
    role: staffRoleValidator,
    stylistId: v.optional(v.id('stylists')),
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_email', ['email'])
    .index('by_stylistId', ['stylistId'])
    .index('by_role_and_isActive', ['role', 'isActive']),

  notificationLog: defineTable({
    appointmentId: v.optional(v.id('appointments')),
    event: notificationEventValidator,
    channel: notificationChannelValidator,
    recipient: v.string(),
    status: notificationStatusValidator,
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
    // Prevents sending the same message twice (e.g. a reminder on a cron retry).
    dedupeKey: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_appointmentId', ['appointmentId'])
    .index('by_dedupeKey', ['dedupeKey'])
    .index('by_status', ['status']),

  auditEvents: defineTable({
    actorId: v.optional(v.id('users')),
    actorRole: v.optional(v.string()),
    action: v.union(v.literal('insert'), v.literal('update'), v.literal('delete')),
    entity: v.string(),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
  }),

  // Fixed-window counters. Keys are salted hashes made by the Next.js server.
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    hits: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_windowStart', ['windowStart']),
})
