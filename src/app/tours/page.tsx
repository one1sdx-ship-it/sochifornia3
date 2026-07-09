import type { Metadata } from "next";
import { getPublishedTours } from "@/data/tours-db";
import type { TourCategory } from "@/data/types";
import { PageHeader } from "@/components/page-header";
import { CatalogFilters } from "@/components/catalog-filters";

export const metadata: Metadata = {
  title: "Каталог экскурсий в Сочи",
  description: "Все экскурсии Sochifornia Travel: морские, горные, городские и природные маршруты. Фильтры по цене, типу и времени. Цены от 1000 ₽.",
};

// Обновляем данные из БД не чаще раза в минуту (ISR).
export const revalidate = 60;

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category as TourCategory | undefined;
  const tours = await getPublishedTours();

  return (
    <>
      <PageHeader
        eyebrow="Каталог"
        title="Экскурсии по Сочи и окрестностям"
        subtitle="Подберите идеальный маршрут с помощью фильтров. Все цены окончательные — без скрытых доплат."
        bgImage="/excursii.png"
      />
      <CatalogFilters tours={tours} initialCategory={category} />
    </>
  );
}
