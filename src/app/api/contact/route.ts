import { api } from '@convex/_generated/api'
import { NextResponse } from 'next/server'
import { errorResponse, readJson, validationResponse } from '@/lib/api'
import { appError, toAppError } from '@/lib/booking/errors'
import { allowRequest, clientIp } from '@/lib/security/rate-limit'
import { isServerDataConfigured, serverMutation } from '@/lib/convex/server'
import { contactSchema, fieldErrors } from '@/lib/validation'

/** POST /api/contact — store a message for the front desk (visible in /admin/messages). */
export async function POST(request: Request) {
  if (!isServerDataConfigured) {
    return errorResponse({ code: 'NOT_CONFIGURED', status: 503, message: 'Our message form isn’t available right now — please call or visit us.' })
  }
  const parsed = contactSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error)
    return validationResponse(fields.website ? { form: 'Please check your message and try again.' } : fields)
  }
  if (!(await allowRequest('contact:ip', clientIp(request.headers), 5, 3600))) return errorResponse(appError('RATE_LIMITED'))

  const { fullName, phone, email, message } = parsed.data
  try {
    await serverMutation(api.content.submitMessage, { fullName, phone, email, message })
  } catch (error) {
    return errorResponse(toAppError(error))
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
