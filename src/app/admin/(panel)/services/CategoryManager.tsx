'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/Button'
import { deleteCategory, saveCategory } from './actions'

type Category = { id: string; name: string; description: string; sortOrder: number }

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const run = (fn: () => ReturnType<typeof saveCategory>, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) {
        toast.success(r.message)
        after?.()
      } else toast.error(r.error)
    })

  return (
    <Card title="Categories">
      <ul className="space-y-2">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              aria-label={`Category name ${i + 1}`}
              defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(() => saveCategory({ ...c, name: e.target.value }))}
              className="h-9 flex-1 rounded-sm border border-charcoal/15 px-2 text-sm"
            />
            <button type="button" aria-label={`Delete ${c.name}`} disabled={pending} onClick={() => confirm(`Delete “${c.name}”? Services keep their details but lose this category.`) && run(() => deleteCategory(c.id))} className="inline-flex size-9 items-center justify-center rounded-sm text-taupe-700 hover:bg-red-50 hover:text-red-700">
              <Trash2 aria-hidden className="size-4" />
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="text-sm text-taupe-700">No categories yet.</li>}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) run(() => saveCategory({ id: null, name, description: '', sortOrder: (categories.length + 1) * 10 }), () => setName(''))
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" aria-label="New category name" className="h-9 flex-1 rounded-sm border border-charcoal/15 px-2 text-sm" />
        <Button type="submit" variant="dark" size="sm" disabled={pending || !name.trim()}>Add</Button>
      </form>
    </Card>
  )
}
