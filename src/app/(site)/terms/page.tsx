import type { Metadata } from 'next'
import { PageHero } from '@/components/site/PageHero'
import { getSettings } from '@/lib/data/public'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Booking Terms',
  description: 'How online booking, confirmation, changes and cancellations work at Orange Salon.',
  path: '/terms',
})

export default async function TermsPage() {
  const s = await getSettings()
  const leadHours = Math.round(s.minLeadMinutes / 60)
  return (
    <>
      <PageHero compact eyebrow="Booking terms" title="How booking works" />
      <article className="bg-ivory py-16 md:py-24">
        <div className="container-x max-w-3xl space-y-10 leading-relaxed text-taupe-700 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-charcoal">
          {s.policyText && (
            <section>
              <h2>Our booking policy</h2>
              <p className="mt-3 whitespace-pre-line">{s.policyText}</p>
            </section>
          )}
          <section>
            <h2>Requests and confirmation</h2>
            <p className="mt-3">
              {s.autoConfirm
                ? 'Online bookings are confirmed immediately when you complete them.'
                : 'An online booking is a request until our team confirms it. Your confirmation page and booking reference show the current status.'}{' '}
              Online booking is available from {leadHours > 0 ? `${leadHours} hour${leadHours === 1 ? '' : 's'}` : 'shortly'} ahead up to{' '}
              {s.maxAdvanceDays} days in advance.
            </p>
          </section>
          <section>
            <h2>Changes and cancellations</h2>
            <p className="mt-3">
              {s.allowCustomerCancel || s.allowCustomerReschedule
                ? `You can ${[s.allowCustomerReschedule && 'move', s.allowCustomerCancel && 'cancel'].filter(Boolean).join(' or ')} your appointment online up to ${s.cancelCutoffHours} hours before it starts, using your booking reference and phone number. A moved appointment is reviewed again by our team.`
                : 'To change or cancel an appointment, please call the salon.'}{' '}
              Closer to the time, please call us.
            </p>
          </section>
          <section>
            <h2>Prices and payment</h2>
            <p className="mt-3">
              Prices are shown in Ethiopian birr (ETB). Prices marked “from” depend on hair length and thickness and are confirmed
              at your consultation. Payment is made at the salon; no payment is taken online.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
