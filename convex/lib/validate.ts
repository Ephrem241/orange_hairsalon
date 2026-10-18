/**
 * Field rules that the Postgres CHECK constraints used to enforce. Mutations
 * call these before writing; a violation throws INVALID_INPUT with the field
 * name as detail. Forms validate first with zod, so these are the backstop.
 */
import { fail } from './errors'

export const PHONE_E164 = /^\+[1-9][0-9]{7,14}$/
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const REFERENCE = /^OS-[2-9A-HJKMNP-Z]{6}$/

/** Trimmed text within limits; empty becomes undefined when optional. */
export function text(field: string, value: string | undefined, opts: { max: number; min?: number; required: true }): string
export function text(field: string, value: string | undefined, opts: { max: number; min?: number; required?: false }): string | undefined
export function text(field: string, value: string | undefined, opts: { max: number; min?: number; required?: boolean }) {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') {
    if (opts.required) fail('INVALID_INPUT', field)
    return undefined
  }
  if (trimmed.length < (opts.min ?? 1) || trimmed.length > opts.max) fail('INVALID_INPUT', field)
  return trimmed
}

export function matches(field: string, value: string | undefined, pattern: RegExp): string | undefined {
  if (value === undefined || value === '') return undefined
  if (!pattern.test(value)) fail('INVALID_INPUT', field)
  return value
}

export const optionalEmail = (field: string, value: string | undefined) =>
  matches(field, value?.trim().toLowerCase(), EMAIL)

export const optionalPhone = (field: string, value: string | undefined) => matches(field, value?.trim(), PHONE_E164)

export const optionalHttps = (field: string, value: string | undefined) =>
  matches(field, value?.trim(), /^https:\/\/\S+$/)

export function integer(field: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) fail('INVALID_INPUT', field)
  return value
}

export function slug(field: string, value: string): string {
  if (!SLUG.test(value)) fail('INVALID_INPUT', field)
  return value
}

export function timeRange(startsAt: string, endsAt: string): void {
  if (!HHMM.test(startsAt) || !HHMM.test(endsAt) || startsAt >= endsAt) fail('INVALID_SCHEDULE')
}

/** Staff passwords: 12–128 characters. */
export function checkPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) fail('WEAK_PASSWORD')
}
