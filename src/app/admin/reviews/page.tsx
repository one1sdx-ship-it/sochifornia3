// Админка «Отзывы»: модерация отзывов клиентов. Только ADMIN.
// Режимы: «Все отзывы» и «N экскурсия» (с выбором тура).
// Группы: Правки (правки ранее опубликованных) / Активные (PUBLISHED) / Черновик (DRAFT) / Архив (ARCHIVED).
// «Правки» появляются слева от «Активные» только когда такие отзывы есть.
// Действия: Опубликовать / Снять / В архив / Удалить (Удалить — только в архиве).
import Link from "next/link";
import { Star } from "lucide-react";
import type { ReviewStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/session";
import { getAdminReviews, getReviewCounts, getToursForReviewFilter } from "@/data/admin-reviews";
import { TourFilterSelect } from "@/components/admin/reviews/tour-filter-select";
import { AddReviewButton } from "@/components/admin/reviews/add-review-button";
import { ReviewHistory } from "@/components/admin/reviews/review-history";
import { ReviewPhotos } from "@/components/review-photos";
import {
  publishReview, unpublishReview, archiveReview, deleteReview, createReviewManual,
} from "@/lib/review-actions";

export const dynamic = "force-dynamic";

// Группа (вкладка) ↔ фильтр в БД. pendingEdit разделяет «Правки» и свежий «Черновик».
type Group = { key: string; label: string; status: ReviewStatus; pendingEdit?: boolean };
const GROUPS: Group[] = [
  { key: "edits", label: "Правки", status: "DRAFT", pendingEdit: true },
  { key: "active", label: "Активные", status: "PUBLISHED" },
  { key: "draft", label: "Черновик", status: "DRAFT", pendingEdit: false },
  { key: "archive", label: "Архив", status: "ARCHIVED" },
];

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; tourId?: string; status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const scope = sp.scope === "tour" ? "tour" : "all";
  const tourId = scope === "tour" ? sp.tourId || "" : "";
  // По умолчанию открываем «Черновик» — очередь на модерацию.
  const group = GROUPS.find((g) => g.key === sp.status) ?? GROUPS.find((g) => g.key === "draft")!;

  const tours = await getToursForReviewFilter();
  // Счётчики и список — в текущей области (все либо выбранный тур).
  const counts = await getReviewCounts(scope === "tour" ? tourId || "__none__" : null);
  const needTour = scope === "tour" && !tourId;
  const reviews = needTour
    ? []
    : await getAdminReviews({ status: group.status, tourId: tourId || null, pendingEdit: group.pendingEdit });

  // Число для бейджа вкладки.
  const groupCount = (g: Group) =>
    g.key === "edits" ? counts.edits : counts[g.status];

  // «Правки» показываем только если такие отзывы есть (или вкладка сейчас открыта).
  const visibleGroups = GROUPS.filter((g) => g.key !== "edits" || counts.edits > 0 || group.key === "edits");

  // Ссылка на вкладку группы с сохранением области.
  const groupHref = (key: string) =>
    scope === "tour"
      ? `/admin/reviews?scope=tour&tourId=${tourId}&status=${key}`
      : `/admin/reviews?scope=all&status=${key}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Отзывы</h1>
        <AddReviewButton tours={tours} action={createReviewManual} />
      </div>

      {/* Две компактные кнопки: Все отзывы / N экскурсия */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/admin/reviews?scope=all&status=${group.key}`}
          className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold transition-colors ${
            scope === "all"
              ? "border-primary bg-primary text-white"
              : "border-hairline bg-surface text-ink hover:bg-surface-2"
          }`}
        >
          Все отзывы
        </Link>
        <Link
          href={`/admin/reviews?scope=tour&status=${group.key}${tourId ? `&tourId=${tourId}` : ""}`}
          className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold transition-colors ${
            scope === "tour"
              ? "border-primary bg-primary text-white"
              : "border-hairline bg-surface text-ink hover:bg-surface-2"
          }`}
        >
          N экскурсия
        </Link>
      </div>

      {/* Выбор экскурсии — только в режиме «N экскурсия» */}
      {scope === "tour" && (
        <div className="mt-3">
          <TourFilterSelect tours={tours} value={tourId} status={group.key} />
        </div>
      )}

      {/* Вкладки групп со счётчиками */}
      <div className="mt-5 flex flex-wrap gap-2">
        {visibleGroups.map((g) => (
          <Link
            key={g.key}
            href={groupHref(g.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              g.key === group.key
                ? "bg-primary text-white"
                : "border border-hairline text-ink hover:bg-surface-2"
            }`}
          >
            {g.label}
            <span className={`ml-1.5 ${g.key === group.key ? "text-white/80" : "text-muted"}`}>
              {groupCount(g)}
            </span>
          </Link>
        ))}
      </div>

      {/* Список */}
      <div className="mt-5 space-y-3">
        {needTour ? (
          <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
            Выберите экскурсию выше, чтобы увидеть её отзывы.
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
            В этой группе отзывов нет.
          </div>
        ) : (
          reviews.map((r) => (
            <article key={r.id} className="rounded-xl border border-hairline bg-surface p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* Оценка — прижата к левому краю */}
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={i < r.rating ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4 text-hairline"}
                    />
                  ))}
                </span>
                {/* Иконка часов истории — слева, если отзыв правился клиентом (ревизий > 1) */}
                {r.revisions.length > 1 && <ReviewHistory revisions={r.revisions} author={r.authorName} />}
                {/* Имя + телефон — прижаты к правому краю */}
                <span className="ml-auto flex items-center gap-3">
                  <span className="font-semibold text-ink">{r.authorName}</span>
                  {r.phone && <span className="text-sm text-muted">{r.phone}</span>}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted">{fmtDate(r.publishedAt ?? r.createdAt)}</p>
              <p className="mt-1 text-sm text-primary">{r.tourTitle}</p>
              <p className="mt-2 whitespace-pre-line text-[15px] text-body">{r.text}</p>

              {/* Фото — клик открывает полноэкранный просмотрщик (зум/свайп/лента), как на странице экскурсии */}
              <ReviewPhotos photos={r.photos} title={r.tourTitle} />

              {/* Действия — зависят от группы, прижаты к правому краю */}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {r.status === "DRAFT" && (
                  <>
                    <ActionButton id={r.id} action={publishReview} label="Опубликовать" variant="primary" />
                    <ActionButton id={r.id} action={archiveReview} label="В архив" variant="muted" />
                  </>
                )}
                {r.status === "PUBLISHED" && (
                  <>
                    <ActionButton id={r.id} action={unpublishReview} label="Снять" variant="muted" />
                    <ActionButton id={r.id} action={archiveReview} label="В архив" variant="muted" />
                  </>
                )}
                {r.status === "ARCHIVED" && (
                  <>
                    <ActionButton id={r.id} action={publishReview} label="Опубликовать" variant="primary" />
                    <ActionButton id={r.id} action={deleteReview} label="Удалить" variant="danger" />
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-6">
        <Link href="/admin/tours" className="text-sm text-primary hover:underline">← К экскурсиям</Link>
      </div>
    </main>
  );
}

// Кнопка-действие: маленькая форма, вызывающая server action с id отзыва.
function ActionButton({
  id,
  action,
  label,
  variant,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
  variant: "primary" | "muted" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-white hover:opacity-90"
      : variant === "danger"
        ? "border border-error/40 text-error hover:bg-error/5"
        : "border border-hairline text-ink hover:bg-surface-2";
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${cls}`}>
        {label}
      </button>
    </form>
  );
}
