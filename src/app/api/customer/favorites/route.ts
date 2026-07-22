// Избранные экскурсии клиента: список id (GET) и переключение (POST).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer-session";

// Список id избранных туров текущего клиента (для подсветки сердечек). Гость → пусто.
export async function GET() {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ tourIds: [] });
  const rows = await prisma.favorite.findMany({
    where: { customerId: customer.id },
    select: { tourId: true },
  });
  return NextResponse.json({ tourIds: rows.map((r) => r.tourId) });
}

// Переключение избранного для тура. Возвращает новое состояние { favorited }.
export async function POST(req: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "Войдите, чтобы добавлять в избранное" }, { status: 401 });

  let tourId = "";
  try {
    ({ tourId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!tourId) return NextResponse.json({ error: "Не указана экскурсия" }, { status: 400 });

  const existing = await prisma.favorite.findUnique({
    where: { customerId_tourId: { customerId: customer.id, tourId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  // create может упасть, если тур не существует (FK) — отдаём понятную ошибку.
  try {
    await prisma.favorite.create({ data: { customerId: customer.id, tourId } });
  } catch {
    return NextResponse.json({ error: "Экскурсия не найдена" }, { status: 404 });
  }
  return NextResponse.json({ favorited: true });
}
