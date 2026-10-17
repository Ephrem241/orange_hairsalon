/** Minimal RFC 5545 calendar event for "Add to calendar". */
export function buildIcs(event: {
  uid: string
  start: string
  end: string
  summary: string
  location?: string
  description?: string
  now?: Date
}): string {
  const stamp = (iso: string | Date) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orange Salon//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(event.now ?? new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escape(event.summary)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escape(event.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
