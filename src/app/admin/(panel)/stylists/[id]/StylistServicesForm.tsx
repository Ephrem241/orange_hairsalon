'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { setStylistServices } from '../actions'

export function StylistServicesForm({ stylistId, selected, services }: { stylistId: string; selected: string[]; services: { id: string; name: string; isActive: boolean }[] }) {
  const [chosen, setChosen] = useState(new Set(selected))
  const [pending, start] = useTransition()
  if (services.length === 0) return <p className="text-sm text-taupe-700">Add services first.</p>
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[#171513]" />
              {s.name}
              {!s.isActive && <span className="text-xs text-taupe-700">(hidden)</span>}
            </label>
          </li>
        ))}
      </ul>
      <Button
        variant="dark"
        size="sm"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setStylistServices(stylistId, [...chosen])
            if (r.ok) toast.success(r.message)
            else toast.error(r.error)
          })
        }
      >
        Save services
      </Button>
    </div>
  )
}
