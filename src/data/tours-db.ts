// Слой доступа к экскурсиям из БД (PostgreSQL через Prisma).
// Возвращает данные в том же формате `Tour`, что и старый статический tours.ts,
// чтобы существующие компоненты сайта не пришлось менять.
// Публичный сайт видит только опубликованные (PUBLISHED) экскурсии.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { Tour } from "./types";

// Общий набор связей для страницы/карточки тура.
const tourInclude = {
  gallery: { orderBy: { order: "asc" } },
  blocks: { orderBy: { order: "asc" } },
  program: { orderBy: { order: "asc" } },
  listItems: { orderBy: { order: "asc" } },
} satisfies Prisma.TourInclude;

type TourRow = Prisma.TourGetPayload<{ include: typeof tourInclude }>;

// Маппинг строки БД (с вложенными списками) в привычный формат Tour.
function mapTour(t: TourRow): Tour {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    excerpt: t.excerpt,
    category: t.category as Tour["category"],
    format: t.format as Tour["format"],
    price: t.adultPrice, // на публичном сайте показываем взрослую цену как «от»
    durationHours: t.durationHours,
    startTime: t.startTime,
    rating: t.rating,
    reviewsCount: t.reviewsCount,
    seasonal: t.seasonal,
    vip: t.vip,
    image: t.image,
    gallery: t.gallery.map((g) => g.url),
    highlights: t.blocks.map((b) => b.title),
    program: t.program.map((p) => ({ time: p.time, title: p.title, text: p.text })),
    included: t.listItems.filter((i) => i.kind === "INCLUDED").map((i) => i.text),
    excluded: t.listItems.filter((i) => i.kind === "EXCLUDED").map((i) => i.text),
    bring: t.listItems.filter((i) => i.kind === "BRING").map((i) => i.text),
  };
}

// Все опубликованные экскурсии (для каталога, «популярных», похожих).
export async function getPublishedTours(): Promise<Tour[]> {
  const rows = await prisma.tour.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    include: tourInclude,
  });
  return rows.map(mapTour);
}

// Одна опубликованная экскурсия по slug (или null).
export async function getPublishedTourBySlug(slug: string): Promise<Tour | null> {
  const row = await prisma.tour.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: tourInclude,
  });
  return row ? mapTour(row) : null;
}

// Slugs опубликованных экскурсий (для generateStaticParams и sitemap).
export async function getPublishedSlugs(): Promise<string[]> {
  const rows = await prisma.tour.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

// ── Полная сущность тура (с id всех вложенных записей) — для редактирования ──
const fullInclude = {
  gallery: { orderBy: { order: "asc" } },
  blocks: { orderBy: { order: "asc" } },
  program: { orderBy: { order: "asc" } },
  listItems: { orderBy: { order: "asc" } },
  extraTariffs: { orderBy: { order: "asc" } },
} satisfies Prisma.TourInclude;

export type TourEntity = Prisma.TourGetPayload<{ include: typeof fullInclude }>;

// Тур по slug любого статуса (для авторизованного редактора).
export async function getTourEntity(slug: string): Promise<TourEntity | null> {
  return prisma.tour.findUnique({ where: { slug }, include: fullInclude });
}

// Преобразование полной сущности в привычный формат Tour (для read-only рендера страницы).
export function toLegacyTour(t: TourEntity): Tour {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    excerpt: t.excerpt,
    category: t.category as Tour["category"],
    format: t.format as Tour["format"],
    price: t.adultPrice,
    durationHours: t.durationHours,
    startTime: t.startTime,
    rating: t.rating,
    reviewsCount: t.reviewsCount,
    seasonal: t.seasonal,
    vip: t.vip,
    image: t.image,
    gallery: t.gallery.map((g) => g.url),
    highlights: t.blocks.map((b) => b.title),
    program: t.program.map((p) => ({ time: p.time, title: p.title, text: p.text })),
    included: t.listItems.filter((i) => i.kind === "INCLUDED").map((i) => i.text),
    excluded: t.listItems.filter((i) => i.kind === "EXCLUDED").map((i) => i.text),
    bring: t.listItems.filter((i) => i.kind === "BRING").map((i) => i.text),
  };
}
