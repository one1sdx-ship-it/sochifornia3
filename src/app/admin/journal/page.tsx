// Журнал изменений — кто, что и когда менял. Доступ только у ADMIN.
import Link from "next/link";
import type { AuditAction } from "@prisma/client";
import { requireAdmin } from "@/lib/session";
import { getAuditLog } from "@/data/audit";

export const dynamic = "force-dynamic";

// Подписи и цвета действий.
const ACTIONS: Record<AuditAction, { label: string; cls: string }> = {
  CREATE: { label: "Создание", cls: "bg-primary/10 text-primary" },
  UPDATE: { label: "Изменение", cls: "bg-surface-2 text-ink" },
  PUBLISH: { label: "Публикация", cls: "bg-success/10 text-success" },
  ARCHIVE: { label: "В архив", cls: "bg-gold/20 text-black/70" },
  RESTORE: { label: "Восстановление", cls: "bg-primary/10 text-primary" },
  COPY: { label: "Копия", cls: "bg-surface-2 text-ink" },
  DELETE: { label: "Удаление", cls: "bg-error/10 text-error" },
};

const FILTERS: { key: string; label: string; action?: AuditAction }[] = [
  { key: "all", label: "Все" },
  { key: "UPDATE", label: "Изменения", action: "UPDATE" },
  { key: "CREATE", label: "Создание", action: "CREATE" },
  { key: "PUBLISH", label: "Публикация", action: "PUBLISH" },
  { key: "ARCHIVE", label: "Архив", action: "ARCHIVE" },
  { key: "DELETE", label: "Удаление", action: "DELETE" },
];

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const current = FILTERS.find((f) => f.key === sp.action) ?? FILTERS[0];
  const rows = await getAuditLog({ action: current.action, limit: 300 });

  const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(d);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Журнал изменений</h1>
        <Link href="/admin/tours" className="text-sm text-primary hover:underline">← К экскурсиям</Link>
      </div>

      {/* Фильтр по типу действия */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/journal?action=${f.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              f.key === current.key ? "bg-primary text-white" : "border border-hairline text-ink hover:bg-surface-2"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
          Записей пока нет.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const a = ACTIONS[r.action];
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-hairline bg-surface p-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.cls}`}>{a.label}</span>
                <span className="font-medium text-ink">{r.tourTitle || "—"}</span>
                <span className="text-sm text-body">{r.summary}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-muted">
                  {r.userName ?? "—"} · {fmt(r.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
