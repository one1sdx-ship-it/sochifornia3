"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import { GradientImage } from "@/components/gradient-image";
import { Marquee } from "@/components/marquee";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { cn } from "@/lib/utils";

export function TourHeroCarousel({
  images: imagesInput,
  title,
  children,
}: {
  images: string[];
  title: string;
  children: React.ReactNode;
}) {
  // Карусель героя = галерея тура (синхронно с карточкой и секцией «Фотографии»).
  const images = imagesInput.length > 0 ? imagesInput : ["hero"];
  const SLIDES = images.length;
  const [index, setIndex] = useState(0);
  const activeThumbFs = useRef<HTMLButtonElement | null>(null);

  // Липкая лента-превью: вместо CSS `sticky` (её выталкивает конец <main> при встрече с футером)
  // управляем `fixed` вручную. Как только распорка доходит до нижнего края шапки (96px = top-24),
  // лента фиксируется и больше не сдвигается — футер проезжает под ней (задача 4).
  const stripSentinelRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripPinned, setStripPinned] = useState(false);
  const [stripH, setStripH] = useState(0);

  // Пиним ленту, когда её распорка пересекает линию 96px сверху (низ шапки).
  useEffect(() => {
    const el = stripSentinelRef.current;
    if (!el) return;
    // Пиним, только когда распорка ушла ВВЕРХ за линию 96px (top<96 и вне области);
    // ушла вниз за нижний край экрана — тоже вне области, но там top>96, поэтому не пиним.
    const io = new IntersectionObserver(
      ([e]) => setStripPinned(!e.isIntersecting && e.boundingClientRect.top < 96),
      { rootMargin: "-96px 0px 0px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Замеряем высоту ленты и публикуем «низ ленты» (96px + высота) в CSS-переменную —
  // по ней переключатель отзывов залипает ровно под лентой (задача 6).
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      setStripH(h);
      document.documentElement.style.setProperty("--tour-strip-bottom", `${96 + h}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

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

  // Как только начали листать — кнопка «Полноэкранный просмотр» сворачивается до одной иконки.
  const [fsCollapsed, setFsCollapsed] = useState(false);

  const flip = (dir: number) => {
    flashArrows();
    setFsCollapsed(true);
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
    activeThumbFs.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  useEffect(() => {
    if (showPhoto) flashArrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhoto]);

  // На основном фото стрелки видны сразу и мягко гаснут до 55% (как в карточке экскурсии/Каталоге)
  useEffect(() => {
    flashArrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Полноэкранный зум и жесты (портировано из ZOOM.md, адаптировано под React) =====
  // «Горячее» состояние жеста держим в ref, чтобы не дёргать re-render на каждый touchmove;
  // трансформацию накатываем прямо на <img> императивно (как в оригинале).
  const photoAreaRef = useRef<HTMLDivElement | null>(null);
  const zoomImgRef = useRef<HTMLImageElement | null>(null);
  const zoomScale = useRef(1);
  const panX = useRef(0);
  const panY = useRef(0);
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartTouchX = useRef(0);
  const panStartTouchY = useRef(0);
  const isPanning = useRef(false);
  const lastTapAt = useRef(0);
  const hasManualZoom = useRef(false);
  const lastTouchDoubleTapAt = useRef(0);
  const swStartX = useRef(0);
  const swStartY = useRef(0);
  const swStartAt = useRef(0);

  // Реальное фото (можно зумить) vs градиентная заглушка (только листание/закрытие)
  const isRealPhoto = (id: string) => id.startsWith("/") || id.startsWith("http");

  // Навигацию/закрытие зовём через ref — чтобы нативные слушатели не переподключались на каждый index
  const navRef = useRef({ next: () => {}, prev: () => {}, close: () => {} });
  navRef.current.next = () => flip(1);
  navRef.current.prev = () => flip(-1);
  navRef.current.close = () => closeFullscreen();

  // Границы pan считаем от вписанного размера (object-fit: contain) и текущего зума
  const getPanBounds = () => {
    const area = photoAreaRef.current;
    const img = zoomImgRef.current;
    const vw = area?.clientWidth || window.innerWidth || 0;
    const vh = area?.clientHeight || window.innerHeight || 0;
    const iw = img?.naturalWidth || vw || 1;
    const ih = img?.naturalHeight || vh || 1;
    const fit = Math.min(vw / iw, vh / ih);
    const dw = iw * fit;
    const dh = ih * fit;
    return {
      x: Math.max(0, (dw * zoomScale.current - vw) / 2),
      y: Math.max(0, (dh * zoomScale.current - vh) / 2),
    };
  };

  const clampPan = () => {
    if (zoomScale.current <= 1) {
      panX.current = 0;
      panY.current = 0;
      return;
    }
    const b = getPanBounds();
    panX.current = Math.min(Math.max(panX.current, -b.x), b.x);
    panY.current = Math.min(Math.max(panY.current, -b.y), b.y);
  };

  // interactive=true — во время жеста, без CSS-перехода (фото идёт за пальцем)
  const applyZoom = (interactive: boolean) => {
    const img = zoomImgRef.current;
    if (!img) return;
    clampPan();
    img.style.transition = interactive ? "none" : "transform 0.18s ease";
    img.style.transform =
      zoomScale.current === 1
        ? ""
        : `translate(${panX.current.toFixed(1)}px, ${panY.current.toFixed(1)}px) scale(${zoomScale.current.toFixed(3)})`;
  };

  const resetZoomState = () => {
    zoomScale.current = 1;
    panX.current = 0;
    panY.current = 0;
    pinchStartDist.current = 0;
    pinchStartScale.current = 1;
    isPanning.current = false;
    hasManualZoom.current = false;
    applyZoom(false);
  };

  const setZoom = (scale: number, interactive: boolean) => {
    zoomScale.current = Math.min(Math.max(scale, 1), 5);
    pinchStartScale.current = zoomScale.current;
    applyZoom(interactive);
  };

  // Сброс зума при любой смене фото (стрелки, клавиши, свайп, миниатюры) и при открытии/закрытии
  useEffect(() => {
    resetZoomState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, fullscreen]);

  // Нативные тач-слушатели с { passive: false } — иначе preventDefault() не сработает
  // (React вешает touch-события пассивно). Живут только пока открыт просмотрщик.
  useEffect(() => {
    const area = photoAreaRef.current;
    if (!fullscreen || !showPhoto || !area) return;
    resetZoomState();

    const getDist = (t: TouchList) =>
      Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);

    const resetSwipe = () => {
      swStartX.current = 0;
      swStartY.current = 0;
      swStartAt.current = 0;
    };

    // Двойной тап/клик: ступени 2× → 4× → сброс; если зумили вручную (pinch) — сразу сброс
    const doubleTap = (e: Event) => {
      e.preventDefault();
      lastTapAt.current = 0;
      resetSwipe();
      if ((e as TouchEvent).type === "touchstart") lastTouchDoubleTapAt.current = Date.now();
      if (hasManualZoom.current) {
        resetZoomState();
        return;
      }
      if (zoomScale.current < 1.5) setZoom(2, false);
      else if (zoomScale.current < 3) setZoom(4, false);
      else resetZoomState();
    };

    const onStart = (e: TouchEvent) => {
      // Два пальца → начало pinch-зума
      if (e.touches.length === 2) {
        e.preventDefault();
        resetSwipe();
        hasManualZoom.current = true;
        pinchStartDist.current = getDist(e.touches);
        pinchStartScale.current = zoomScale.current;
        applyZoom(true);
        return;
      }
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapAt.current <= 320) {
          doubleTap(e);
        } else {
          const t = e.touches[0];
          lastTapAt.current = now;
          if (zoomScale.current > 1.01) {
            // уже увеличено → палец таскает фото (pan)
            e.preventDefault();
            isPanning.current = true;
            panStartTouchX.current = t.clientX;
            panStartTouchY.current = t.clientY;
            panStartX.current = panX.current;
            panStartY.current = panY.current;
            resetSwipe();
            return;
          }
          // зум 1× → фиксируем возможный свайп (листание / закрытие вниз)
          swStartX.current = t.clientX;
          swStartY.current = t.clientY;
          swStartAt.current = now;
        }
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isPanning.current) {
        e.preventDefault();
        const t = e.touches[0];
        panX.current = panStartX.current + t.clientX - panStartTouchX.current;
        panY.current = panStartY.current + t.clientY - panStartTouchY.current;
        applyZoom(true);
        return;
      }
      if (e.touches.length === 1 && swStartAt.current) {
        const t = e.touches[0];
        const dx = t.clientX - swStartX.current;
        const dy = t.clientY - swStartY.current;
        // гасим прокрутку страницы при явном горизонтальном свайпе или тяге вниз
        if ((Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) || (dy > 10 && dy > Math.abs(dx))) {
          e.preventDefault();
        }
        return;
      }
      if (e.touches.length !== 2 || !pinchStartDist.current) return;
      e.preventDefault();
      const d = getDist(e.touches);
      zoomScale.current = Math.min(Math.max(pinchStartScale.current * (d / pinchStartDist.current), 1), 5);
      applyZoom(true);
    };

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDist.current = 0;
        pinchStartScale.current = zoomScale.current;
      }
      if (e.touches.length === 0 && isPanning.current) {
        isPanning.current = false;
      }
      if (swStartAt.current && e.changedTouches.length) {
        const t = e.changedTouches[0];
        const dx = t.clientX - swStartX.current;
        const dy = t.clientY - swStartY.current;
        const horiz = Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.25;
        const downToClose = dy >= 90 && dy > Math.abs(dx) * 1.25;
        if (horiz && SLIDES > 1) {
          e.preventDefault();
          lastTapAt.current = 0;
          if (dx < 0) navRef.current.next();
          else navRef.current.prev();
        } else if (downToClose) {
          e.preventDefault();
          lastTapAt.current = 0;
          navRef.current.close();
        }
        resetSwipe();
      }
    };

    // Мышиный dblclick с антидублем: тач-double-tap уже сработал → игнорируем dblclick 450мс
    const onDblClick = (e: MouseEvent) => {
      if (Date.now() - lastTouchDoubleTapAt.current < 450) {
        e.preventDefault();
        return;
      }
      doubleTap(e);
    };

    area.addEventListener("touchstart", onStart, { passive: false });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd);
    area.addEventListener("touchcancel", onEnd);
    area.addEventListener("dblclick", onDblClick);
    return () => {
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
      area.removeEventListener("dblclick", onDblClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, showPhoto, SLIDES]);

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
            flip(dx < 0 ? 1 : -1);
          }
        }}
        onMouseEnter={() => {
          if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
          setArrowsFast(true);
          setArrowsShown(true);
        }}
        onMouseLeave={() => {
          setArrowsFast(true);
          setArrowsShown(false);
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

        {/* Кнопка полноэкранного просмотра — снизу справа внутри фото (крупная, ×1.5). Пока фото не
            листали — «иконка + надпись»; как только начали листать, надпись плавно уезжает вправо и
            гаснет, а подложка сжимается до одной иконки со стрелками (минималистично). */}
        <button
          type="button"
          aria-label="Полноэкранный просмотр"
          onClick={() => openFullscreen(index)}
          className={cn(
            "absolute bottom-4 right-4 z-20 inline-flex items-center overflow-hidden rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-300 ease-out hover:bg-black/60",
            fsCollapsed ? "p-2.5" : "py-[9px] pl-[18px] pr-[14px]"
          )}
        >
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-lg font-medium leading-none transition-all duration-300 ease-out",
              fsCollapsed ? "max-w-0 translate-x-3 opacity-0" : "mr-2 max-w-[280px] translate-x-0 opacity-100"
            )}
          >
            Полноэкранный просмотр
          </span>
          <Maximize2 className="h-6 w-6 shrink-0" />
        </button>

        {/* Контент поверх фото (хлебные крошки, заголовок); pointer-events-none — чтобы клик по
            «пустым» местам фото доходил до кнопки полноэкранного просмотра под ним */}
        <div className="pointer-events-none relative z-10">{children}</div>
      </section>

      {/* Лента-превью — прилипает под шапкой; медленно едет справа налево (rAF-marquee, как в
          карточке экскурсии в разделе «Каталог»). Ленту можно зажать и прокрутить вручную; тап
          открывает полноэкранный просмотр. Активное фото подсвечивается синей рамкой (.mq-selected). */}
      {/* Распорка-сенсор перед лентой: держит место в потоке, когда лента переходит в fixed */}
      <div ref={stripSentinelRef} aria-hidden />
      <div style={{ height: stripPinned ? stripH : undefined }}>
        <div
          ref={stripRef}
          id="tour-photostrip"
          className={cn(
            "z-40 border-b border-hairline bg-bg",
            stripPinned ? "fixed inset-x-0 top-24" : "relative"
          )}
        >
          <Marquee
            draggable
            highlightCenter
            selectedIndex={index}
            onSelect={(i) => openFullscreen(i)}
            className="px-5 py-3 sm:px-8 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
            copyClassName="gap-2 pr-2"
            pxPerSecond={15.68}
          >
            {images.map((img, i) => (
              <GradientImage
                key={i}
                id={img}
                className="h-16 w-[86px] shrink-0 rounded-md sm:h-20 sm:w-[101px]"
                label={`${title} — фото ${i + 1}`}
              />
            ))}
          </Marquee>
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
            ref={photoAreaRef}
            className="relative min-h-0 flex-1"
            style={{ touchAction: "none" }}
            onMouseEnter={() => {
              if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
              setArrowsFast(true);
              setArrowsShown(true);
            }}
            onMouseLeave={() => {
              setArrowsFast(true);
              setArrowsShown(false);
            }}
          >
            {/* Реальное фото — зумируемый <img> (contain); заглушка-градиент — только листание/закрытие */}
            {showPhoto &&
              (isRealPhoto(images[index]) ? (
                <img
                  ref={zoomImgRef}
                  src={images[index]}
                  alt={`${title} — фото ${index + 1}`}
                  draggable={false}
                  onLoad={() => applyZoom(false)}
                  className="absolute inset-0 h-full w-full animate-fade-in select-none"
                  style={{ objectFit: "contain", transformOrigin: "center center", touchAction: "none" }}
                />
              ) : (
                <GradientImage
                  id={images[index]}
                  className="absolute inset-0 h-full w-full animate-fade-in"
                  label={`${title} — фото ${index + 1}`}
                />
              ))}

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
