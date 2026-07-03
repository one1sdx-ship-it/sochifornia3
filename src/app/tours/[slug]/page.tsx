import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Check, X as XIcon, Clock, Users, Star, MapPin, Backpack, ChevronRight, Calendar,
} from "lucide-react";
import { tours, getTour } from "@/data/tours";
import { reviews, faqs, guides } from "@/data/content";
import { categories } from "@/data/types";
import { site } from "@/data/site";
import { formatPrice } from "@/lib/utils";
import { TourGallery } from "@/components/tour-gallery";
import { TourHeroCarousel } from "@/components/tour-hero-carousel";
import { LeadForm } from "@/components/lead-form";
import { ReviewCard } from "@/components/review-card";
import { FaqAccordion } from "@/components/faq-accordion";
import { TourCard } from "@/components/tour-card";
import { GuideCard } from "@/components/guide-card";
import { StickyBookingBar } from "@/components/sticky-booking-bar";
import { Reveal } from "@/components/reveal";

export function generateStaticParams() {
  return tours.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = getTour(slug);
  if (!tour) return { title: "Экскурсия не найдена" };
  return {
    title: tour.title,
    description: tour.excerpt,
    openGraph: { title: tour.title, description: tour.excerpt, type: "article" },
  };
}

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tour = getTour(slug);
  if (!tour) notFound();

  const category = categories.find((c) => c.id === tour.category);
  const related = tours.filter((t) => t.category === tour.category && t.slug !== tour.slug).slice(0, 3);
  const relatedFallback = related.length > 0 ? related : tours.filter((t) => t.slug !== tour.slug).slice(0, 3);
  const guide = guides[tours.indexOf(tour) % guides.length];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: tour.title,
    description: tour.excerpt,
    offers: {
      "@type": "Offer",
      price: tour.price,
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: tour.rating,
      reviewCount: tour.reviewsCount,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <TourHeroCarousel image={tour.image} title={tour.title}>
        <div className="container-wide relative flex min-h-[58vh] flex-col justify-end py-12 text-white sm:min-h-[64vh]">
          <nav className="pointer-events-auto mb-auto pt-4 text-sm text-white/80" aria-label="Хлебные крошки">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/" className="hover:text-white">Главная</Link></li>
              <ChevronRight className="h-4 w-4" />
              <li><Link href="/tours" className="hover:text-white">Каталог</Link></li>
              <ChevronRight className="h-4 w-4" />
              <li className="text-white">{tour.title}</li>
            </ol>
          </nav>

          <div className="max-w-3xl animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              {tour.vip && <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black/80">VIP</span>}
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                {category?.label}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                {tour.format === "group" ? "Групповая" : "Индивидуальная"}
              </span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">{tour.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">{tour.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 fill-gold text-gold" /> {tour.rating} · {tour.reviewsCount} отзывов</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {tour.durationHours} часов</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> старт ~{tour.startTime}</span>
            </div>
          </div>
        </div>
      </TourHeroCarousel>

      {/* BODY: контент + липкая колонка заявки */}
      <section className="container-wide grid gap-10 py-12 lg:grid-cols-[1fr_380px] lg:py-16">
        <div className="min-w-0 space-y-14">
          {/* Преимущества */}
          <Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {tour.highlights.map((h) => (
                <div key={h} className="rounded-lg border border-hairline bg-surface p-4">
                  <Check className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-medium text-ink">{h}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Программа */}
          <Reveal as="section">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Программа экскурсии</h2>
            <ol className="relative mt-6 space-y-6 pl-[26px] before:absolute before:left-[4px] before:top-0 before:bottom-0 before:w-0.5 before:bg-hairline before:content-['']">
              {tour.program.map((step, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-bg">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <p className="text-sm font-semibold text-primary">{step.time}</p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-body">{step.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>

          {/* Маршрут (карта-заглушка) */}
          <Reveal as="section">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Маршрут</h2>
            <div className="mt-6 flex aspect-[16/8] w-full items-center justify-center rounded-lg border border-dashed border-hairline bg-surface-2 text-center">
              <div className="px-6">
                <MapPin className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-2 font-medium text-ink">Интерактивная карта маршрута</p>
                <p className="text-sm text-muted">Появится здесь после интеграции с картами</p>
              </div>
            </div>
          </Reveal>

          {/* Что входит / не входит */}
          <Reveal as="section" className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-hairline bg-surface p-6">
              <h3 className="font-display text-lg font-semibold text-ink">Что входит</h3>
              <ul className="mt-4 space-y-3">
                {tour.included.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-body">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-hairline bg-surface p-6">
              <h3 className="font-display text-lg font-semibold text-ink">Не входит</h3>
              <ul className="mt-4 space-y-3">
                {tour.excluded.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-body">
                    <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-error" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Что взять с собой */}
          <Reveal as="section">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink sm:text-3xl">
              <Backpack className="h-7 w-7 text-primary" /> Что взять с собой
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {tour.bring.map((item) => (
                <li key={item} className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-body">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Галерея */}
          <Reveal as="section">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Фотографии</h2>
            <div className="mt-6">
              <TourGallery images={tour.gallery} title={tour.title} />
            </div>
          </Reveal>

          {/* Гид */}
          <Reveal as="section">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Ваш гид</h2>
            <div className="mt-6 max-w-sm">
              <GuideCard guide={guide} />
            </div>
          </Reveal>

          {/* FAQ */}
          <Reveal as="section">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Частые вопросы</h2>
            <div className="mt-6">
              <FaqAccordion items={faqs.slice(0, 4)} />
            </div>
          </Reveal>
        </div>

        {/* Липкая колонка: цена + форма */}
        <aside className="lg:relative">
          <div id="tour-lead" className="lg:sticky lg:top-24">
            <div className="mb-4 rounded-lg border border-hairline bg-surface p-6">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-sm text-muted">Стоимость от</span>
                  <p className="font-display text-3xl font-bold text-ink">{formatPrice(tour.price)}</p>
                  <span className="text-sm text-muted">за человека</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  <Star className="h-4 w-4 fill-primary" /> {tour.rating}
                </span>
              </div>
            </div>
            <LeadForm tourTitle={tour.title} compact />
          </div>
        </aside>
      </section>

      {/* Отзывы */}
      <section className="bg-surface py-section-sm">
        <div className="container-wide">
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Отзывы туристов</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <ReviewCard key={r.name} review={r} />
            ))}
          </div>
        </div>
      </section>

      {/* Похожие экскурсии */}
      <section className="container-wide py-section-sm">
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Рекомендуем также</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {relatedFallback.map((t) => (
            <TourCard key={t.slug} tour={t} />
          ))}
        </div>
      </section>

      <StickyBookingBar price={tour.price} />
    </>
  );
}
