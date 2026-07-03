"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clock, Star, Users } from "lucide-react";
import type { Tour } from "@/data/types";
import { GradientImage } from "@/components/gradient-image";
import { scrollElementToCenter } from "@/components/smooth-scroll";
import { cn, formatPrice } from "@/lib/utils";

// Временно: 7 одинаковых фото (1 оригинал + 6 копий)
const SLIDES = 7;

// «Мобильная версия» = ширина меньше lg (как и нижняя навигация lg:hidden)
const MOBILE_MQ = "(max-width: 1023px)";

export function TourCard({ tour }: { tour: Tour }) {
  const images = Array.from({ length: SLIDES }, () => tour.image);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const didSwipe = useRef(false);

  // Стрелки листания: появляются при каждом скролле страницы (быстро, ~0.3с),
  // затем плавно затухают (~2с) до 35%. Наведение мышью тоже показывает стрелки.
  const [arrowsShown, setArrowsShown] = useState(false);
  const [arrowsFast, setArrowsFast] = useState(true); // true → 0.3с (появление), false → 2с (затухание)
  const arrowHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Мобайл: true, когда карточка проходит через центр экрана — тогда «Подробнее» синеет (как ховер/нажатие стрелок)
  const [centered, setCentered] = useState(false);
  // «Подробнее» синеет НЕ сразу, а через 2с после того, как блок оказался по центру (мобайл)
  const [ctaBlue, setCtaBlue] = useState(false);

  const go = (i: number) => {
    setIndex(((i % SLIDES) + SLIDES) % SLIDES);
    // сигнал для контекстной кнопки телефона в каталоге
    window.dispatchEvent(new Event("app:carousel"));
  };

  // Листание стрелками/боковыми зонами: на мобиле дополнительно плавно и медленно подтягиваем блок к центру экрана
  const flip = (dir: number) => {
    go(index + dir);
    if (window.matchMedia(MOBILE_MQ).matches) scrollElementToCenter(cardRef.current);
  };

  // При каждом скролле страницы — быстро показать стрелки, затем плавно погасить за 2с (до 35%)
  useEffect(() => {
    const onScroll = () => {
      if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
      setArrowsFast(true);
      setArrowsShown(true);
      arrowHideTimer.current = setTimeout(() => {
        setArrowsFast(false); // переключаем длительность на 2с (затухание)
        setArrowsShown(false);
      }, 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
    };
  }, []);

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

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // тезисы для чипов-пилюль: сортируем по длине — аккуратная «лесенка» при выравнивании вправо
  const highlights = [...tour.highlights].sort((a, b) => b.length - a.length);

  return (
    <div
      ref={cardRef}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
      // startX/startY фиксируем на уровне карточки (и сбрасываем флаг свайпа), но само листание
      // сработает только если жест ЗАВЕРШИТСЯ на верхней фотографии (см. onTouchEnd ниже)
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        didSwipe.current = false;
      }}
      onClickCapture={(e) => {
        // после свайпа по фото гасим «клик», чтобы не сработал переход по ссылке-карточке
        if (didSwipe.current) {
          e.preventDefault();
          e.stopPropagation();
          didSwipe.current = false;
        }
      }}
    >
      {/* Фото-карусель — свайп пальцем листает ТОЛЬКО в пределах верхней фотографии */}
      <div
        className="group/car relative aspect-[4/3] w-full overflow-hidden"
        onMouseEnter={() => {
          if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
          setArrowsFast(true);
          setArrowsShown(true);
        }}
        onMouseLeave={() => {
          setArrowsFast(true);
          setArrowsShown(false);
        }}
        onTouchEnd={(e) => {
          // жест «принадлежит» элементу, на котором начался, поэтому сюда попадают только свайпы,
          // начатые на самом фото (свайп по ленте-превью или контенту фото не листает)
          const dx = e.changedTouches[0].clientX - startX.current;
          const dy = e.changedTouches[0].clientY - startY.current;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            didSwipe.current = true;
            go(index + (dx < 0 ? 1 : -1));
          }
        }}
      >
        <GradientImage
          id={images[index]}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          label={`${tour.title} — фото ${index + 1}`}
        />

        {/* Боковые зоны по 22%: тап по краю листает фото; центральные 56% (и остальная карточка) ведут на страницу тура */}
        <button
          type="button"
          aria-label="Предыдущее фото"
          onClick={(e) => {
            stop(e);
            flip(-1);
          }}
          className="absolute left-0 top-0 z-10 h-full w-[22%]"
        />
        <button
          type="button"
          aria-label="Следующее фото"
          onClick={(e) => {
            stop(e);
            flip(1);
          }}
          className="absolute right-0 top-0 z-10 h-full w-[22%]"
        />

        {/* Центральные 56%: обычный тап — переход на страницу тура; свайп влево/вправо — листание
            (жест ловит onTouchEnd фото, а didSwipe гасит переход) */}
        <Link
          href={`/tours/${tour.slug}`}
          aria-label={tour.title}
          tabIndex={-1}
          className="absolute left-[22%] top-0 z-10 h-full w-[56%]"
        />

        {/* Стрелки листания: в покое видимы на 55%, при скролле/наведении — 100% */}
        <button
          type="button"
          aria-label="Предыдущее фото"
          onClick={(e) => {
            stop(e);
            flip(-1);
          }}
          style={{
            // покой — видимость 55%, при скролле/наведении — 100%; появление за 0.3с, затухание за 2с
            opacity: arrowsShown ? 1 : 0.55,
            transition: `opacity ${arrowsFast ? 300 : 2000}ms ease`,
          }}
          className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label="Следующее фото"
          onClick={(e) => {
            stop(e);
            flip(1);
          }}
          style={{
            opacity: arrowsShown ? 1 : 0.55,
            transition: `opacity ${arrowsFast ? 300 : 2000}ms ease`,
          }}
          className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
        >
          <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
        </button>

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

      {/* Лента-превью с подсветкой активного */}
      <div className="flex gap-1.5 overflow-x-auto bg-surface px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Фото ${i + 1}`}
            aria-current={i === index}
            onClick={(e) => {
              stop(e);
              go(i); // тап по превью выбирает фото; ленту при этом НЕ прокручиваем (не центрируем)
            }}
            className={cn(
              "relative z-20 h-14 w-[72px] shrink-0 overflow-hidden rounded-md transition",
              i === index
                ? "ring-2 ring-primary ring-offset-1 ring-offset-surface"
                : "opacity-55 hover:opacity-100"
            )}
          >
            <GradientImage id={img} className="h-full w-full" />
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-ink">{tour.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-body">{tour.excerpt}</p>

        <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
          {/* 1-й уровень: тезисы — чипы-пилюли с галочкой.
              Мобайл: бесшовная карусель-марки́, авто-скролл справа налево.
              Десктоп (sm+): строго в столбик (по одному в строке), прижаты к правому краю. */}
          {highlights.length > 0 && (
            <>
              <div className="-mx-5 overflow-hidden sm:hidden [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]">
                <ul className="flex w-max animate-marquee gap-1.5 px-5">
                  {[...highlights, ...highlights].map((h, i) => (
                    <li
                      key={h + i}
                      className="flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                    >
                      <Check className="h-3 w-3 shrink-0" /> <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

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

      {/* Растянутая ссылка: вся карточка кликабельна */}
      <Link
        href={`/tours/${tour.slug}`}
        aria-label={tour.title}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </div>
  );
}
