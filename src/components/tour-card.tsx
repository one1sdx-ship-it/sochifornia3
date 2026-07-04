"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Star, Users } from "lucide-react";
import type { Tour } from "@/data/types";
import { GradientImage } from "@/components/gradient-image";
import { PhotoSwiper } from "@/components/photo-swiper";
import { Marquee } from "@/components/marquee";
import { cn, formatPrice } from "@/lib/utils";

// Временно: 7 одинаковых фото (1 оригинал + 6 копий)
const SLIDES = 7;

// «Мобильная версия» = ширина меньше lg (как и нижняя навигация lg:hidden)
const MOBILE_MQ = "(max-width: 1023px)";

export function TourCard({ tour }: { tour: Tour }) {
  const images = Array.from({ length: SLIDES }, () => tour.image);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  // Индекс активного фото: общий для свайпера главного фото и подсветки в ленте-карусели.
  const [activePhoto, setActivePhoto] = useState(0);

  // Мобайл: true, когда карточка проходит через центр экрана — тогда «Подробнее» синеет
  const [centered, setCentered] = useState(false);
  // «Подробнее» синеет НЕ сразу, а через 2с после того, как блок оказался по центру (мобайл)
  const [ctaBlue, setCtaBlue] = useState(false);

  // Мобайл: подсветка «Подробнее», когда карточка пересекает центр экрана.
  // rootMargin -50%/-50% превращает область наблюдения в горизонтальную «линию» по центру вьюпорта.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const mq = window.matchMedia(MOBILE_MQ);
    let io: IntersectionObserver | null = null;
    const setup = () => {
      io?.disconnect();
      if (!mq.matches) {
        setCentered(false); // десктоп — только :hover, авто-подсветки нет
        return;
      }
      io = new IntersectionObserver(([entry]) => setCentered(entry.isIntersecting), {
        rootMargin: "-50% 0px -50% 0px",
        threshold: 0,
      });
      io.observe(el);
    };
    setup();
    mq.addEventListener("change", setup);
    return () => {
      io?.disconnect();
      mq.removeEventListener("change", setup);
    };
  }, []);

  // 2-секундная пауза перед посинением; если блок ушёл из центра раньше — отменяем
  useEffect(() => {
    if (!centered) {
      setCtaBlue(false);
      return;
    }
    const t = setTimeout(() => setCtaBlue(true), 2000);
    return () => clearTimeout(t);
  }, [centered]);

  // тезисы для чипов-пилюль: сортируем по длине — аккуратная «лесенка» при выравнивании вправо
  const highlights = [...tour.highlights].sort((a, b) => b.length - a.length);

  return (
    <div
      ref={cardRef}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
    >
      {/* Главное фото — свайп-карусель: удержание + движение влево/вправо перелистывает фото.
          Обычный тап ведёт на страницу экскурсии (onTap). */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <PhotoSwiper
          images={images}
          label={tour.title}
          index={activePhoto}
          onIndexChange={setActivePhoto}
          onTap={() => router.push(`/tours/${tour.slug}`)}
          imgClassName="transition-transform duration-500 group-hover:scale-105"
        />

        {/* Бейджи слева сверху */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2">
          {tour.vip && (
            <span className="rounded-full bg-gold px-2.5 py-1 text-xs font-semibold text-black/80">VIP</span>
          )}
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {tour.format === "group" ? "Групповая" : "Индивидуальная"}
          </span>
        </div>

        {/* Отзывы + часы + оценка — на единой белой подложке */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10">
          <span className="flex items-center gap-2.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-black backdrop-blur-sm">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {tour.reviewsCount} отзывов
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {tour.rating}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {tour.durationHours} ч
            </span>
          </span>
        </div>
      </div>

      {/* Карусель-лента с фотографиями (под главным фото): сама плавно и медленно едет справа
          налево (rAF-marquee). Её можно зажать пальцем и прокрутить вручную — авто-ход плавно
          останавливается на удержании и возобновляется при отпускании. Тап по ленте НЕ ведёт
          на страницу экскурсии (лента лежит выше растянутой ссылки карточки). */}
      <Marquee
        draggable
        highlightCenter
        selectedIndex={activePhoto}
        onSelect={setActivePhoto}
        className="bg-surface px-3 py-2 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
        copyClassName="gap-1.5 pr-1.5"
        pxPerSecond={15.68}
      >
        {images.map((img, i) => (
          <GradientImage
            key={i}
            id={img}
            className="h-14 w-[72px] shrink-0 rounded-md"
            label={`${tour.title} — фото ${i + 1}`}
          />
        ))}
      </Marquee>

      {/* Контент */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">{tour.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-body">{tour.excerpt}</p>

        <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
          {/* 1-й уровень: тезисы — чипы-пилюли с галочкой.
              Мобайл: бесшовная лента (rAF-marquee) едет справа налево, чипы крупнее ~30%.
              Десктоп (sm+): строго в столбик (по одному в строке), прижаты к правому краю. */}
          {highlights.length > 0 && (
            <>
              <Marquee
                draggable
                direction="right"
                onTap={() => router.push(`/tours/${tour.slug}`)}
                className="-mx-5 sm:hidden [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]"
                copyClassName="gap-2 pr-2"
                pxPerSecond={43.2}
              >
                {highlights.map((h, i) => (
                  <span
                    key={h + i}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-2.5 py-[3px] text-[14px] font-medium text-primary"
                  >
                    <Check className="h-4 w-4 shrink-0" /> <span>{h}</span>
                  </span>
                ))}
              </Marquee>

              <ul className="hidden flex-col items-end gap-1.5 sm:flex">
                {highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    <Check className="h-3 w-3 shrink-0" /> <span>{h}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* 2-й уровень: цена и кнопка «Подробнее», отцентрованы по вертикали */}
          <div className="flex items-center justify-between gap-3">
            <p className="leading-tight">
              <span className="text-xs text-muted">от </span>
              <span className="font-display text-xl font-bold text-ink">{formatPrice(tour.price)}</span>
              <span className="text-xs text-muted"> за человека</span>
            </p>
            {/* «Подробнее»: волнообразная пульсация; синеет при ховере (десктоп) и через 2с в центре экрана (мобайл) */}
            <span
              className={cn(
                "animate-cta-breathe shrink-0 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-fg",
                ctaBlue && "bg-primary text-primary-fg"
              )}
            >
              Подробнее
            </span>
          </div>
        </div>
      </div>

      {/* Растянутая ссылка: вся карточка кликабельна (в т.ч. по фото) */}
      <Link
        href={`/tours/${tour.slug}`}
        aria-label={tour.title}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </div>
  );
}
