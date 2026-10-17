/**
 * Create (or promote) the salon's first administrator.
 *
 *   npm run admin:create -- --email owner@example.com --name "Salon Owner"
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local. A
 * strong temporary password is generated and printed once — share it privately
 * and change it under Dashboard → Account after the first sign-in. Pass
 * --password to set one yourself (12+ characters).
 *
 * This is the only way to create the first admin: the app has no public sign-up.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
  },
})

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()

if (!url || !secret) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.')
  process.exit(1)
}
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
  console.error('Usage: npm run admin:create -- --email owner@example.com --name "Salon Owner"')
  process.exit(1)
}
if (values.password && values.password.length < 12) {
  console.error('Passwords must be at least 12 characters.')
  process.exit(1)
}

const password = values.password ?? randomBytes(12).toString('base64url')
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })

async function findUser(address: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => u.email?.toLowerCase() === address)
    if (user || data.users.length < 200) return user ?? null
  }
  return null
}

const existing = await findUser(email)
let userId: string
if (existing) {
  userId = existing.id
  const { error } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true })
  if (error) throw error
  console.log(`Existing account found for ${email}; password reset and promoting to admin.`)
} else {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
  if (error || !data.user) throw error ?? new Error('Could not create user')
  userId = data.user.id
}

const { error: profileError } = await db
  .from('profiles')
  .upsert({ id: userId, full_name: name, email, role: 'admin', stylist_id: null, is_active: true })
if (profileError) throw profileError

console.log('\nAdministrator ready.')
console.log(`  Email:    ${email}`)
console.log(`  Password: ${password}${values.password ? ' (as provided)' : '  ← temporary, shown once'}`)
console.log('\nSign in at /admin/login and change the password under Account.')
