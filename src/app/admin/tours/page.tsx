// Панель управления экскурсиями: вкладки (Активные/Черновики/Архив),
// поиск, сортировка и действия (добавить/копировать/публиковать/архив/восстановить/удалить).
import Link from "next/link";
import type { TourStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { getAdminTours, getStatusCounts, type AdminSort } from "@/data/admin-tours";
import { categories } from "@/data/types";
import {
  createTour, copyTour, publishTour, unpublishTour, archiveTour, restoreTour, deleteTour,
} from "@/lib/tour-actions";
import { DangerButton } from "@/components/admin/danger-button";
import {
  Plus, Copy, Archive, ArchiveRestore, Trash2, Send, EyeOff, ExternalLink, Search,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "active", label: "Активные", status: "PUBLISHED" as TourStatus },
  { key: "drafts", label: "Черновики", status: "DRAFT" as TourStatus },
  { key: "archive", label: "Архив", status: "ARCHIVED" as TourStatus },
];

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2";

export default async function AdminToursPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; sort?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;

  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const q = sp.q ?? "";
  const sort = (["updated", "title", "price"].includes(sp.sort ?? "") ? sp.sort : "updated") as AdminSort;

  const [tours, counts] = await Promise.all([
    getAdminTours({ status: tab.status, q, sort }),
    getStatusCounts(),
  ]);

  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(d);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Заголовок + добавить */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Экскурсии</h1>
        <form action={createTour}>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Добавить экскурсию
          </button>
        </form>
      </div>

      {/* Вкладки */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/admin/tours?tab=${t.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-primary text-white" : "border border-hairline text-ink hover:bg-surface-2"
              }`}
            >
              {t.label} <span className={active ? "text-white/80" : "text-muted"}>({counts[t.status]})</span>
            </Link>
          );
        })}
      </div>

      {/* Поиск + сортировка (GET-форма) */}
      <form method="get" action="/admin/tours" className="mb-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={tab.key} />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Поиск по названию или адресу…"
            className="w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="updated">Сначала обновлённые</option>
          <option value="title">По названию (А-Я)</option>
          <option value="price">По цене (возр.)</option>
        </select>
        <button className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2">
          Применить
        </button>
        {(q || sort !== "updated") && (
          <Link href={`/admin/tours?tab=${tab.key}`} className="text-sm text-muted hover:text-ink">
            Сбросить
          </Link>
        )}
      </form>

      {/* Список */}
      {tours.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
          {q ? "Ничего не найдено." : "Здесь пока пусто."}
        </div>
      ) : (
        <ul className="space-y-2">
          {tours.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface p-3"
            >
              {/* Мини-обложка */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-display text-lg font-bold text-primary">
                {t.title.charAt(0)}
              </div>

              {/* Инфо */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{t.title}</p>
                <p className="truncate text-xs text-muted">
                  /{t.slug} · {catLabel(t.category)} · {t.adultPrice} {t.priceSuffix} · обновлено {fmtDate(t.updatedAt)}
                  {t.authorName ? ` · ${t.authorName}` : ""}
                </p>
              </div>

              {/* Действия */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/tours/${t.slug}`} target="_blank" className={btn}>
                  <ExternalLink className="h-3.5 w-3.5" /> Открыть
                </Link>

                {/* Копировать — доступно всем */}
                <form action={copyTour}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className={btn}><Copy className="h-3.5 w-3.5" /> Копировать</button>
                </form>

                {isAdmin && tab.status === "PUBLISHED" && (
                  <form action={unpublishTour}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className={btn}><EyeOff className="h-3.5 w-3.5" /> Снять</button>
                  </form>
                )}

                {isAdmin && tab.status !== "PUBLISHED" && (
                  <form action={publishTour}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className={`${btn} text-success`}><Send className="h-3.5 w-3.5" /> Опубликовать</button>
                  </form>
                )}

                {isAdmin && tab.status !== "ARCHIVED" && (
                  <form action={archiveTour}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className={btn}><Archive className="h-3.5 w-3.5" /> В архив</button>
                  </form>
                )}

                {isAdmin && tab.status === "ARCHIVED" && (
                  <form action={restoreTour}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className={btn}><ArchiveRestore className="h-3.5 w-3.5" /> Восстановить</button>
                  </form>
                )}

                {isAdmin && (
                  <form action={deleteTour}>
                    <input type="hidden" name="id" value={t.id} />
                    <DangerButton
                      confirmText={`Удалить навсегда «${t.title}»? Это действие необратимо.`}
                      className={`${btn} text-error`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                    </DangerButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
