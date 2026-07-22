import type { Metadata } from "next";
import { Star } from "lucide-react";
import { site } from "@/data/site";
import { getAllPublishedReviews } from "@/data/reviews-db";
import { PageHeader } from "@/components/page-header";
import { ReviewCard } from "@/components/review-card";
import { LeadSection } from "@/components/sections/lead-section";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Отзывы туристов",
  description: "Реальные отзывы о экскурсиях Sochifornia Travel. Более 10 000 туристов, средний рейтинг 4.9. Читайте впечатления наших гостей.",
};

export default async function ReviewsPage() {
  const reviews = await getAllPublishedReviews(60);
  return (
    <>
      <PageHeader
        eyebrow="Отзывы"
        title="Что говорят наши туристы"
        subtitle="Мы гордимся каждым отзывом. Это честные впечатления людей, которые отдыхали с нами."
        bgImage="/otzivi.jpg"
      />

      <section className="container-wide py-section-sm sm:py-section">
        <Reveal className="mx-auto mb-12 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface p-8 text-center">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-6 w-6 fill-gold text-gold" />
            ))}
          </div>
          <p className="font-display text-5xl font-bold text-ink">{site.stats.rating}</p>
          <p className="text-body">Средняя оценка на основе отзывов {site.stats.clients} туристов</p>
        </Reveal>

        {reviews.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={(i % 3) * 70}>
                <ReviewCard review={r} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="text-center text-body">Пока нет опубликованных отзывов.</p>
        )}

        <Reveal className="mx-auto mt-12 max-w-2xl rounded-2xl border border-dashed border-hairline bg-surface-2 p-8 text-center">
          <h2 className="font-display text-xl font-bold text-ink">Уже были с нами?</h2>
          <p className="mt-2 text-body">
            Будем рады вашему отзыву — он помогает нам становиться лучше и подсказывает другим
            туристам, чего ждать от поездки.
          </p>
        </Reveal>
      </section>

      <LeadSection />
    </>
  );
}
