'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { ArrowLeft, Check, Clock, Pencil, Sparkles, UserRound } from 'lucide-react'
import { DemoBadge } from '@/components/site/DemoBadge'
import { Button } from '@/components/ui/Button'
import { Field, Honeypot, TextArea, TextInput } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { formatDuration, formatEtb, initials } from '@/lib/format'
import { addDays, formatDateLong, formatIsoDate, formatTime, isIsoDate, salonDate } from '@/lib/time'
import type { Service, Stylist } from '@/lib/types'
import { bookingRequestSchema, fieldErrors } from '@/lib/validation'
import { Calendar } from './Calendar'
import { TimeSlots } from './TimeSlots'
import { apiFetch, useBookableDays, useSlots } from './useAvailability'

export type WizardSettings = {
  requireEmail: boolean
  maxAdvanceDays: number
  minLeadMinutes: number
  policyText: string | null
  cancelCutoffHours: number
  autoConfirm: boolean
}

const STEPS = ['Service', 'Stylist', 'Date & time', 'Your details', 'Review'] as const

type Details = { fullName: string; phone: string; email: string; notes: string; policyAccepted: boolean; website: string }
const emptyDetails: Details = { fullName: '', phone: '', email: '', notes: '', policyAccepted: false, website: '' }

export function BookingWizard({ services, stylists, settings }: { services: Service[]; stylists: Stylist[]; settings: WizardSettings }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const topRef = useRef<HTMLDivElement>(null)

  const service = services.find((s) => s.slug === params.get('service')) ?? null
  const eligible = useMemo(() => (service ? stylists.filter((s) => s.serviceIds.includes(service.id)) : []), [service, stylists])
  const stylistParam = params.get('stylist')
  const stylist = stylistParam === 'any' ? 'any' : (eligible.find((s) => s.slug === stylistParam) ?? null)
  const dateParam = params.get('date')
  const date = isIsoDate(dateParam) ? dateParam : null
  const time = params.get('time')

  const [stage, setStage] = useState<'details' | 'review'>('details')
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [slotsReload, setSlotsReload] = useState(0)

  const step = !service ? 0 : !stylist ? 1 : !date || !time ? 2 : stage === 'details' ? 3 : 4

  // URL holds the selections (shareable, survives refresh, Back works); personal details never enter the URL.
  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    router.push(`${pathname}?${next}`, { scroll: false })
  }

  // Bring the wizard back into view whenever the step changes.
  const lastStep = useRef(step)
  useEffect(() => {
    if (lastStep.current === step) return
    lastStep.current = step
    topRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [step, reduceMotion])

  // Calendar window: today (salon time) → today + max advance.
  const today = salonDate()
  const maxDate = addDays(today, settings.maxAdvanceDays)
  const [month, setMonth] = useState(() => {
    const [y, m] = (date ?? today).split('-').map(Number)
    return { year: y, monthIndex: m - 1 }
  })
  const monthStart = `${month.year}-${String(month.monthIndex + 1).padStart(2, '0')}-01`
  const monthEnd = addDays(month.monthIndex === 11 ? `${month.year + 1}-01-01` : `${month.year}-${String(month.monthIndex + 2).padStart(2, '0')}-01`, -1)
  const stylistKey = stylist === 'any' ? 'any' : (stylist?.id ?? null)
  const { days, error: daysError } = useBookableDays(
    step >= 2 ? (service?.id ?? null) : null,
    stylistKey,
    monthStart < today ? today : monthStart,
    monthEnd > maxDate ? maxDate : monthEnd,
  )
  const slotsUrl = step >= 2 && service && stylistKey && date ? `/api/booking/availability?service=${service.id}&stylist=${stylistKey}&date=${date}` : null
  const { slots, loading: slotsLoading, error: slotsError } = useSlots(slotsUrl, slotsReload)

  const continueToReview = () => {
    const candidate = { serviceId: service!.id, stylistId: stylist === 'any' ? null : stylist!.id, startsAt: time, ...details }
    const parsed = bookingRequestSchema.safeParse(candidate)
    const found = parsed.success ? {} : fieldErrors(parsed.error)
    if (settings.requireEmail && !details.email.trim()) found.email = 'Please add your email address.'
    setErrors(found)
    if (Object.keys(found).length === 0) setStage('review')
    else document.getElementById(`field-${Object.keys(found)[0]}`)?.focus()
  }

  const submit = async () => {
    setSubmitting(true)
    const result = await apiFetch<{ booking: { reference: string } }>('/api/booking', {
      method: 'POST',
      body: JSON.stringify({ serviceId: service!.id, stylistId: stylist === 'any' ? null : stylist!.id, startsAt: time, ...details }),
    })
    if (result.data) {
      router.push(`/booking/confirmation/${result.data.booking.reference}`)
      return
    }
    setSubmitting(false)
    const { code, message, fields } = result.error
    if (code === 'SLOT_TAKEN' || code === 'SLOT_UNAVAILABLE' || code === 'TOO_SOON') {
      toast.error('That time is no longer available', { description: 'We’ve refreshed the times — please choose another.' })
      setStage('details')
      setSlotsReload((n) => n + 1)
      go({ time: null })
    } else if (fields) {
      setErrors(fields)
      setStage('details')
    } else {
      toast.error(message)
    }
  }

  const motionProps = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <div ref={topRef} className={cn('scroll-mt-28 grid gap-10 lg:gap-14', service && 'lg:grid-cols-[1fr_22rem]')}>
      <div>
        <Progress step={step} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...motionProps} className="mt-10">
            {step === 0 && <ServiceStep services={services} onSelect={(s) => go({ service: s.slug, stylist: null, date: null, time: null })} />}

            {step === 1 && service && (
              <StylistStep
                stylists={eligible}
                onSelect={(slug) => go({ stylist: slug, date: null, time: null })}
                onBack={() => go({ service: null, stylist: null })}
              />
            )}

            {step === 2 && service && (
              <section aria-labelledby="step-title">
                <StepTitle onBack={() => go({ stylist: null, date: null, time: null })}>Choose a date and time</StepTitle>
                <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <Calendar
                      month={month}
                      onMonthChange={setMonth}
                      minDate={today}
                      maxDate={maxDate}
                      bookable={days}
                      selected={date}
                      onSelect={(d) => go({ date: d, time: null })}
                    />
                    {daysError && <p role="alert" className="mt-3 text-sm text-red-700">{daysError}</p>}
                    {days && days.size === 0 && !daysError && (
                      <p className="mt-3 text-sm text-taupe-700">No availability this month — try the next month.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl">{date ? formatIsoDate(date) : 'Available times'}</h3>
                    <p className="mt-1 mb-5 text-xs text-taupe-700">Times shown in Addis Ababa time.</p>
                    <TimeSlots
                      slots={date ? slots : null}
                      loading={slotsLoading}
                      error={slotsError}
                      selected={time}
                      onSelect={(iso) => {
                        setStage('details')
                        go({ time: iso })
                      }}
                      onRetry={() => setSlotsReload((n) => n + 1)}
                    />
                  </div>
                </div>
              </section>
            )}

            {step === 3 && (
              <DetailsStep
                details={details}
                errors={errors}
                requireEmail={settings.requireEmail}
                policyText={settings.policyText}
                onChange={(patch) => setDetails((d) => ({ ...d, ...patch }))}
                onBack={() => go({ time: null })}
                onContinue={continueToReview}
              />
            )}

            {step === 4 && service && time && (
              <section aria-labelledby="step-title">
                <StepTitle onBack={() => setStage('details')}>Review and request</StepTitle>
                <dl className="mt-8 divide-y divide-charcoal/10 rounded-sm border border-charcoal/10 bg-white">
                  <ReviewRow label="Service" value={service.name} onEdit={() => go({ service: null, stylist: null, date: null, time: null })} />
                  <ReviewRow label="Stylist" value={stylist === 'any' ? 'Any available stylist' : (stylist as Stylist).displayName} onEdit={() => go({ stylist: null, date: null, time: null })} />
                  <ReviewRow label="Date & time" value={`${formatDateLong(time)} at ${formatTime(time)}`} onEdit={() => go({ time: null })} />
                  <ReviewRow label="Duration" value={formatDuration(service.durationMin)} />
                  <ReviewRow label="Price" value={`${formatEtb(service.priceEtb, service.priceType)} · paid at the salon`} />
                  <ReviewRow
                    label="Your details"
                    value={[details.fullName, details.phone, details.email].filter(Boolean).join(' · ')}
                    onEdit={() => setStage('details')}
                  />
                  {details.notes && <ReviewRow label="Notes" value={details.notes} />}
                </dl>
                <p className="mt-6 rounded-sm bg-ivory-200 p-4 text-sm text-taupe-700">
                  {settings.autoConfirm
                    ? 'Your appointment will be confirmed straight away.'
                    : 'This sends a booking request. Your appointment is confirmed once our team reviews it — we’ll contact you if anything needs to change.'}
                </p>
                <Button size="lg" arrow className="mt-8 w-full sm:w-auto" onClick={submit} disabled={submitting} aria-busy={submitting}>
                  {submitting ? 'Sending your request…' : settings.autoConfirm ? 'Confirm booking' : 'Request appointment'}
                </Button>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Summary service={service} stylist={stylist} time={step >= 3 ? time : null} />
    </div>
  )
}

function Progress({ step }: { step: number }) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:gap-3">
        {STEPS.map((label, i) => (
          <li key={label} className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors',
                i === step ? 'bg-charcoal text-ivory' : i < step ? 'text-charcoal' : 'text-taupe-700/70',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[0.625rem] font-semibold',
                  i < step ? 'bg-gold text-charcoal' : i === step ? 'bg-ivory text-charcoal' : 'border border-current',
                )}
              >
                {i < step ? <Check aria-hidden className="size-3" /> : i + 1}
              </span>
              <span className={cn(i !== step && 'hidden sm:inline')}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className="h-px w-4 bg-charcoal/15 sm:w-6" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function StepTitle({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div>
      {onBack && (
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-taupe-700 hover:text-charcoal">
          <ArrowLeft aria-hidden className="size-4" /> Back
        </button>
      )}
      <h2 id="step-title" className="display text-3xl md:text-4xl">
        {children}
      </h2>
    </div>
  )
}

function ServiceStep({ services, onSelect }: { services: Service[]; onSelect: (s: Service) => void }) {
  return (
    <section aria-labelledby="step-title">
      <StepTitle>Choose a service</StepTitle>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="group flex w-full gap-4 rounded-sm border border-charcoal/10 bg-white p-3 text-left transition-[border-color,box-shadow] duration-300 hover:border-gold-600 hover:shadow-[0_14px_30px_-20px_rgba(23,21,19,0.5)]"
            >
              <span className="relative size-24 shrink-0 overflow-hidden rounded-sm bg-ivory-300">
                {s.imagePath && <Image src={s.imagePath} alt="" fill sizes="96px" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col py-1">
                <span className="flex items-center gap-2">
                  <span className="font-serif text-lg leading-tight text-charcoal">{s.name}</span>
                  {s.isDemo && <DemoBadge />}
                </span>
                {s.summary && <span className="mt-1 line-clamp-2 text-xs text-taupe-700">{s.summary}</span>}
                <span className="mt-auto flex items-center gap-3 pt-2 text-sm">
                  <span className="font-medium">{formatEtb(s.priceEtb, s.priceType)}</span>
                  <span className="inline-flex items-center gap-1 text-taupe-700">
                    <Clock aria-hidden className="size-3.5" /> {formatDuration(s.durationMin)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StylistStep({ stylists, onSelect, onBack }: { stylists: Stylist[]; onSelect: (slug: string) => void; onBack: () => void }) {
  if (stylists.length === 0) {
    return (
      <section aria-labelledby="step-title">
        <StepTitle onBack={onBack}>Choose a stylist</StepTitle>
        <p className="mt-6 max-w-lg text-taupe-700">
          This service can’t be booked online right now. Please choose another service or call the salon.
        </p>
      </section>
    )
  }
  const option =
    'flex w-full items-center gap-4 rounded-sm border border-charcoal/10 bg-white p-4 text-left transition-colors duration-300 hover:border-gold-600'
  return (
    <section aria-labelledby="step-title">
      <StepTitle onBack={onBack}>Choose a stylist</StepTitle>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <button type="button" onClick={() => onSelect('any')} className={cn(option, 'border-gold/50 bg-gold/5')}>
            <span className="flex size-14 items-center justify-center rounded-full bg-charcoal text-gold">
              <Sparkles aria-hidden className="size-6" />
            </span>
            <span>
              <span className="block font-serif text-lg">Any available stylist</span>
              <span className="text-sm text-taupe-700">The most choice of times — we’ll match you with a specialist.</span>
            </span>
          </button>
        </li>
        {stylists.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onSelect(s.slug)} className={option}>
              <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal-700 font-serif text-lg text-gold">
                {s.photoPath ? <Image src={s.photoPath} alt="" fill sizes="56px" className="object-cover" /> : initials(s.displayName)}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-serif text-lg">
                  {s.displayName} {s.isDemo && <DemoBadge />}
                </span>
                {s.title && <span className="text-sm text-taupe-700">{s.title}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DetailsStep({
  details, errors, requireEmail, policyText, onChange, onBack, onContinue,
}: {
  details: Details
  errors: Record<string, string>
  requireEmail: boolean
  policyText: string | null
  onChange: (patch: Partial<Details>) => void
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <section aria-labelledby="step-title">
      <StepTitle onBack={onBack}>Your details</StepTitle>
      <p className="mt-3 text-sm text-taupe-700">No account needed. We’ll use these details only to manage your appointment.</p>
      <form
        noValidate
        className="relative mt-8 grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          onContinue()
        }}
      >
        <Honeypot value={details.website} onChange={(website) => onChange({ website })} />
        <Field id="field-fullName" label="Full name" error={errors.fullName} className="sm:col-span-2">
          {({ id, describedBy }) => (
            <TextInput id={id} name="name" autoComplete="name" value={details.fullName} error={errors.fullName}
              aria-describedby={describedBy} onChange={(e) => onChange({ fullName: e.target.value })} />
          )}
        </Field>
        <Field id="field-phone" label="Phone number" hint="We’ll call or message this number about your booking." error={errors.phone}>
          {({ id, describedBy }) => (
            <TextInput id={id} type="tel" name="tel" autoComplete="tel" inputMode="tel" placeholder="0912 345 678" value={details.phone}
              error={errors.phone} aria-describedby={describedBy} onChange={(e) => onChange({ phone: e.target.value })} />
          )}
        </Field>
        <Field id="field-email" label="Email" optional={!requireEmail} hint="For your confirmation and reminders." error={errors.email}>
          {({ id, describedBy }) => (
            <TextInput id={id} type="email" name="email" autoComplete="email" value={details.email} error={errors.email}
              aria-describedby={describedBy} onChange={(e) => onChange({ email: e.target.value })} />
          )}
        </Field>
        <Field id="field-notes" label="Notes for your stylist" optional hint="Hair length, inspiration, allergies…" error={errors.notes} className="sm:col-span-2">
          {({ id, describedBy }) => (
            <TextArea id={id} name="notes" maxLength={1000} value={details.notes} error={errors.notes} aria-describedby={describedBy}
              onChange={(e) => onChange({ notes: e.target.value })} />
          )}
        </Field>
        <div className="sm:col-span-2">
          {policyText && (
            <details className="mb-4 rounded-sm border border-charcoal/10 bg-white p-4 text-sm text-taupe-700 [&_summary]:cursor-pointer">
              <summary className="font-medium text-charcoal">Booking policy</summary>
              <p className="mt-3 leading-relaxed whitespace-pre-line">{policyText}</p>
              <Link href="/terms" className="mt-3 inline-block text-gold-700 underline underline-offset-4">
                Full booking terms
              </Link>
            </details>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              id="field-policyAccepted"
              type="checkbox"
              checked={details.policyAccepted}
              onChange={(e) => onChange({ policyAccepted: e.target.checked })}
              aria-invalid={errors.policyAccepted ? true : undefined}
              aria-describedby={errors.policyAccepted ? 'policy-error' : undefined}
              className="mt-0.5 size-5 shrink-0 accent-[#171513]"
            />
            <span>I have read and accept the booking policy.</span>
          </label>
          {errors.policyAccepted && (
            <p id="policy-error" role="alert" className="mt-1.5 text-sm text-red-700">
              {errors.policyAccepted}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" arrow>
            Review booking
          </Button>
        </div>
      </form>
    </section>
  )
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <dt className="text-xs tracking-wide text-taupe-700 uppercase">{label}</dt>
        <dd className="mt-1 break-words text-charcoal">{value}</dd>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="inline-flex shrink-0 items-center gap-1 text-xs text-gold-700 hover:underline">
          <Pencil aria-hidden className="size-3" /> Change<span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      )}
    </div>
  )
}

function Summary({ service, stylist, time }: { service: Service | null; stylist: Stylist | 'any' | null; time: string | null }) {
  if (!service) return null
  return (
    <aside aria-label="Your booking" className="lg:sticky lg:top-28 lg:self-start">
      <div className="overflow-hidden rounded-sm bg-charcoal text-ivory">
        {service.imagePath && (
          <div className="relative hidden aspect-[16/10] lg:block">
            <Image src={service.imagePath} alt="" fill sizes="22rem" className="object-cover opacity-80" />
          </div>
        )}
        <div className="space-y-4 p-6">
          <p className="eyebrow text-gold">Your booking</p>
          <div>
            <p className="font-serif text-2xl">{service.name}</p>
            <p className="mt-1 text-sm text-ivory/70">
              {formatEtb(service.priceEtb, service.priceType)} · {formatDuration(service.durationMin)}
            </p>
          </div>
          {stylist && (
            <p className="flex items-center gap-2 text-sm text-ivory/80">
              <UserRound aria-hidden className="size-4 text-gold" />
              {stylist === 'any' ? 'Any available stylist' : stylist.displayName}
            </p>
          )}
          {time && (
            <p className="flex items-center gap-2 text-sm text-ivory/80">
              <Clock aria-hidden className="size-4 text-gold" />
              {formatDateLong(time)}, {formatTime(time)}
            </p>
          )}
          <p className="border-t border-ivory/10 pt-4 text-xs text-ivory/55">Payment is taken at the salon. No card needed to book.</p>
        </div>
      </div>
    </aside>
  )
}
