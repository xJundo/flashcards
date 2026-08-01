/**
 * Applies pending migrations once, when the server boots — the container has no
 * separate release step, so this is the only hook that runs before traffic.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const [{ migrate }, { db }] = await Promise.all([
    import("drizzle-orm/node-postgres/migrator"),
    import("@/lib/db"),
  ])

  await migrate(db, { migrationsFolder: "./drizzle" })
}
