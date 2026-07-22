// Список клиентов (вошедших по номеру телефона) для админки.
import "server-only";
import { prisma } from "@/lib/prisma";

export type AdminCustomer = {
  id: string;
  phone: string;
  name: string;
  avatarUrl: string;
  createdAt: Date;
  reviewsCount: number;
  favoritesCount: number;
};

// Все клиенты, сначала новые. Со счётчиками отзывов и избранного.
export async function getCustomers(): Promise<AdminCustomer[]> {
  const rows = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phone: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { reviews: true, favorites: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    name: r.name,
    avatarUrl: r.avatarUrl,
    createdAt: r.createdAt,
    reviewsCount: r._count.reviews,
    favoritesCount: r._count.favorites,
  }));
}
