import { Star, Quote } from "lucide-react";
import type { DisplayReview } from "@/data/reviews-db";
import { ReviewPhotos } from "@/components/review-photos";

export function ReviewCard({ review }: { review: DisplayReview }) {
  return (
    <figure className="flex h-full flex-col rounded-lg border border-hairline bg-surface p-6 shadow-card">
      <Quote className="h-7 w-7 text-primary/30" />
      <div className="mt-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={i < review.rating ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4 text-hairline"}
          />
        ))}
      </div>
      <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-body">
        “{review.text}”
      </blockquote>

      {/* Фото из отзыва — по 3 в ряд во всю ширину, клик открывает полноэкранный
          просмотрщик (зум/свайп/лента), как на странице экскурсии */}
      <ReviewPhotos photos={review.photos} title={review.tour || undefined} />

      <figcaption className="mt-5 flex items-center gap-3 border-t border-hairline pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {review.initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{review.name}</p>
          <p className="text-xs text-muted">{review.tour ? `${review.tour} · ${review.date}` : review.date}</p>
        </div>
      </figcaption>
    </figure>
  );
}
