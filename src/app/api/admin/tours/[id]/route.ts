// API автосохранения контента экскурсии (inline-редактирование).
// Принимает частичные изменения по разделам. Проверяет авторизацию и права.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canEditTour } from "@/lib/session";

type SavePayload =
  | { type: "meta"; title?: string; excerpt?: string; adultPrice?: number; childPrice?: number; priceSuffix?: string }
  | { type: "blocks"; blocks: { icon: string; iconType?: "LUCIDE" | "CUSTOM"; title: string }[] }
  | { type: "program"; program: { time: string; title: string; text: string }[] }
  | { type: "list"; kind: "INCLUDED" | "EXCLUDED" | "BRING"; items: { text: string; icon?: string | null; iconType?: "LUCIDE" | "CUSTOM" }[] }
  | { type: "tariffs"; tariffs: { label: string; price: number }[] }
  | { type: "gallery"; images: { url: string; alt?: string }[] };

const clampInt = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
const str = (v: unknown) => String(v ?? "");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const tour = await prisma.tour.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, createdById: true },
  });
  if (!tour) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (!canEditTour(user, tour)) {
    return NextResponse.json({ error: "Нет прав на редактирование" }, { status: 403 });
  }

  let body: SavePayload;
  try {
    body = (await req.json()) as SavePayload;
  } catch {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  switch (body.type) {
    case "meta": {
      const data: Record<string, unknown> = { updatedById: user.id };
      if (body.title !== undefined) data.title = str(body.title).slice(0, 200);
      if (body.excerpt !== undefined) data.excerpt = str(body.excerpt).slice(0, 1000);
      if (body.adultPrice !== undefined) data.adultPrice = clampInt(body.adultPrice);
      if (body.childPrice !== undefined) data.childPrice = clampInt(body.childPrice);
      if (body.priceSuffix !== undefined) data.priceSuffix = str(body.priceSuffix).slice(0, 40);
      await prisma.tour.update({ where: { id }, data });
      break;
    }
    case "blocks": {
      await prisma.$transaction([
        prisma.tourBlock.deleteMany({ where: { tourId: id } }),
        prisma.tourBlock.createMany({
          data: body.blocks.slice(0, 12).map((b, order) => ({
            tourId: id,
            icon: str(b.icon).slice(0, 200),
            iconType: b.iconType === "CUSTOM" ? "CUSTOM" : "LUCIDE",
            title: str(b.title).slice(0, 120),
            order,
          })),
        }),
        prisma.tour.update({ where: { id }, data: { updatedById: user.id } }),
      ]);
      break;
    }
    case "program": {
      await prisma.$transaction([
        prisma.programPoint.deleteMany({ where: { tourId: id } }),
        prisma.programPoint.createMany({
          data: body.program.slice(0, 50).map((p, order) => ({
            tourId: id,
            time: str(p.time).slice(0, 40),
            title: str(p.title).slice(0, 200),
            text: str(p.text).slice(0, 2000),
            order,
          })),
        }),
        prisma.tour.update({ where: { id }, data: { updatedById: user.id } }),
      ]);
      break;
    }
    case "list": {
      const kind = body.kind;
      await prisma.$transaction([
        prisma.tourListItem.deleteMany({ where: { tourId: id, kind } }),
        prisma.tourListItem.createMany({
          data: body.items.slice(0, 50).map((it, order) => ({
            tourId: id,
            kind,
            text: str(it.text).slice(0, 500),
            icon: it.icon ? str(it.icon).slice(0, 200) : null,
            iconType: it.iconType === "CUSTOM" ? "CUSTOM" : "LUCIDE",
            order,
          })),
        }),
        prisma.tour.update({ where: { id }, data: { updatedById: user.id } }),
      ]);
      break;
    }
    case "tariffs": {
      await prisma.$transaction([
        prisma.extraTariff.deleteMany({ where: { tourId: id } }),
        prisma.extraTariff.createMany({
          data: body.tariffs.slice(0, 20).map((t, order) => ({
            tourId: id,
            label: str(t.label).slice(0, 120),
            price: clampInt(t.price),
            order,
          })),
        }),
        prisma.tour.update({ where: { id }, data: { updatedById: user.id } }),
      ]);
      break;
    }
    case "gallery": {
      const images = body.images.slice(0, 100);
      await prisma.$transaction([
        prisma.tourImage.deleteMany({ where: { tourId: id } }),
        prisma.tourImage.createMany({
          data: images.map((im, order) => ({
            tourId: id,
            url: str(im.url).slice(0, 1000),
            alt: str(im.alt).slice(0, 200),
            order,
          })),
        }),
        // Обложка тура = первое фото галереи (карусель и карточка синхронны).
        prisma.tour.update({ where: { id }, data: { image: images[0]?.url ?? "", updatedById: user.id } }),
      ]);
      break;
    }
    default:
      return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 });
  }

  // Журнал изменений (человекочитаемый раздел).
  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      userId: user.id,
      tourId: tour.id,
      tourTitle: tour.title,
      summary: `Изменено: ${sectionLabel(body)}`,
    },
  });

  // Обновляем кеш публичной страницы и каталога.
  revalidatePath(`/tours/${tour.slug}`);
  revalidatePath("/tours");
  revalidatePath("/");

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

// Человекочитаемое имя раздела для журнала.
function sectionLabel(body: SavePayload): string {
  switch (body.type) {
    case "meta":
      return "заголовок / описание / цены";
    case "blocks":
      return "4 блока";
    case "program":
      return "программа экскурсии";
    case "list":
      return body.kind === "INCLUDED" ? "что входит" : body.kind === "EXCLUDED" ? "не входит" : "что взять с собой";
    case "tariffs":
      return "доп. тарифы";
    case "gallery":
      return "фотографии";
    default:
      return "контент";
  }
}
