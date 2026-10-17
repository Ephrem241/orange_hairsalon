import 'server-only'
import { NextResponse } from 'next/server'
import type { AppError } from '@/lib/booking/errors'

/** Consistent JSON error envelope for the public API. */
export function errorResponse(error: AppError, fields?: Record<string, string>) {
  return NextResponse.json({ error: { code: error.code, message: error.message, ...(fields ? { fields } : {}) } }, { status: error.status })
}

export function validationResponse(fields: Record<string, string>) {
  const message = Object.values(fields)[0] ?? 'Please check the highlighted fields.'
  return NextResponse.json({ error: { code: 'VALIDATION', message, fields } }, { status: 422 })
}

/** Parse a JSON body without throwing on malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
