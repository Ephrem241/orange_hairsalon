/**
 * Create (or promote) the salon's first administrator.
 *
 *   npm run admin:create -- --email owner@example.com --name "Salon Owner"
 *   npm run admin:create -- --email owner@example.com --name "Salon Owner" --prod
 *
 * Runs the internal Convex function staff:bootstrapAdmin through the Convex CLI,
 * against the deployment in .env.local (CONVEX_DEPLOYMENT), or production with
 * --prod. A strong temporary password is generated and printed once — share it
 * privately and change it under Dashboard → Account after the first sign-in.
 * Pass --password to set one yourself (12+ characters).
 *
 * This is the only way to create the first admin: the app has no public sign-up.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    prod: { type: 'boolean', default: false },
  },
})

const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
  console.error('Usage: npm run admin:create -- --email owner@example.com --name "Salon Owner" [--prod]')
  process.exit(1)
}
if (values.password && (values.password.length < 12 || values.password.length > 128)) {
  console.error('Passwords must be 12–128 characters.')
  process.exit(1)
}

const password = values.password ?? randomBytes(12).toString('base64url')
const cli = join(process.cwd(), 'node_modules', 'convex', 'bin', 'main.js')
const args = [cli, 'run', ...(values.prod ? ['--prod'] : []), 'staff:bootstrapAdmin', JSON.stringify({ email, name, password })]

let output: string
try {
  output = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
} catch (error) {
  // On some Windows setups the CLI crashes on exit after the function has run;
  // what it printed is still the function's result.
  output = String((error as { stdout?: unknown }).stdout ?? '')
}
const result = output.match(/"created":\s*(true|false)/)
if (!result) {
  console.error('\nCould not create the administrator. Is the Convex deployment running and configured (see docs/SETUP.md)?')
  process.exit(1)
}
const created = result[1] === 'true'

console.log(created ? '\nAdministrator created.' : `\nExisting account found for ${email}; password reset and promoted to admin.`)
console.log(`  Email:    ${email}`)
console.log(`  Password: ${password}${values.password ? ' (as provided)' : '  ← temporary, shown once'}`)
console.log('\nSign in at /admin/login and change the password under Account.')
