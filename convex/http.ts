import { httpRouter } from 'convex/server'
import { auth } from './auth'

const http = httpRouter()

// JWKS and OpenID discovery endpoints used to verify Convex Auth tokens.
auth.addHttpRoutes(http)

export default http
