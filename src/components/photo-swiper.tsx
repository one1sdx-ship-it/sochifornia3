"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GradientImage } from "@/components/gradient-image";
import { cn } from "@/lib/utils";

// Свайп-карусель главного фото карточки: удержание + движение влево/вправо перелистывает фото
// со «снапом» к ближайшему слайду. Листание БЕСКОНЕЧНОЕ в обе стороны — на краях не упирается,
// а бесшовно перескакивает через клоны крайних слайдов ([lastClone, ...images, firstClone]).
// Вертикальный жест не мешает прокрутке страницы (touch-pan-y). Чистый тап (без движения) → onTap.
//
// posRef — единственный источник истины о текущей позиции (обновляется синхронно), поэтому быстрые
// свайпы не «убегают» за пределы трека: в начале каждого жеста позиция с клона нормализуется в
// реальный слайд, а математика драга ведётся от зафиксированного startPos.
export function PhotoSwiper({
  images,
  label,
  onTap,
  imgClassName,
  index,
  onIndexChange,
}: {
  images: string[];
  label?: string;
  onTap?: () => void;
  imgClassName?: string;
  // Управляемый индекс активного фото (для синхронизации с каруселью-лентой снизу).
  index?: number;
  onIndexChange?: (index: number) => void;
}) {
  const n = images.length;
  // pos — позиция в расширенном треке [clone, 0..n-1, clone]: реальный слайд i лежит в pos = i+1.
  const [pos, setPos] = useState((index ?? 0) + 1);
  const posRef = useRef(pos);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, startPos: pos, dx: 0, moved: false, w: 0, notified: false });
  const lastReported = useRef(index ?? 0); // чтобы не реагировать на собственное эхо через onIndexChange

  const logicalFromPos = (p: number) => (((p - 1) % n) + n) % n;

  // Сообщаем всему приложению о взаимодействии с каруселью фото (п.3): кнопка «Фильтры»
  // [[use-filter-dodge]] отъезжает вверх и притухает так же, как при прокрутке страницы.
  const notifyCarousel = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("app:carousel"));
  };

  // Стрелки листания — та же логика затухания, что и на большом фото страницы экскурсии:
  // проявляются на 100% при смене фото/наведении и мягко гаснут до 55% за 2с.
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
  useEffect(() => {
    flashArrows();
    return () => {
      if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
    };
  }, []);

  const setTransform = (value: string, animate: boolean) => {
    const t = trackRef.current;
    if (!t) return;
    t.style.transition = animate ? "" : "none";
    t.style.transform = value;
  };

  // Единственный способ поменять позицию: синхронно двигаем posRef + DOM, затем состояние.
  const applyPos = (p: number, animate: boolean) => {
    posRef.current = p;
    setTransform(`translate3d(-${p * 100}%,0,0)`, animate);
    setPos(p);
  };

  // Если стоим на клоне — бесшовно перепрыгиваем на реальный слайд и ПРИНУДИТЕЛЬНО фиксируем
  // эту позицию (reflow через getBoundingClientRect). Без этого нормализация и следующая анимация
  // склеиваются в один кадр, и трек анимируется от клона ЧЕРЕЗ ВЕСЬ ряд — фото «пролетают»,
  // выпирают по краям и не встают ровно на место.
  const normalizeClone = () => {
    if (posRef.current === 0) applyPos(n, false);
    else if (posRef.current === n + 1) applyPos(1, false);
    void trackRef.current?.getBoundingClientRect();
  };

  // Листание стрелкой на ±1 слайд (с нормализацией клона, как в начале жеста).
  const flip = (dir: number) => {
    flashArrows();
    normalizeClone();
    const next = posRef.current + dir;
    applyPos(next, true);
    const logical = logicalFromPos(next);
    lastReported.current = logical;
    onIndexChange?.(logical);
    notifyCarousel(); // п.3: листание стрелкой/тапом-в-край → «Фильтры» отъезжает
  };

  // Внешнее изменение index (напр. тап по ленте-карусели) — переставляем реальный слайд.
  useEffect(() => {
    if (index === undefined || index === lastReported.current) return;
    lastReported.current = index;
    normalizeClone();
    applyPos(index + 1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Если жест начинается на клоне (после предыдущего быстрого свайпа) — нормализуем в реальный слайд.
    if (posRef.current === 0) applyPos(n, false);
    else if (posRef.current === n + 1) applyPos(1, false);
    const w = containerRef.current?.clientWidth ?? 0;
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, startPos: posRef.current, dx: 0, moved: false, w, notified: false };
    if (trackRef.current) trackRef.current.style.transition = "none";
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true; // любое смещение — уже не тап
    // Горизонтальное протягивание карусели (п.3): при первом же заметном сдвиге вбок сообщаем о
    // взаимодействии — «Фильтры» отъезжает, как при прокрутке. Вертикальный жест не считаем (это
    // прокрутка страницы, её ловит window scroll).
    if (!d.notified && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      d.notified = true;
      notifyCarousel();
    }
    d.dx = dx;
    if (d.w > 0) setTransform(`translate3d(${-d.startPos * d.w + dx}px,0,0)`, false);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const threshold = Math.max(40, d.w * 0.15);
    let next = d.startPos;
    if (d.dx <= -threshold) next = d.startPos + 1; // вперёд (может уйти в клон справа = n+1)
    else if (d.dx >= threshold) next = d.startPos - 1; // назад (может уйти в клон слева = 0)
    applyPos(next, true); // всегда императивно — работает и «снап назад» к той же позиции
    if (next !== d.startPos) {
      const logical = logicalFromPos(next);
      lastReported.current = logical;
      onIndexChange?.(logical);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* указатель уже отпущен */
    }
    // Чистый тап (без движения). Делим фото на 3 условные вертикальные зоны:
    //   • боковые по 22% — листают фото (как стрелки), НЕ открывая экскурсию;
    //   • центральные 56% — переход на страницу экскурсии (onTap).
    // Удержание с движением сюда не попадает (d.moved === true) — им занимается логика драга выше,
    // поэтому потянув в любой зоне (в т.ч. боковой) пользователь просто листает.
    if (!d.moved && e.type !== "pointercancel") {
      const rect = containerRef.current?.getBoundingClientRect();
      const relX = rect && rect.width > 0 ? (d.startX - rect.left) / rect.width : 0.5;
      if (relX < 0.22) flip(-1);
      else if (relX > 0.78) flip(1);
      else onTap?.();
    }
  };

  // По окончании анимации, если оказались на клоне — бесшовно (без анимации) прыгаем на реальный слайд.
  const onTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return; // только анимация трека, не всплывшая от дочерних фото
    if (drag.current.active) return; // идёт новый жест — нормализация уже произошла в onPointerDown
    if (posRef.current === 0) applyPos(n, false);
    else if (posRef.current === n + 1) applyPos(1, false);
  };

  // Расширенный трек: клон последнего + оригиналы + клон первого.
  const slides = [images[n - 1], ...images, images[0]];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 touch-pan-y overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={() => {
        if (arrowHideTimer.current) clearTimeout(arrowHideTimer.current);
        setArrowsFast(true);
        setArrowsShown(true);
      }}
      onMouseLeave={() => {
        setArrowsFast(true);
        setArrowsShown(false);
      }}
      onClickCapture={(e) => e.preventDefault()} // тап не должен «проваливаться» в ссылку карточки
    >
      <div
        ref={trackRef}
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translate3d(-${pos * 100}%,0,0)` }}
        onTransitionEnd={onTransitionEnd}
      >
        {slides.map((img, i) => (
          // overflow-hidden на слоте: hover-зум (scale-105) обрезается рамкой кадра и не «выпирает»
          // в соседний слайд на шве во время перелистывания.
          <div key={i} className="relative h-full w-full shrink-0 overflow-hidden">
            <GradientImage
              id={img}
              className={cn("h-full w-full", imgClassName)}
              label={`${label ?? "Фото"} — фото ${((((i - 1) % n) + n) % n) + 1}`}
            />
          </div>
        ))}
      </div>

      {/* Минималистичные стрелки по бокам — листают фото, не открывая карточку. stopPropagation на
          pointerdown/click, чтобы жест не считался свайпом/тапом контейнера и не вёл на страницу тура. */}
      <button
        type="button"
        aria-label="Предыдущее фото"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          flip(-1);
        }}
        style={{ opacity: arrowsShown ? 1 : 0.55, transition: `opacity ${arrowsFast ? 300 : 2000}ms ease` }}
        className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Следующее фото"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          flip(1);
        }}
        style={{ opacity: arrowsShown ? 1 : 0.55, transition: `opacity ${arrowsFast ? 300 : 2000}ms ease` }}
        className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
      >
        <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}
