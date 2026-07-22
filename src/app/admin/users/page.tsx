// Админка «Пользователи»: все клиенты, вошедшие по номеру телефона. Только ADMIN.
import Link from "next/link";
import { Heart, Star, User } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getCustomers } from "@/data/admin-customers";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function AdminUsersPage() {
  await requireAdmin();
  const customers = await getCustomers();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">
          Пользователи <span className="text-muted">({customers.length})</span>
        </h1>
        <Link href="/admin/tours" className="text-sm text-primary hover:underline">← К экскурсиям</Link>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
          Пока никто не входил по номеру телефона.
        </div>
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-hairline bg-surface p-3"
            >
              {/* Аватар */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>

              {/* Имя + телефон */}
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{c.name || "Без имени"}</p>
                <p className="text-sm text-muted">{c.phone}</p>
              </div>

              {/* Счётчики */}
              <div className="flex items-center gap-4 text-sm text-body">
                <span className="inline-flex items-center gap-1" title="Отзывов">
                  <Star className="h-4 w-4 text-gold" /> {c.reviewsCount}
                </span>
                <span className="inline-flex items-center gap-1" title="В избранном">
                  <Heart className="h-4 w-4 text-error" /> {c.favoritesCount}
                </span>
              </div>

              {/* Дата регистрации/первого входа */}
              <span className="ml-auto whitespace-nowrap text-xs text-muted">{fmtDate(c.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
