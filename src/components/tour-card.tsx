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

// Заглушка на случай тура без галереи: 7 одинаковых фото
const SLIDES = 7;

// «Мобильная версия» = ширина меньше lg (как и нижняя навигация lg:hidden)
const MOBILE_MQ = "(max-width: 1023px)";

// Фазы «звёздного шоу» у оценки: появление карточки на экране →
// burst (из звезды выдвигаются ещё 4) → sparkle (пятёрка блестит 3с волной) →
// collapse (складываются обратно в одну) → dance (звезда подрастает и, как танцор,
// поворачивается левым/правым боком) → done. Играет один раз за монтирование.
type StarPhase = "idle" | "burst" | "sparkle" | "collapse" | "dance" | "done";

export function TourCard({ tour }: { tour: Tour }) {
  // Карусель карточки = галерея тура (синхронно со страницей). Пусто — заглушка.
  const images = tour.gallery.length > 0 ? tour.gallery : Array.from({ length: SLIDES }, () => tour.image);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Название экскурсии (h3) — по его появлению из-под нижней панели стартует звёздное шоу
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  // Шоу играем один раз за монтирование (защита от повторного запуска при смене mq)
  const starStartedRef = useRef(false);
  const router = useRouter();
  // Индекс активного фото: общий для свайпера главного фото и подсветки в ленте-карусели.
  const [activePhoto, setActivePhoto] = useState(0);

  // Текущая фаза звёздного шоу у оценки (см. StarPhase)
  const [starPhase, setStarPhase] = useState<StarPhase>("idle");

  // «Бронь» синеет, пока НАЗВАНИЕ экскурсии находится выше середины экрана
  const [ctaBlue, setCtaBlue] = useState(false);

  // Подсветка «Бронь» по позиции названия относительно линии на 62% высоты экрана
  // (немного ниже вертикального центра). rootMargin -62%/-38% сжимает область
  // наблюдения в горизонтальную «линию» на 62% вьюпорта, поэтому колбэк срабатывает,
  // когда название пересекает эту линию. Выше линии → синяя, на/ниже → гаснет.
  // Работает на всех устройствах (десктоп + мобайл); ховер обрабатывается отдельно через group-hover.
  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const r = entry.boundingClientRect;
        const titleCenter = r.top + r.height / 2;
        setCtaBlue(titleCenter < window.innerHeight * 0.62);
      },
      { rootMargin: "-62% 0px -38% 0px", threshold: 0 }
    );
    io.observe(title);
    return () => io.disconnect();
  }, []);

  // Старт звёздного шоу — один раз за монтирование. При reduced-motion не играем вовсе.
  // Момент старта: карточку поднимают снизу, и её название (h3) выезжает из-под нижней
  // панели с 4 кнопками. Ловим это так — наблюдаем название, сжав низ области наблюдения
  // на высоту нижней навигации (#mobile-bottom-nav): пересечение наступает ровно когда
  // название поднялось до верхнего края панели. На десктопе панель скрыта (высота 0) →
  // шоу стартует при появлении названия во вьюпорте.
  useEffect(() => {
    const title = titleRef.current;
    if (!title || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mq = window.matchMedia(MOBILE_MQ);
    let io: IntersectionObserver | null = null;
    const fire = () => {
      if (starStartedRef.current) return;
      starStartedRef.current = true;
      io?.disconnect();
      io = null;
      setStarPhase("burst");
    };
    const setup = () => {
      if (starStartedRef.current) return;
      io?.disconnect();
      // Высота нижней панели с 4 кнопками; на десктопе она скрыта (display:none) → 0.
      const nav = document.getElementById("mobile-bottom-nav");
      const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
      io = new IntersectionObserver(([e]) => e.isIntersecting && fire(), {
        rootMargin: `0px 0px -${navH}px 0px`,
        threshold: 0,
      });
      io.observe(title);
    };
    setup();
    mq.addEventListener("change", setup); // высота панели зависит от мобайл/десктоп — пересобираем
    return () => {
      io?.disconnect();
      mq.removeEventListener("change", setup);
    };
  }, []);

  // Автопереключение фаз шоу: длительности подобраны под транзишены/анимации ниже
  useEffect(() => {
    const timeline: Partial<Record<StarPhase, [StarPhase, number]>> = {
      burst: ["sparkle", 800], // 4 звезды доехали (стагер 90мс + транзишен 300мс)
      sparkle: ["collapse", 3000], // блестят ровно 3 секунды
      collapse: ["dance", 650], // втянулись, подложка вернулась к исходной ширине
      dance: ["done", 1200], // «танец» ~1.1с + небольшой запас
    };
    const step = timeline[starPhase];
    if (!step) return;
    const t = setTimeout(() => setStarPhase(step[0]), step[1]);
    return () => clearTimeout(t);
  }, [starPhase]);

  // «Выбрать»: сразу уходим на страницу экскурсии и просим её открыть панель заявки.
  // Флаг читает [[lead-overlay]] при монтировании. Переход клиентский (маршрут уже предзагружен
  // растянутой ссылкой карточки), поэтому по ощущению — так же быстро, как «Оставить заявку».
  const handleSelect = () => {
    try {
      sessionStorage.setItem("sf:open-lead", "1");
    } catch {}
    router.push(`/tours/${tour.slug}`);
  };

  // тезисы для чипов-пилюль: сортируем по длине — аккуратная «лесенка» при выравнивании вправо
  const highlights = [...tour.highlights].sort((a, b) => b.length - a.length);

  // Общие классы правой кнопки «Бронь»: синеет при ховере (десктоп) и пока название выше линии 62% экрана.
  const bookCls = cn(
    "transition-colors duration-300 active:scale-95 group-hover:bg-primary group-hover:text-primary-fg",
    ctaBlue && "bg-primary text-primary-fg"
  );

  // Пятёрка звёзд раскрыта в фазах burst и sparkle, в остальных — одна звезда
  const starsExpanded = starPhase === "burst" || starPhase === "sparkle";
  // Дробную часть рейтинга показываем «долей» главной звезды: слева белая часть, справа
  // жёлтая. Долю округляем ВНИЗ до 0.33 (напр. 4.9 → жёлтые ⅔ звезды, 4.6 → треть),
  // ровно 5.0 — звезда целиком жёлтая. Долю рисуем ТОЛЬКО пока раскрыта пятёрка; в покое
  // (в начале и в конце) главная звезда всегда цельно-жёлтая.
  const RATING_STEP = 0.33;
  const yellowFrac =
    tour.rating >= 5
      ? 1
      : Math.floor((tour.rating - Math.floor(tour.rating)) / RATING_STEP) * RATING_STEP;
  const partialStar = yellowFrac < 1;
  // Классы анимаций главной звезды (блеск в sparkle, «танец» в dance) — общие для обоих режимов
  const mainStarAnim = cn(
    starPhase === "sparkle" && "animate-star-twinkle",
    starPhase === "dance" && "animate-star-dance"
  );

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

        {/* Порядок: продолжительность → отзывы → оценка. Часы — на отдельной, чуть более светлой
            подложке; отзывы+оценка — на общей белой подложке. */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black backdrop-blur-sm">
            <Clock className="h-3.5 w-3.5" /> {tour.durationHours} ч
          </span>
          <span className="flex items-center gap-2.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-black backdrop-blur-sm">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {tour.reviewsCount} отзывов
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              {/* Звёздное шоу. Контейнер бейджей заякорен справа (right-3), поэтому при росте
                  ширины ряда звёзд подложка, «N отзывов» с иконкой и бейдж с часами сами плавно
                  уезжают влево, освобождая место, а при схлопывании возвращаются обратно. */}
              <span className="inline-flex items-center">
                {/* Главная звезда: блестит вместе со всеми, затем «танцует».
                    Долю (для рейтинга < 5) рисуем только пока раскрыта пятёрка — два наложенных
                    слоя: снизу белая звезда целиком, сверху жёлтая, обрезанная слева по clip-path
                    так, что жёлтой остаётся правая доля yellowFrac (0.25/0.5/0.75). Контур белого
                    слоя золотой — чтобы силуэт читался на белой подложке бейджа. В покое — цельная. */}
                {partialStar && starsExpanded ? (
                  <span className={cn("relative inline-flex h-3.5 w-3.5 shrink-0", mainStarAnim)}>
                    <Star className="absolute inset-0 h-3.5 w-3.5 fill-white text-gold" />
                    <Star
                      className="absolute inset-0 h-3.5 w-3.5 fill-gold text-gold"
                      style={{ clipPath: `inset(0 0 0 ${(1 - yellowFrac) * 100}%)` }}
                    />
                  </span>
                ) : (
                  <Star className={cn("h-3.5 w-3.5 shrink-0 fill-gold text-gold", mainStarAnim)} />
                )}
                {/* 4 дополнительные звезды: выдвигаются из главной (ширина 0 → 14px со стагером),
                    втягиваются в обратном порядке — справа налево */}
                {[0, 1, 2, 3].map((i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 shrink-0 fill-gold text-gold transition-all duration-300 ease-out",
                      starsExpanded ? "ml-[3px] w-3.5 scale-100 opacity-100" : "ml-0 w-0 scale-50 opacity-0",
                      starPhase === "sparkle" && "animate-star-twinkle"
                    )}
                    style={{
                      transitionDelay: starsExpanded ? `${90 * i}ms` : `${60 * (3 - i)}ms`,
                      // Волна блеска: каждая звезда мерцает с небольшим сдвигом фазы
                      animationDelay: starPhase === "sparkle" ? `${140 * (i + 1)}ms` : undefined,
                    }}
                  />
                ))}
              </span>
              {/* Изюминка: на время «танца» оценка тоже отливает золотом */}
              <span className={cn("transition-colors duration-500", starPhase === "dance" && "text-gold")}>
                {tour.rating}
              </span>
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
        <h3 ref={titleRef} className="font-display text-lg font-semibold leading-snug text-ink">{tour.title}</h3>
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
              <span className="text-xs text-muted">/чел</span>
            </p>
            {/* Двойная кнопка «Смотреть | Выбрать»: пульсирует целиком (как раньше «Подробнее»).
                Правая часть «Бронь» синеет при ховере (десктоп) и пока название экскурсии выше центра экрана.
                relative z-10 — на КОНТЕЙНЕРЕ: пульсация (will-change: transform) уже создаёт свой
                stacking context, поэтому z-10 на вложенной кнопке не срабатывал — клик проваливался
                на растянутую ссылку карточки (z-0). Поднимаем над ссылкой весь блок, а обе половины
                делаем самостоятельными кликабельными элементами. */}
            {/* «Косой сплит» (вариант C): одна капсула, разрезанная диагональю на две половины —
                «Смотреть» слева, «Бронь» справа. */}
            <span className="animate-cta-breathe relative z-10 flex h-10 shrink-0 overflow-hidden rounded-md text-sm font-medium">
              <Link
                href={`/tours/${tour.slug}`}
                className="flex items-center bg-primary/10 pl-4 pr-5 text-primary active:scale-95"
                style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}
              >
                Смотреть
              </Link>
              <button
                type="button"
                onClick={handleSelect}
                className={cn("-ml-3.5 flex items-center bg-primary/10 pl-5 pr-4 text-primary", bookCls)}
                style={{ clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%)" }}
              >
                Бронь
              </button>
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
