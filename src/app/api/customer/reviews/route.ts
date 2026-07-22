// Создание/редактирование отзыва вошедшим клиентом.
// Новый или изменённый отзыв уходит в статус DRAFT («Черновик») — на модерацию.
// Появится на сайте только после «Опубликовать» в админке.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer-session";
import { recomputeTourRating } from "@/data/reviews-db";

const MAX_PHOTOS = 8;

export async function POST(req: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Войдите, чтобы оставить отзыв" }, { status: 401 });

  let body: { tourId?: string; rating?: number; text?: string; name?: string; photos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const tourId = String(body.tourId || "");
  const rating = Math.round(Number(body.rating));
  const text = String(body.text || "").trim();
  const name = String(body.name || "").trim();
  const photos = Array.isArray(body.photos)
    ? body.photos.filter((u) => typeof u === "string" && u).slice(0, MAX_PHOTOS)
    : [];

  if (!tourId) return NextResponse.json({ error: "Не указана экскурсия" }, { status: 400 });
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: "Поставьте оценку от 1 до 5" }, { status: 400 });
  if (text.length < 5) return NextResponse.json({ error: "Слишком короткий отзыв" }, { status: 400 });

  const tour = await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true } });
  if (!tour) return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });

  // Обновляем имя в профиле клиента, если задано и изменилось.
  if (name && name !== customer.name) {
    await prisma.customer.update({ where: { id: customer.id }, data: { name } });
  }
  const authorName = name || customer.name || "Гость";

  // Один отзыв клиента на экскурсию: если уже есть — редактируем его.
  const existing = await prisma.review.findFirst({
    where: { tourId, customerId: customer.id },
    select: { id: true, hadPublished: true },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      // Правка возвращает отзыв на модерацию (DRAFT) и заменяет фото.
      // Если отзыв уже когда-либо публиковался — это «правка», ждёт ремодерации.
      await tx.reviewPhoto.deleteMany({ where: { reviewId: existing.id } });
      await tx.review.update({
        where: { id: existing.id },
        data: {
          rating,
          text,
          authorName,
          status: "DRAFT",
          pendingEdit: existing.hadPublished,
          publishedAt: null,
          archivedAt: null,
          photos: { create: photos.map((url, i) => ({ url, order: i })) },
          revisions: { create: { rating, text, authorName, photos } },
        },
      });
    } else {
      await tx.review.create({
        data: {
          tourId,
          customerId: customer.id,
          rating,
          text,
          authorName,
          status: "DRAFT",
          photos: { create: photos.map((url, i) => ({ url, order: i })) },
          revisions: { create: { rating, text, authorName, photos } },
        },
      });
    }
  });

  // Если редактировали уже опубликованный отзыв — он ушёл из PUBLISHED, пересчитываем рейтинг тура.
  await recomputeTourRating(tourId);

  return NextResponse.json({ ok: true });
}

// Удаление СВОЕГО отзыва клиентом — по ?id=.
export async function DELETE(req: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Не указан отзыв" }, { status: 400 });

  // Удаляем только свой отзыв.
  const review = await prisma.review.findFirst({
    where: { id, customerId: customer.id },
    select: { id: true, tourId: true },
  });
  if (!review) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });

  await prisma.review.delete({ where: { id: review.id } });
  if (review.tourId) await recomputeTourRating(review.tourId);

  return NextResponse.json({ ok: true });
}

// Текущий отзыв клиента об экскурсии (для префилла формы) — по ?tourId=.
export async function GET(req: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ review: null });

  const tourId = new URL(req.url).searchParams.get("tourId") || "";
  if (!tourId) return NextResponse.json({ review: null });

  const review = await prisma.review.findFirst({
    where: { tourId, customerId: customer.id },
    select: {
      rating: true,
      text: true,
      status: true,
      authorName: true,
      photos: { orderBy: { order: "asc" }, select: { url: true } },
    },
  });

  return NextResponse.json({
    review: review
      ? {
          rating: review.rating,
          text: review.text,
          status: review.status,
          name: review.authorName,
          photos: review.photos.map((p) => p.url),
        }
      : null,
  });
}
