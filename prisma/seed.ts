// Сид базы: перенос существующих экскурсий из src/data/tours.ts в PostgreSQL.
// Идемпотентно — можно запускать повторно (обновляет по slug, пересоздаёт вложенные списки).
// Запуск: pnpm db:seed
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { tours } from "../src/data/tours";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Иконки по умолчанию для 4 блоков (владелец потом поменяет в админке).
const DEFAULT_BLOCK_ICONS = ["Sparkles", "MapPin", "Clock", "Camera"];

async function main() {
  console.log(`Сид: переносим ${tours.length} экскурсий...`);

  for (const [i, t] of tours.entries()) {
    // 1) Скалярные поля тура (upsert по slug). Текущие туры считаем опубликованными.
    const tour = await prisma.tour.upsert({
      where: { slug: t.slug },
      update: {
        status: "PUBLISHED",
        title: t.title,
        excerpt: t.excerpt,
        category: t.category,
        format: t.format,
        adultPrice: t.price,
        childPrice: 0, // в старой модели одна цена — детскую владелец задаст в админке
        priceSuffix: "₽/чел",
        durationHours: t.durationHours,
        startTime: t.startTime,
        rating: t.rating,
        reviewsCount: t.reviewsCount,
        seasonal: t.seasonal,
        vip: t.vip,
        image: t.image,
        sortOrder: i,
      },
      create: {
        slug: t.slug,
        status: "PUBLISHED",
        title: t.title,
        excerpt: t.excerpt,
        category: t.category,
        format: t.format,
        adultPrice: t.price,
        childPrice: 0,
        priceSuffix: "₽/чел",
        durationHours: t.durationHours,
        startTime: t.startTime,
        rating: t.rating,
        reviewsCount: t.reviewsCount,
        seasonal: t.seasonal,
        vip: t.vip,
        image: t.image,
        sortOrder: i,
        publishedAt: new Date(),
      },
    });

    // 2) Пересоздаём вложенные списки (чтобы сид оставался идемпотентным).
    await prisma.$transaction([
      prisma.tourImage.deleteMany({ where: { tourId: tour.id } }),
      prisma.tourBlock.deleteMany({ where: { tourId: tour.id } }),
      prisma.programPoint.deleteMany({ where: { tourId: tour.id } }),
      prisma.tourListItem.deleteMany({ where: { tourId: tour.id } }),
    ]);

    // Галерея (карусель) — синхронна на странице и в блоке.
    await prisma.tourImage.createMany({
      data: t.gallery.map((url, order) => ({ tourId: tour.id, url, order })),
    });

    // 4 блока под каруселью (иконка + заголовок).
    await prisma.tourBlock.createMany({
      data: t.highlights.map((title, order) => ({
        tourId: tour.id,
        title,
        icon: DEFAULT_BLOCK_ICONS[order % DEFAULT_BLOCK_ICONS.length],
        iconType: "LUCIDE" as const,
        order,
      })),
    });

    // Программа экскурсии.
    await prisma.programPoint.createMany({
      data: t.program.map((p, order) => ({
        tourId: tour.id,
        time: p.time,
        title: p.title,
        text: p.text,
        order,
      })),
    });

    // Списки: что входит / не входит / что взять.
    await prisma.tourListItem.createMany({
      data: [
        ...t.included.map((text, order) => ({
          tourId: tour.id,
          kind: "INCLUDED" as const,
          text,
          order,
        })),
        ...t.excluded.map((text, order) => ({
          tourId: tour.id,
          kind: "EXCLUDED" as const,
          text,
          order,
        })),
        ...t.bring.map((text, order) => ({
          tourId: tour.id,
          kind: "BRING" as const,
          text,
          order,
        })),
      ],
    });

    console.log(`  ✓ ${t.slug}`);
  }

  console.log("Сид завершён.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
