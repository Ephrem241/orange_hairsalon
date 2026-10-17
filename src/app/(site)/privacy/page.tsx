import type { Metadata } from 'next'
import { PageHero } from '@/components/site/PageHero'
import { getSettings } from '@/lib/data/public'
import { formatPhone } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Privacy',
  description: 'How Orange Salon handles the personal information you share when booking or contacting us.',
  path: '/privacy',
})

export default async function PrivacyPage() {
  const settings = await getSettings()
  return (
    <>
      <PageHero compact eyebrow="Privacy" title="Your information" />
      <article className="bg-ivory py-16 md:py-24">
        <div className="container-x max-w-3xl space-y-10 leading-relaxed text-taupe-700 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-charcoal">
          <section>
            <h2>What we collect</h2>
            <p className="mt-3">
              When you request an appointment we keep your name, phone number, optional email address, any notes you add, and the
              details of your appointment. When you use our contact form we keep your message and the contact details you give us.
            </p>
          </section>
          <section>
            <h2>How we use it</h2>
            <p className="mt-3">
              Only to manage your appointments and reply to you — for example confirmations, changes and reminders. We do not sell
              your information or use it for advertising. Payment is taken in person; we never ask for card details online.
            </p>
          </section>
          <section>
            <h2>Cookies</h2>
            <p className="mt-3">
              We use one short-lived, encrypted cookie so you can view or change a booking for 30 minutes after booking or after
              confirming your phone number. Staff accounts use a sign-in cookie. We do not use advertising or analytics cookies.
              The map on our site loads from Google only when you choose to show it.
            </p>
          </section>
          <section>
            <h2>Your choices</h2>
            <p className="mt-3">
              To see, correct or delete the information we hold about you, contact the salon
              {settings.phone ? ` on ${formatPhone(settings.phone)}` : ''}
              {settings.email ? ` or at ${settings.email}` : ''}.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
