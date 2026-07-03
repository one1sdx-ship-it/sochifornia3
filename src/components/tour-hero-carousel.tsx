"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { GradientImage } from "@/components/gradient-image";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { cn } from "@/lib/utils";

// Временно: 7 одинаковых фото (1 оригинал + 6 копий), пронумерованы 1..7
const SLIDES = 7;

export function TourHeroCarousel({
  image,
  title,
  children,
}: {
  image: string;
  title: string;
  children: React.ReactNode;
}) {
  const images = Array.from({ length: SLIDES }, () => image);
  const [index, setIndex] = useState(0);
  const activeThumb = useRef<HTMLButtonElement | null>(null);
  const activeThumbFs = useRef<HTMLButtonElement | null>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const didSwipe = useRef(false);

  const go = (i: number) => setIndex(((i % SLIDES) + SLIDES) % SLIDES);

  // Стрелки: та же логика, что и в карточке тура на главной/в Каталоге —
  // проявляются на 100% при смене фото/наведении, гаснут за 2с до 55%
  const [arrowsShown, setArrowsShown] = useState(true);
  const [arrowsFast, setArrowsFast] = useState(true);
  const arrowHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashArrows = () => {
    if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
    setArrowsFast(true);
    setArrowsShown(true);
    arrowHideTimer.current = setTimeout(() => {
      setArrowsFast(false);
      setArrowsShown(false);
    }, 300);
  };

  const flip = (dir: number) => {
    flashArrows();
    go(index + dir);
  };

  // Полноэкранный просмотр: fullscreen — оверлей смонтирован; closing — идёт анимация закрытия;
  // showPhoto — управляет очерёдностью «сначала лента вниз, потом фото» при входе
  const [fullscreen, setFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openFullscreen = (i: number) => {
    go(i);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setShowPhoto(false);
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    setClosing(true);
    setShowPhoto(false);
    closeTimer.current = setTimeout(() => {
      setFullscreen(false);
      setClosing(false);
    }, 320);
  };

  // Вход в полноэкранный режим: лента «доезжает» вниз (0.32с), и только затем проявляется фото
  useEffect(() => {
    if (fullscreen && !closing) {
      openTimer.current = setTimeout(() => setShowPhoto(true), 320);
      return () => {
        if (openTimer.current) clearTimeout(openTimer.current);
      };
    }
  }, [fullscreen, closing]);

  // Пока открыт полноэкранный просмотр — прокрутка страницы отключена (в т.ч. Lenis)
  useEffect(() => {
    if (!fullscreen) return;
    stopScroll();
    return () => startScroll();
  }, [fullscreen]);

  // Esc и стрелки клавиатуры в полноэкранном режиме
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
      if (e.key === "ArrowLeft") flip(-1);
      if (e.key === "ArrowRight") flip(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, index]);

  useEffect(() => {
    activeThumb.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    activeThumbFs.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  useEffect(() => {
    if (showPhoto) flashArrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhoto]);

  return (
    <>
      <section
        className="relative overflow-hidden"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          startY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startX.current;
          const dy = e.changedTouches[0].clientY - startY.current;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            didSwipe.current = true;
            go(index + (dx < 0 ? 1 : -1));
          }
        }}
      >
        {/* Основное фото — клик открывает полноэкранный просмотр */}
        <button
          type="button"
          aria-label="Открыть фото на весь экран"
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            openFullscreen(index);
          }}
          className="absolute inset-0 h-full w-full cursor-zoom-in"
        >
          <GradientImage
            id={images[index]}
            className="h-full w-full"
            label={`${title} — фото ${index + 1}`}
          />
        </button>

        {/* Контент поверх фото (хлебные крошки, заголовок); pointer-events-none — чтобы клик по
            «пустым» местам фото доходил до кнопки полноэкранного просмотра под ним */}
        <div className="pointer-events-none relative z-10">{children}</div>
      </section>

      {/* Лента-превью — прилипает под шапкой при прокрутке вниз, чтобы фото были доступны в любой момент */}
      <div className="sticky top-24 z-40 border-b border-hairline bg-bg">
        <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              key={i}
              ref={i === index ? activeThumb : null}
              type="button"
              aria-label={`Фото ${i + 1}`}
              aria-current={i === index}
              onClick={() => openFullscreen(i)}
              className={cn(
                "relative h-16 w-[86px] shrink-0 overflow-hidden rounded-md transition sm:h-20 sm:w-[101px]",
                i === index
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-bg"
                  : "opacity-55 hover:opacity-100"
              )}
            >
              <GradientImage id={img} className="h-full w-full" />
            </button>
          ))}
        </div>
      </div>

      {/* Полноэкранный просмотр фотографий */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={`Просмотр фотографий: ${title}`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            onClick={closeFullscreen}
            className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            <X className="h-6 w-6" />
          </button>

          <div
            className="relative min-h-0 flex-1"
            onMouseEnter={() => {
              if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
              setArrowsFast(true);
              setArrowsShown(true);
            }}
            onMouseLeave={() => {
              setArrowsFast(true);
              setArrowsShown(false);
            }}
            onTouchStart={(e) => {
              startX.current = e.touches[0].clientX;
              startY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - startX.current;
              const dy = e.changedTouches[0].clientY - startY.current;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                flip(dx < 0 ? 1 : -1);
              }
            }}
          >
            {showPhoto && (
              <GradientImage
                id={images[index]}
                className="absolute inset-0 h-full w-full animate-fade-in"
                label={`${title} — фото ${index + 1}`}
              />
            )}

            {/* Стрелки: та же логика анимации, что в блоке «Экскурсия» на главной и в Каталоге */}
            <button
              type="button"
              aria-label="Предыдущее фото"
              onClick={() => flip(-1)}
              style={{
                opacity: arrowsShown ? 1 : 0.55,
                transition: `opacity ${arrowsFast ? 300 : 2000}ms ease`,
              }}
              className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              onClick={() => flip(1)}
              style={{
                opacity: arrowsShown ? 1 : 0.55,
                transition: `opacity ${arrowsFast ? 300 : 2000}ms ease`,
              }}
              className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
            >
              <ChevronRight className="h-7 w-7" strokeWidth={2.5} />
            </button>
          </div>

          {/* Дублированная лента превью на чёрном фоне — та же логика выбора/пролистывания */}
          <div
            className={cn(
              "shrink-0 border-t border-white/10 bg-black",
              closing ? "animate-slide-out-down" : "animate-slide-in-up"
            )}
          >
            <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((img, i) => (
                <button
                  key={i}
                  ref={i === index ? activeThumbFs : null}
                  type="button"
                  aria-label={`Фото ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                  className={cn(
                    "relative h-16 w-[86px] shrink-0 overflow-hidden rounded-md transition sm:h-20 sm:w-[101px]",
                    i === index
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-black"
                      : "opacity-55 hover:opacity-100"
                  )}
                >
                  <GradientImage id={img} className="h-full w-full" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
