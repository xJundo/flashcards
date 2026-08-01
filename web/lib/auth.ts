import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // No SMTP is configured, so a forgotten password is a manual reset for now.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    // `name` is the public handle shown next to a lesson; the email never is.
    changeEmail: { enabled: false },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Must stay last: it lets server actions set the session cookie.
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
