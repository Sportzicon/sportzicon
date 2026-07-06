// Best-effort recovery for the `prisma migrate deploy` P1002 advisory-lock
// timeout caused by a stale connection left holding the migration lock
// (e.g. Supavisor session-mode pooler not tearing down a backend cleanly
// after a previous migrate run). Only terminates IDLE sessions holding an
// advisory lock — never a session that's actively doing something.
// Never throws in a way that fails the caller: this is a best-effort clear,
// the CI script retries migrate deploy afterward regardless of outcome.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stale = await prisma.$queryRawUnsafe<Array<{ pid: number }>>(
    `SELECT DISTINCT pg_locks.pid
     FROM pg_locks
     JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
     WHERE pg_locks.locktype = 'advisory'
       AND pg_locks.granted = true
       AND pg_stat_activity.state = 'idle'
       AND pg_locks.pid <> pg_backend_pid()`
  );

  if (stale.length === 0) {
    console.log("No idle sessions holding an advisory lock — nothing to clear.");
    return;
  }

  for (const { pid } of stale) {
    try {
      await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${pid})`);
      console.log(`Terminated stale idle session holding advisory lock: pid ${pid}`);
    } catch (err) {
      console.warn(`Could not terminate pid ${pid} (may lack privilege or already gone):`, err);
    }
  }
}

main()
  .catch((err) => {
    console.warn("clear-stale-migration-lock: best-effort cleanup failed, continuing anyway:", err);
  })
  .finally(() => prisma.$disconnect());
