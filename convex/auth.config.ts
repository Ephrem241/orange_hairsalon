// Registers this deployment as the issuer of Convex Auth tokens. Without it,
// sign-in succeeds but every request is treated as signed out.
const authConfig = {
  providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: 'convex' }],
}

export default authConfig
