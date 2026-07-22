// Запросы отзывов для админки (список с фильтрами, счётчики групп, список туров для выбора).
import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReviewStatus, Prisma } from "@prisma/client";

// Снимок отзыва в истории правок (для полноэкранного окна истории).
export type AdminRevision = {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  photos: string[];
  createdAt: Date;
};

export type AdminReview = {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  status: ReviewStatus;
  pendingEdit: boolean;
  createdAt: Date;
  publishedAt: Date | null;
  tourId: string | null;
  tourTitle: string; // «—» если общий отзыв без тура
  phone: string | null; // телефон автора (виден только админу), null у общих/легаси
  photos: string[];
  revisions: AdminRevision[]; // история изменений (по возрастанию времени)
};

const adminInclude = {
  tour: { select: { title: true } },
  customer: { select: { phone: true } },
  photos: { orderBy: { order: "asc" } },
  revisions: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.ReviewInclude;

type Row = Prisma.ReviewGetPayload<{ include: typeof adminInclude }>;

function toAdmin(r: Row): AdminReview {
  return {
    id: r.id,
    rating: r.rating,
    text: r.text,
    authorName: r.authorName || "Гость",
    status: r.status,
    pendingEdit: r.pendingEdit,
    createdAt: r.createdAt,
    publishedAt: r.publishedAt,
    tourId: r.tourId,
    tourTitle: r.tour?.title ?? "—",
    phone: r.phone ?? r.customer?.phone ?? null,
    photos: r.photos.map((p) => p.url),
    revisions: r.revisions.map((v) => ({
      id: v.id,
      rating: v.rating,
      text: v.text,
      authorName: v.authorName,
      photos: v.photos,
      createdAt: v.createdAt,
    })),
  };
}

// Список отзывов с фильтром по статусу (группе) и, опционально, по конкретному туру.
// pendingEdit: true → только «Правки», false → только свежие черновики, undefined → без фильтра.
export async function getAdminReviews(opts: {
  status: ReviewStatus;
  tourId?: string | null;
  pendingEdit?: boolean;
}): Promise<AdminReview[]> {
  const rows = await prisma.review.findMany({
    where: {
      status: opts.status,
      ...(opts.pendingEdit !== undefined ? { pendingEdit: opts.pendingEdit } : {}),
      ...(opts.tourId ? { tourId: opts.tourId } : {}),
    },
    include: adminInclude,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(toAdmin);
}

// Счётчики по группам (для бейджей на вкладках) — в текущей области (все / выбранный тур).
// edits — правки ранее опубликованных отзывов (DRAFT + pendingEdit); DRAFT здесь — только свежие черновики.
export async function getReviewCounts(tourId?: string | null): Promise<{
  edits: number;
  PUBLISHED: number;
  DRAFT: number;
  ARCHIVED: number;
}> {
  const where: Prisma.ReviewWhereInput = tourId ? { tourId } : {};
  const grouped = await prisma.review.groupBy({
    by: ["status", "pendingEdit"],
    where,
    _count: true,
  });
  const counts = { edits: 0, PUBLISHED: 0, DRAFT: 0, ARCHIVED: 0 };
  for (const g of grouped) {
    if (g.status === "DRAFT" && g.pendingEdit) counts.edits += g._count;
    else counts[g.status] += g._count;
  }
  return counts;
}

// Список туров для селектора «Выбранная экскурсия» (все, кроме, при желании, без отзывов — берём все).
export async function getToursForReviewFilter(): Promise<{ id: string; title: string }[]> {
  return prisma.tour.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}
