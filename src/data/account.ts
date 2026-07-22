// Данные для личного кабинета клиента: мои отзывы, избранные туры, история чата.
import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReviewStatus, ChatSender, ChatMsgType } from "@prisma/client";
import { getPublishedTours } from "@/data/tours-db";
import type { Tour } from "@/data/types";

// ── Мои отзывы ───────────────────────────────────────────────────────
export type MyReview = {
  id: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  createdAt: Date;
  tourTitle: string;
  tourSlug: string | null;
  photos: string[];
};

export async function getCustomerReviews(customerId: string): Promise<MyReview[]> {
  const rows = await prisma.review.findMany({
    where: { customerId },
    include: {
      tour: { select: { title: true, slug: true } },
      photos: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    status: r.status,
    createdAt: r.createdAt,
    tourTitle: r.tour?.title ?? "—",
    tourSlug: r.tour?.slug ?? null,
    photos: r.photos.map((p) => p.url),
  }));
}

// ── Избранное ────────────────────────────────────────────────────────
// Возвращаем опубликованные туры из избранного (для карточек).
export async function getFavoriteTours(customerId: string): Promise<Tour[]> {
  const favs = await prisma.favorite.findMany({
    where: { customerId },
    select: { tourId: true },
  });
  const ids = new Set(favs.map((f) => f.tourId));
  if (ids.size === 0) return [];
  const tours = await getPublishedTours();
  return tours.filter((t) => ids.has(t.id));
}

// ── История чата ─────────────────────────────────────────────────────
export type ChatHistoryMessage = {
  id: string;
  sender: ChatSender;
  type: ChatMsgType;
  text: string;
  attachmentUrl: string;
  createdAt: Date;
};

// Диалог клиента: по привязке (customerId) или по совпадению телефона.
export async function getCustomerChat(
  customerId: string,
  phone: string,
): Promise<ChatHistoryMessage[] | null> {
  const convo = await prisma.chatConversation.findFirst({
    where: { OR: [{ customerId }, { clientPhone: phone }] },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        select: { id: true, sender: true, type: true, text: true, attachmentUrl: true, createdAt: true },
      },
    },
  });
  if (!convo) return null;
  return convo.messages;
}
