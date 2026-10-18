/**
 * One-time environment setup for a Convex deployment:
 *
 *   npm run convex:env                                          (development deployment in .env.local)
 *   npm run convex:env -- --prod --site-url https://orangesalon.et
 *
 * Sets on the deployment:
 *   JWT_PRIVATE_KEY, JWKS  — Convex Auth's token signing keys (new pair each run)
 *   SITE_URL               — the website's URL
 *   CONVEX_SERVER_SECRET   — shared with the Next.js server (see .env.example)
 *
 * For development it also appends any missing local secrets to .env.local
 * (CONVEX_SERVER_SECRET, BOOKING_COOKIE_SECRET, RATE_LIMIT_SALT, CRON_SECRET).
 * For production it prints nothing secret: copy CONVEX_SERVER_SECRET from the
 * Convex dashboard (Settings → Environment Variables) into Vercel yourself.
 *
 * Running it again rotates the keys, which signs every staff member out.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose'

const { values } = parseArgs({
  options: {
    prod: { type: 'boolean', default: false },
    'site-url': { type: 'string', default: 'http://localhost:3000' },
  },
})

const cli = join(process.cwd(), 'node_modules', 'convex', 'bin', 'main.js')

function setEnv(name, value) {
  try {
    // NAME=VALUE form: the private key starts with "-----", which would read as a flag.
    execFileSync(process.execPath, [cli, 'env', 'set', ...(values.prod ? ['--prod'] : []), `${name}=${value}`], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
  } catch (error) {
    // On some Windows setups the CLI crashes on exit after succeeding; check what it said.
    const stderr = String(error.stderr ?? '')
    if (!stderr.includes('Successfully set')) {
      console.error(stderr)
      throw new Error(`Could not set ${name}. Is the deployment running (npx convex dev)?`)
    }
  }
  console.log(`✔ ${name} set on the ${values.prod ? 'production' : 'development'} deployment`)
}

const keys = await generateKeyPair('RS256', { extractable: true })
const serverSecret = randomBytes(32).toString('base64url')

setEnv('JWT_PRIVATE_KEY', (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' '))
setEnv('JWKS', JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] }))
setEnv('SITE_URL', values['site-url'])
setEnv('CONVEX_SERVER_SECRET', serverSecret)

if (values.prod) {
  console.log('\nNow copy CONVEX_SERVER_SECRET from the Convex dashboard into Vercel (Production).')
} else {
  const envFile = join(process.cwd(), '.env.local')
  const current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
  const local = {
    CONVEX_SERVER_SECRET: serverSecret,
    BOOKING_COOKIE_SECRET: randomBytes(32).toString('base64url'),
    RATE_LIMIT_SALT: randomBytes(16).toString('base64url'),
    CRON_SECRET: randomBytes(24).toString('base64url'),
  }
  // The server secret must always match the deployment; the others are kept if present.
  const lines = Object.entries(local).filter(([name]) => name === 'CONVEX_SERVER_SECRET' || !new RegExp(`^${name}=`, 'm').test(current))
  // Keep exactly one CONVEX_SERVER_SECRET line.
  const kept = current.replace(/^CONVEX_SERVER_SECRET=.*\n?/m, '')
  if (kept !== current) writeFileSync(envFile, kept)
  appendFileSync(envFile, `\n# Local development secrets (npm run convex:env)\n${lines.map(([n, v]) => `${n}=${v}`).join('\n')}\n`)
  console.log(`✔ .env.local updated (${lines.map(([n]) => n).join(', ')})`)
}
