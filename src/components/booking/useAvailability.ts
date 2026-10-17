'use client'

import { useEffect, useState } from 'react'
import type { IsoDate } from '@/lib/time'
import type { Slot } from './TimeSlots'

export type ApiError = { code: string; message: string; fields?: Record<string, string> }

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    const response = await fetch(input, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      return { data: null, error: body?.error ?? { code: 'NETWORK', message: 'Something went wrong. Please try again.' } }
    }
    return { data: body as T, error: null }
  } catch {
    return { data: null, error: { code: 'NETWORK', message: 'We couldn’t reach the salon’s booking system. Check your connection and try again.' } }
  }
}

/** Dates with availability in [from, to] for a service + stylist ("any" allowed). */
export function useBookableDays(serviceId: string | null, stylist: string | null, from: IsoDate, to: IsoDate) {
  const [state, setState] = useState<{ key: string; days: Set<IsoDate> | null; error: string | null }>({ key: '', days: null, error: null })
  const key = serviceId && stylist ? `${serviceId}|${stylist}|${from}|${to}` : ''

  useEffect(() => {
    if (!key) return
    let cancelled = false
    apiFetch<{ days: string[] }>(`/api/booking/availability?service=${serviceId}&stylist=${stylist}&from=${from}&to=${to}`).then((result) => {
      if (cancelled) return
      setState({ key, days: result.data ? new Set(result.data.days) : new Set(), error: result.error?.message ?? null })
    })
    return () => {
      cancelled = true
    }
  }, [key, serviceId, stylist, from, to])

  return state.key === key ? { days: state.days, error: state.error } : { days: null, error: null }
}

/** Bookable start times for one date. `reloadToken` forces a fresh fetch (e.g. after a slot was taken). */
export function useSlots(url: string | null, reloadToken: number) {
  const [state, setState] = useState<{ key: string; slots: Slot[] | null; error: string | null }>({ key: '', slots: null, error: null })
  const key = url ? `${url}#${reloadToken}` : ''

  useEffect(() => {
    if (!url) return
    let cancelled = false
    apiFetch<{ slots: Slot[] }>(url).then((result) => {
      if (cancelled) return
      setState({ key, slots: result.data?.slots ?? null, error: result.error?.message ?? null })
    })
    return () => {
      cancelled = true
    }
  }, [key, url])

  const loading = Boolean(url) && state.key !== key
  return { slots: loading ? null : state.slots, error: loading ? null : state.error, loading }
}
