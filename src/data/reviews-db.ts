// Слой чтения отзывов из БД для публичной части сайта + пересчёт рейтинга тура.
import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Форма отзыва для карточки на сайте (совместима с прежним статическим ReviewCard).
export type DisplayReview = {
  id: string;
  name: string;
  initials: string;
  date: string; // «Май 2026»
  rating: number;
  text: string;
  tour: string; // название экскурсии (или "" для общих отзывов)
  photos: string[];
};

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

// «Иван Петров» → «ИП»; пустое имя → «?».
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Что включаем при выборке отзыва для показа.
const displayInclude = {
  tour: { select: { title: true } },
  photos: { orderBy: { order: "asc" } },
} satisfies Prisma.ReviewInclude;

type ReviewWithRels = Prisma.ReviewGetPayload<{ include: typeof displayInclude }>;

function toDisplay(r: ReviewWithRels): DisplayReview {
  const name = r.authorName || "Гость";
  return {
    id: r.id,
    name,
    initials: initialsFrom(name),
    date: formatDate(r.publishedAt ?? r.createdAt),
    rating: r.rating,
    text: r.text,
    tour: r.tour?.title ?? "",
    photos: r.photos.map((p) => p.url),
  };
}

// Опубликованные отзывы конкретной экскурсии (для страницы тура).
export async function getPublishedReviewsForTour(tourId: string, take = 6): Promise<DisplayReview[]> {
  const rows = await prisma.review.findMany({
    where: { tourId, status: "PUBLISHED" },
    include: displayInclude,
    orderBy: { publishedAt: "desc" },
    take,
  });
  return rows.map(toDisplay);
}

// Все опубликованные отзывы (для раздела /reviews и секции на главной).
export async function getAllPublishedReviews(take = 60): Promise<DisplayReview[]> {
  const rows = await prisma.review.findMany({
    where: { status: "PUBLISHED" },
    include: displayInclude,
    orderBy: { publishedAt: "desc" },
    take,
  });
  return rows.map(toDisplay);
}

// Пересчёт рейтинга и числа отзывов у тура по его опубликованным отзывам.
// Вызывается при изменении статуса отзыва в админке (публикация/снятие/архив/удаление).
export async function recomputeTourRating(tourId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { tourId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });
  const count = agg._count;
  await prisma.tour.update({
    where: { id: tourId },
    data: {
      reviewsCount: count,
      // Средний балл округляем до 1 знака; если опубликованных нет — оставляем прежний рейтинг.
      ...(count > 0 ? { rating: Math.round((agg._avg.rating ?? 5) * 10) / 10 } : {}),
    },
  });
}
