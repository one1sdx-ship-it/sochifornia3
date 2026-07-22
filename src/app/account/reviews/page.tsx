// Кабинет → «Мои отзывы»: список отзывов клиента со статусом, правкой и удалением.
import Link from "next/link";
import { Star } from "lucide-react";
import type { ReviewStatus } from "@prisma/client";
import { requireCustomer } from "@/lib/customer-session";
import { getCustomerReviews } from "@/data/account";
import { MyReviewActions } from "@/components/account/my-review-actions";

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  DRAFT: { label: "На модерации", cls: "bg-amber-500/15 text-amber-500" },
  PUBLISHED: { label: "Опубликован", cls: "bg-success/15 text-success" },
  ARCHIVED: { label: "В архиве", cls: "bg-surface-2 text-muted" },
};

export default async function MyReviewsPage() {
  const customer = await requireCustomer();
  const reviews = await getCustomerReviews(customer.id);

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-surface p-10 text-center text-muted">
        Вы ещё не оставляли отзывов. Загляните на страницу любой экскурсии.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => {
        const s = STATUS[r.status];
        return (
          <article key={r.id} className="rounded-2xl border border-hairline bg-surface p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={i < r.rating ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4 text-hairline"} />
                ))}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
              <span className="ml-auto text-xs text-muted">
                {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(r.createdAt)}
              </span>
            </div>

            <p className="mt-1 text-sm">
              {r.tourSlug ? (
                <Link href={`/tours/${r.tourSlug}`} className="text-primary hover:underline">
                  {r.tourTitle}
                </Link>
              ) : (
                <span className="text-primary">{r.tourTitle}</span>
              )}
            </p>
            <p className="mt-2 whitespace-pre-line text-[15px] text-body">{r.text}</p>

            {r.photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.photos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-md border border-hairline">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {r.tourSlug && (
                <Link
                  href={`/tours/${r.tourSlug}`}
                  className="inline-flex items-center rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2"
                >
                  Редактировать
                </Link>
              )}
              <MyReviewActions reviewId={r.id} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
