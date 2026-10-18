import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Appointment reminders stay on the Vercel cron (/api/cron/reminders), which
// sends them through the Next.js notification providers.
crons.interval('prune rate limits', { hours: 1 }, internal.rateLimit.prune, {})

export default crons
