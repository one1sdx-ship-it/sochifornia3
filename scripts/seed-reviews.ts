// Перенос статических «демо»-отзывов из src/data/content.ts в БД как опубликованных.
// Запуск: pnpm --dir <путь sochifornia> db:seed-reviews
// Идемпотентно: повторный запуск не создаёт дубликаты (проверка по имени автора + тексту).
// Тур подбирается по названию из отзыва (best-effort); если не нашёлся — отзыв общий (без тура).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { reviews } from "../src/data/content";

const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

// «Май 2026» → Date(2026, 4, 15). Не распарсили — текущая дата.
function parseRuDate(s: string): Date {
  const [mon, year] = s.trim().toLowerCase().split(/\s+/);
  const mi = MONTHS.indexOf(mon);
  const y = Number(year);
  if (mi < 0 || !y) return new Date();
  return new Date(y, mi, 15);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const tours = await prisma.tour.findMany({ select: { id: true, title: true } });
  const findTourId = (name: string): string | null => {
    const q = name.trim().toLowerCase();
    if (!q) return null;
    const hit = tours.find((t) => {
      const title = t.title.toLowerCase();
      return title.includes(q) || q.includes(title);
    });
    return hit?.id ?? null;
  };

  const affected = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const r of reviews) {
    // Пропуск дубля при повторном запуске.
    const exists = await prisma.review.findFirst({
      where: { authorName: r.name, text: r.text },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    const tourId = findTourId(r.tour);
    const publishedAt = parseRuDate(r.date);
    await prisma.review.create({
      data: {
        tourId,
        customerId: null,
        status: "PUBLISHED",
        rating: r.rating,
        text: r.text,
        authorName: r.name,
        publishedAt,
      },
    });
    created++;
    if (tourId) affected.add(tourId);
  }

  // Пересчёт рейтинга/числа отзывов у затронутых туров.
  for (const tourId of affected) {
    const agg = await prisma.review.aggregate({
      where: { tourId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.tour.update({
      where: { id: tourId },
      data: {
        reviewsCount: agg._count,
        ...(agg._count > 0 ? { rating: Math.round((agg._avg.rating ?? 5) * 10) / 10 } : {}),
      },
    });
  }

  console.log(`Отзывы перенесены: создано ${created}, пропущено (уже есть) ${skipped}, туров пересчитано ${affected.size}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
