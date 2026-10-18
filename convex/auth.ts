/**
 * Staff sign-in (email + password) via Convex Auth.
 *
 * There is no public sign-up: accounts are created only by an admin (see
 * staff.ts → createStaff) or by the bootstrap command. The provider refuses
 * every flow except signIn, and an account without an active staffProfiles row
 * still has no dashboard access.
 */
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import { checkPassword } from './lib/validate'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow !== 'signIn') throw new ConvexError({ code: 'FORBIDDEN' })
        return { email: String(params.email ?? '').trim().toLowerCase() }
      },
      validatePasswordRequirements: checkPassword,
    }),
  ],
})
