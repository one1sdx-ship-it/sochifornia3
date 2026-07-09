// Запросы для админ-панели (список экскурсий с фильтром/поиском/сортировкой).
import { prisma } from "@/lib/prisma";
import type { Prisma, TourStatus } from "@prisma/client";

export type AdminSort = "updated" | "title" | "price";

export type AdminTourRow = {
  id: string;
  slug: string;
  title: string;
  status: TourStatus;
  category: string;
  adultPrice: number;
  priceSuffix: string;
  image: string;
  updatedAt: Date;
  createdById: string | null;
  authorName: string | null;
};

// Список экскурсий по статусу (вкладке) с поиском и сортировкой.
export async function getAdminTours(opts: {
  status: TourStatus;
  q?: string;
  sort?: AdminSort;
}): Promise<AdminTourRow[]> {
  const where: Prisma.TourWhereInput = { status: opts.status };
  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.TourOrderByWithRelationInput =
    opts.sort === "title"
      ? { title: "asc" }
      : opts.sort === "price"
        ? { adultPrice: "asc" }
        : { updatedAt: "desc" };

  const rows = await prisma.tour.findMany({
    where,
    orderBy,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      category: true,
      adultPrice: true,
      priceSuffix: true,
      image: true,
      updatedAt: true,
      createdById: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    category: r.category,
    adultPrice: r.adultPrice,
    priceSuffix: r.priceSuffix,
    image: r.image,
    updatedAt: r.updatedAt,
    createdById: r.createdById,
    authorName: r.createdBy?.name ?? r.createdBy?.email ?? null,
  }));
}

// Счётчики для вкладок.
export async function getStatusCounts(): Promise<Record<TourStatus, number>> {
  const groups = await prisma.tour.groupBy({ by: ["status"], _count: true });
  const counts = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 } as Record<TourStatus, number>;
  for (const g of groups) counts[g.status] = g._count;
  return counts;
}
