// Серверные действия админки над отзывами: публикация / снятие / архив / удаление.
// Только ADMIN (модерация). Каждое действие пишется в журнал (AuditLog) и пересчитывает
// рейтинг связанного тура.
"use server";
import { revalidatePath } from "next/cache";
import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { recomputeTourRating } from "@/data/reviews-db";

function assertAdmin(user: CurrentUser) {
  if (user.role !== "ADMIN") {
    throw new Error("Недостаточно прав: модерация отзывов доступна только администратору");
  }
}

// Запись в журнал (в контексте тура отзыва, если он есть).
async function writeLog(
  action: AuditAction,
  user: CurrentUser,
  tour: { id: string; title: string } | null,
  summary: string,
) {
  await prisma.auditLog.create({
    data: {
      action,
      userId: user.id,
      tourId: tour?.id ?? null,
      tourTitle: tour?.title ?? "",
      summary,
    },
  });
}

// Сброс кеша страниц, где отзывы видны.
function revalidateAll(tourSlug?: string | null) {
  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  revalidatePath("/");
  if (tourSlug) revalidatePath(`/tours/${tourSlug}`);
}

// Общая загрузка отзыва + его тура (для лога, пересчёта и revalidate).
async function loadReview(id: string) {
  return prisma.review.findUnique({
    where: { id },
    select: {
      id: true,
      authorName: true,
      tourId: true,
      tour: { select: { id: true, title: true, slug: true } },
    },
  });
}

// ── Опубликовать (черновик/архив → активные) ─────────────────────────
export async function publishReview(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const r = await loadReview(id);
  if (!r) return;
  await prisma.review.update({
    where: { id },
    // hadPublished запоминаем навсегда, pendingEdit гасим — правка отмодерирована.
    data: { status: "PUBLISHED", publishedAt: new Date(), archivedAt: null, hadPublished: true, pendingEdit: false },
  });
  await writeLog("PUBLISH", user, r.tour, `Отзыв опубликован: «${r.authorName}»`);
  if (r.tourId) await recomputeTourRating(r.tourId);
  revalidateAll(r.tour?.slug);
}

// ── Снять с публикации (активные → черновик) ─────────────────────────
export async function unpublishReview(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const r = await loadReview(id);
  if (!r) return;
  await prisma.review.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null, pendingEdit: false },
  });
  await writeLog("UPDATE", user, r.tour, `Отзыв снят с публикации: «${r.authorName}»`);
  if (r.tourId) await recomputeTourRating(r.tourId);
  revalidateAll(r.tour?.slug);
}

// ── В архив (любой статус → архив) ───────────────────────────────────
export async function archiveReview(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const r = await loadReview(id);
  if (!r) return;
  await prisma.review.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date(), publishedAt: null, pendingEdit: false },
  });
  await writeLog("ARCHIVE", user, r.tour, `Отзыв в архиве: «${r.authorName}»`);
  if (r.tourId) await recomputeTourRating(r.tourId);
  revalidateAll(r.tour?.slug);
}

// ── Создать отзыв вручную (админ заводит отзыв сам) ──────────────────
export async function createReviewManual(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);

  const tourId = String(formData.get("tourId") || "") || null;
  const authorName = String(formData.get("name") || "").trim() || "Гость";
  const phone = String(formData.get("phone") || "").trim() || null;
  const rating = Math.min(5, Math.max(1, Math.round(Number(formData.get("rating")) || 5)));
  const text = String(formData.get("text") || "").trim();
  const publish = String(formData.get("status") || "") === "PUBLISHED";
  let photos: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("photos") || "[]"));
    if (Array.isArray(raw)) photos = raw.filter((u) => typeof u === "string" && u).slice(0, 8);
  } catch {
    /* фото не критичны */
  }

  const tour = tourId
    ? await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true, title: true, slug: true } })
    : null;

  await prisma.review.create({
    data: {
      tourId: tour?.id ?? null,
      authorName,
      phone,
      rating,
      text,
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
      hadPublished: publish,
      photos: { create: photos.map((url, i) => ({ url, order: i })) },
      revisions: { create: { rating, text, authorName, photos } },
    },
  });

  await writeLog("CREATE", user, tour, `Отзыв заведён вручную: «${authorName}»`);
  if (tour?.id) await recomputeTourRating(tour.id);
  revalidateAll(tour?.slug);
}

// ── Удалить навсегда (доступно только из архива) ─────────────────────
export async function deleteReview(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user);
  const id = String(formData.get("id"));
  const r = await loadReview(id);
  if (!r) return;
  await prisma.review.delete({ where: { id } }); // фото удалятся каскадно
  await writeLog("DELETE", user, r.tour, `Отзыв удалён: «${r.authorName}»`);
  if (r.tourId) await recomputeTourRating(r.tourId);
  revalidateAll(r.tour?.slug);
}
