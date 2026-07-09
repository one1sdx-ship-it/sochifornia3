import { getPublishedTours } from "@/data/tours-db";
import { SectionHeading } from "@/components/section-heading";
import { TourCard } from "@/components/tour-card";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";

// Async server-компонент: берёт опубликованные экскурсии из БД.
export async function PopularToursSection() {
  const tours = await getPublishedTours();
  const popular = [...tours].sort((a, b) => b.reviewsCount - a.reviewsCount).slice(0, 6);
  return (
    <section className="container-wide py-section-sm sm:py-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Хиты сезона"
          title="Популярные экскурсии"
          subtitle="Маршруты, которые туристы выбирают и рекомендуют чаще всего."
        />
        <Button href="/tours" variant="outline" className="hidden sm:inline-flex">
          Весь каталог
        </Button>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {popular.map((tour, i) => (
          <Reveal key={tour.slug} delay={(i % 3) * 80}>
            <TourCard tour={tour} />
          </Reveal>
        ))}
      </div>
      <div className="mt-8 sm:hidden">
        <Button href="/tours" variant="outline" className="w-full">
          Весь каталог
        </Button>
      </div>
    </section>
  );
}
