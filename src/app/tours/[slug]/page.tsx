import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Clock, Users, Star, MapPin, Backpack, ChevronRight, Calendar,
} from "lucide-react";
import { getPublishedTours, getPublishedTourBySlug, getPublishedSlugs, getTourEntity, toLegacyTour, type TourEntity } from "@/data/tours-db";
import { getCurrentUser, canEditTour } from "@/lib/session";
import { TourEditLauncher, type EditorTour } from "@/components/admin/tour-editor/tour-edit-launcher";
import { InlineEditProvider } from "@/components/admin/tour-editor/inline-edit";
import {
  EditableMetaText, EditablePrice, TourBlocksGrid, TourBringList, TourChecklistCard, TourProgram,
} from "@/components/admin/tour-editor/editable-sections";
import { reviews, faqs, guides } from "@/data/content";
import { categories } from "@/data/types";
import { site } from "@/data/site";
import { TourGallery } from "@/components/tour-gallery";
import { TourHeroCarousel } from "@/components/tour-hero-carousel";
import { LeadForm } from "@/components/lead-form";
import { ReviewCard } from "@/components/review-card";
import { FaqAccordion } from "@/components/faq-accordion";
import { TourCard } from "@/components/tour-card";
import { GuideCard } from "@/components/guide-card";
import { StickyBookingBar } from "@/components/sticky-booking-bar";
import { LeadOverlay } from "@/components/lead-overlay";
import { Reveal } from "@/components/reveal";

// Собираем данные для inline-редактора (сериализуемые, без id вложенных записей не нужны).
function buildEditorTour(t: TourEntity): EditorTour {
  const list = (kind: "INCLUDED" | "EXCLUDED" | "BRING") =>
    t.listItems.filter((i) => i.kind === kind).map((i) => ({ text: i.text, icon: i.icon, iconType: i.iconType }));
  return {
    id: t.id,
    title: t.title,
    excerpt: t.excerpt,
    adultPrice: t.adultPrice,
    childPrice: t.childPrice,
    priceSuffix: t.priceSuffix,
    gallery: t.gallery.map((g) => ({ url: g.url, alt: g.alt })),
    blocks: t.blocks.map((b) => ({ icon: b.icon, iconType: b.iconType, title: b.title })),
    program: t.program.map((p) => ({ time: p.time, title: p.title, text: p.text })),
    included: list("INCLUDED"),
    excluded: list("EXCLUDED"),
    bring: list("BRING"),
    tariffs: t.extraTariffs.map((x) => ({ label: x.label, price: x.price })),
  };
}

// Обновляем данные из БД не чаще раза в минуту (ISR).
export const revalidate = 60;
// Разрешаем показывать туры, которых не было на момент сборки (без пересборки).
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = await getPublishedTourBySlug(slug);
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
  const entity = await getTourEntity(slug);
  if (!entity) notFound();

  // Авторизованный редактор видит тур любого статуса; посторонние — только опубликованный.
  const currentUser = await getCurrentUser();
  const canEdit = currentUser ? canEditTour(currentUser, entity) : false;
  if (entity.status !== "PUBLISHED" && !canEdit) notFound();

  const tour = toLegacyTour(entity);
  // Единый набор данных для inline-правки и клиентских секций (без правки — просто данные).
  const editor = buildEditorTour(entity);
  const allTours = await getPublishedTours();
  const category = categories.find((c) => c.id === tour.category);
  const related = allTours.filter((t) => t.category === tour.category && t.slug !== tour.slug).slice(0, 3);
  const relatedFallback = related.length > 0 ? related : allTours.filter((t) => t.slug !== tour.slug).slice(0, 3);
  const guideIndex = allTours.findIndex((t) => t.slug === tour.slug);
  const guide = guides[(guideIndex < 0 ? 0 : guideIndex) % guides.length];

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
    // Провайдер быстрой inline-правки: без прав отдаёт «пустой» контекст,
    // и все Editable-компоненты рендерят обычный статичный текст.
    <InlineEditProvider tour={canEdit ? editor : null}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Плашка для редактора: тур не опубликован и виден только ему */}
      {canEdit && entity.status !== "PUBLISHED" && (
        <div className="bg-gold px-4 py-2 text-center text-sm font-medium text-black/80">
          {entity.status === "DRAFT" ? "Черновик — виден только вам" : "В архиве — виден только вам"}
        </div>
      )}

      {/* HERO */}
      <TourHeroCarousel images={tour.gallery.length > 0 ? tour.gallery : [tour.image]} title={tour.title}>
        {/* pb увеличен: плашка «Полноэкранный просмотр» (снизу справа) крупная — резервируем место,
            чтобы строка с рейтингом/часами/стартом была НАД плашкой, а не под ней. */}
        <div className="container-wide relative flex min-h-[58vh] flex-col justify-end pb-24 pt-12 text-white sm:min-h-[64vh]">
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
            <EditableMetaText field="title" as="h1" className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl" value={tour.title} placeholder="Название экскурсии" />
            <EditableMetaText field="excerpt" as="p" multiline className="mt-4 max-w-2xl text-lg text-white/90" value={tour.excerpt} placeholder="Короткое описание" />
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
            <TourBlocksGrid blocks={editor.blocks} />
          </Reveal>

          {/* Программа */}
          <Reveal as="section">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Программа экскурсии</h2>
            <TourProgram program={editor.program} />
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
            <TourChecklistCard kind="INCLUDED" title="Что входит" items={editor.included} />
            <TourChecklistCard kind="EXCLUDED" title="Не входит" items={editor.excluded} />
          </Reveal>

          {/* Что взять с собой */}
          <Reveal as="section">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink sm:text-3xl">
              <Backpack className="h-7 w-7 text-primary" /> Что взять с собой
            </h2>
            <TourBringList items={editor.bring} />
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
                  <EditablePrice value={tour.price} className="font-display text-3xl font-bold text-ink" />
                  <span className="text-sm text-muted">за человека</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  <Star className="h-4 w-4 fill-primary" /> {tour.rating}
                </span>
              </div>
            </div>
            {/* id на самой форме (а не на #tour-lead с карточкой цены выше) — чтобы полноэкранная
                панель могла подвести эту форму ровно под свою одноимённую форму. */}
            <div id="tour-lead-form">
              <LeadForm tourTitle={tour.title} compact />
            </div>
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
      <LeadOverlay tourTitle={tour.title} />

      {/* Mobile-first inline-редактор — только для тех, кому можно править этот тур */}
      {canEdit && <TourEditLauncher tour={editor} />}
    </InlineEditProvider>
  );
}
