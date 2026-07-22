"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { GradientImage } from "@/components/gradient-image";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { cn } from "@/lib/utils";

// Переиспользуемый полноэкранный просмотрщик фотографий: зум (pinch / двойной тап / dblclick),
// панорамирование увеличенного фото, свайп для листания и тяга вниз для закрытия, стрелки,
// клавиши (Esc / ←/→) и лента-превью снизу. Логика жестов и зума портирована из
// [[tour-hero-carousel]], поэтому поведение здесь ровно такое же, как при «обычном» просмотре
// фотографий на странице экскурсии.
//
// Монтируется родителем по необходимости; стартовый кадр — startIndex, закрытие — через onClose
// (после короткой анимации ухода). Прокрутка страницы блокируется на время показа.
export function PhotoLightbox({
  images,
  title,
  startIndex = 0,
  onClose,
}: {
  images: string[];
  title?: string;
  startIndex?: number;
  onClose: () => void;
}) {
  const SLIDES = images.length;
  const [index, setIndex] = useState(startIndex);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThumb = useRef<HTMLButtonElement | null>(null);

  const go = (i: number) => setIndex(((i % SLIDES) + SLIDES) % SLIDES);

  // Стрелки: проявляются на 100% при смене фото/наведении и мягко гаснут до 55% за 2с —
  // та же логика, что на большом фото страницы экскурсии.
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

  const close = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 260);
  };

  // Блокируем прокрутку страницы, пока открыт просмотр (снимаем при размонтировании).
  useEffect(() => {
    stopScroll();
    flashArrows();
    return () => {
      startScroll();
      if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Активная миниатюра всегда в зоне видимости ленты.
  useEffect(() => {
    activeThumb.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  // Esc и стрелки клавиатуры.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") flip(-1);
      if (e.key === "ArrowRight") flip(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, closing]);

  // ===== Зум и жесты (портировано из [[tour-hero-carousel]]) =====
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

  // Реальное фото (можно зумить) vs градиентная заглушка (только листание/закрытие).
  const isRealPhoto = (id: string) => id.startsWith("/") || id.startsWith("http");

  // Навигацию/закрытие зовём через ref — чтобы нативные слушатели не переподключались на каждый index.
  const navRef = useRef({ next: () => {}, prev: () => {}, close: () => {} });
  navRef.current.next = () => flip(1);
  navRef.current.prev = () => flip(-1);
  navRef.current.close = () => close();

  // Границы pan считаем от вписанного размера (object-fit: contain) и текущего зума.
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

  // interactive=true — во время жеста, без CSS-перехода (фото идёт за пальцем).
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

  // Сброс зума при любой смене фото.
  useEffect(() => {
    resetZoomState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Нативные тач-слушатели с { passive: false } — иначе preventDefault() не сработает.
  useEffect(() => {
    const area = photoAreaRef.current;
    if (!area) return;
    resetZoomState();

    const getDist = (t: TouchList) =>
      Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);

    const resetSwipe = () => {
      swStartX.current = 0;
      swStartY.current = 0;
      swStartAt.current = 0;
    };

    // Двойной тап/клик: ступени 2× → 4× → сброс; если зумили вручную (pinch) — сразу сброс.
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
      // Два пальца → начало pinch-зума.
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

    // Мышиный dblclick с антидублем: тач-double-tap уже сработал → игнорируем dblclick 450мс.
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
  }, [SLIDES]);

  const label = title ?? "Фото";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-black",
        closing ? "animate-fade-out" : "animate-fade-in"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр фотографий: ${label}`}
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={close}
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
        {isRealPhoto(images[index]) ? (
          <img
            ref={zoomImgRef}
            src={images[index]}
            alt={`${label} — фото ${index + 1}`}
            draggable={false}
            onLoad={() => applyZoom(false)}
            className="absolute inset-0 h-full w-full select-none"
            style={{ objectFit: "contain", transformOrigin: "center center", touchAction: "none" }}
          />
        ) : (
          <GradientImage
            id={images[index]}
            className="absolute inset-0 h-full w-full"
            label={`${label} — фото ${index + 1}`}
          />
        )}

        {/* Стрелки листания — только при нескольких фото */}
        {SLIDES > 1 && (
          <>
            <button
              type="button"
              aria-label="Предыдущее фото"
              onClick={() => flip(-1)}
              style={{ opacity: arrowsShown ? 1 : 0.55, transition: `opacity ${arrowsFast ? 300 : 2000}ms ease` }}
              className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Следующее фото"
              onClick={() => flip(1)}
              style={{ opacity: arrowsShown ? 1 : 0.55, transition: `opacity ${arrowsFast ? 300 : 2000}ms ease` }}
              className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
            >
              <ChevronRight className="h-7 w-7" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Лента-превью снизу на чёрном фоне — та же логика выбора/пролистывания */}
      {SLIDES > 1 && (
        <div className="shrink-0 border-t border-white/10 bg-black">
          <div className="flex gap-2 overflow-x-auto px-5 py-3 sm:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, i) => (
              <button
                key={i}
                ref={i === index ? activeThumb : null}
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
                {isRealPhoto(img) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-full w-full object-cover" />
                ) : (
                  <GradientImage id={img} className="h-full w-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
