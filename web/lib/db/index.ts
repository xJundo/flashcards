import "server-only"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/lib/db/schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL n'est pas défini")

/**
 * Next reloads modules on every edit in development, so the pool is stashed on
 * `globalThis` — otherwise each reload would leak a fresh set of connections.
 */
const globalForDb = globalThis as { pool?: Pool }

export const pool = (globalForDb.pool ??= new Pool({ connectionString: url }))

export const db = drizzle(pool, { schema })
