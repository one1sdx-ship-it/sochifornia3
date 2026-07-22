import { site } from "@/data/site";
import { getAllPublishedReviews } from "@/data/reviews-db";
import { SectionHeading } from "@/components/section-heading";
import { ReviewCard } from "@/components/review-card";
import { Reveal } from "@/components/reveal";
import { Star } from "lucide-react";

export async function ReviewsSection() {
  const reviews = await getAllPublishedReviews(6);
  if (reviews.length === 0) return null; // пока нет опубликованных отзывов — секцию не показываем
  return (
    <section className="bg-surface py-section-sm sm:py-section">
      <div className="container-wide">
        <div className="flex flex-col items-center gap-6 text-center">
          <SectionHeading
            eyebrow="Отзывы туристов"
            title="Впечатления, которые говорят сами за себя"
            align="center"
          />
          <Reveal className="flex items-center gap-3 rounded-full border border-hairline bg-bg px-5 py-2.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-gold text-gold" />
              ))}
            </div>
            <span className="font-display text-lg font-bold text-ink">{site.stats.rating}</span>
            <span className="text-sm text-muted">средняя оценка · {site.stats.clients} туристов</span>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 80}>
              <ReviewCard review={r} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
