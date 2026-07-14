// Список опубликованных туров для отправки карточек/локаций из админ-чата
// + сохранение «Места встречи» тура (адрес и координаты).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const tours = await prisma.tour.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, slug: true, title: true, adultPrice: true, image: true, durationHours: true,
      meetingAddress: true, meetingLat: true, meetingLng: true,
      gallery: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
    },
  });

  return NextResponse.json({
    tours: tours.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      price: t.adultPrice,
      image: t.gallery[0]?.url || t.image,
      duration: t.durationHours,
      meeting: { address: t.meetingAddress, lat: t.meetingLat, lng: t.meetingLng },
    })),
  });
}

// Сохранить «Место встречи» тура (используется и страницей тура, и отправкой гео в чат).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  let body: { tourId?: string; address?: string; lat?: number; lng?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!body.tourId || !isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "Нужны tourId и координаты" }, { status: 400 });
  }

  await prisma.tour.update({
    where: { id: body.tourId },
    data: {
      meetingAddress: String(body.address ?? "").trim().slice(0, 300),
      meetingLat: lat,
      meetingLng: lng,
    },
  });
  return NextResponse.json({ ok: true });
}
