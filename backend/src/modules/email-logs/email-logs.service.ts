import { prisma } from "../../config/prisma";

export async function listForUser(userId: string, limit = 50, offset = 0) {
  const [items, total] = await Promise.all([
    prisma.emailLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        to_email: true,
        subject: true,
        email_type: true,
        status: true,
        error: true,
        created_at: true
      }
    }),
    prisma.emailLog.count({ where: { user_id: userId } })
  ]);
  return { items, total };
}

export async function statsForUser(userId: string) {
  const rows = await prisma.emailLog.groupBy({
    by: ["email_type", "status"],
    where: { user_id: userId },
    _count: { id: true }
  });
  const total = rows.reduce((sum, r) => sum + r._count.id, 0);
  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  for (const r of rows) {
    by_type[r.email_type] = (by_type[r.email_type] ?? 0) + r._count.id;
    by_status[r.status] = (by_status[r.status] ?? 0) + r._count.id;
  }
  return { total, by_type, by_status };
}

export async function listAll(limit = 100, offset = 0, status?: string) {
  const where = status ? { status: status as any } : {};
  const [items, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        user_id: true,
        to_email: true,
        subject: true,
        email_type: true,
        status: true,
        error: true,
        created_at: true,
        user: { select: { full_name: true, profile_photo_url: true } }
      }
    }),
    prisma.emailLog.count({ where })
  ]);
  return { items, total };
}

export async function globalStats() {
  const rows = await prisma.emailLog.groupBy({
    by: ["email_type", "status"],
    _count: { id: true }
  });
  const total = rows.reduce((sum, r) => sum + r._count.id, 0);
  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  for (const r of rows) {
    by_type[r.email_type] = (by_type[r.email_type] ?? 0) + r._count.id;
    by_status[r.status] = (by_status[r.status] ?? 0) + r._count.id;
  }
  return { total, by_type, by_status };
}
