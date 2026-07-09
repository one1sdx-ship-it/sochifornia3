// Запрос журнала изменений (кто / что / когда).
import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export type AuditRow = {
  id: string;
  action: AuditAction;
  tourTitle: string;
  tourId: string | null;
  summary: string;
  createdAt: Date;
  userName: string | null;
};

export async function getAuditLog(opts: { limit?: number; action?: AuditAction } = {}): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: opts.action ? { action: opts.action } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
    select: {
      id: true,
      action: true,
      tourTitle: true,
      tourId: true,
      summary: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    tourTitle: r.tourTitle,
    tourId: r.tourId,
    summary: r.summary,
    createdAt: r.createdAt,
    userName: r.user?.name ?? r.user?.email ?? null,
  }));
}
