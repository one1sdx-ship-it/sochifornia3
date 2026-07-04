"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Бесшовная лента (marquee), едет справа налево, на requestAnimationFrame.
// Почему rAF, а не CSS-анимация: rAF НЕ тикает, пока вкладка/окно скрыты или свёрнуты,
// а ограничение dt сверху не даёт «догнать» позицию рывком при возврате. Поэтому нет
// дёрганья при сворачивании браузера и переключении вкладок. Контент дублируется дважды
// (две копии подряд) для бесшовного цикла: сдвиг зацикливается на ширине одной копии.
//
// draggable=true: ленту можно зажать пальцем/мышью и прокрутить вручную (выбрать фото).
// При удержании авто-ход плавно затухает до нуля, при отпускании — плавно возобновляется.
// Лента при этом лежит выше растянутой ссылки карточки, поэтому тап по ней НЕ ведёт на страницу.
export function Marquee({
  children,
  pxPerSecond = 40,
  className,
  copyClassName,
  draggable = false,
  direction = "left",
  highlightCenter = false,
  onTap,
  selectedIndex,
  onSelect,
}: {
  children: React.ReactNode;
  pxPerSecond?: number;
  className?: string;
  copyClassName?: string;
  draggable?: boolean;
  direction?: "left" | "right";
  highlightCenter?: boolean;
  onTap?: () => void;
  // Управляемая подсветка: индекс выбранного элемента (в пределах одной копии). onSelect —
  // сообщает наружу выбор по тапу. Если заданы — подсветка по центру/внутренняя не используется.
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Держим актуальные колбэки/индекс в ref, чтобы не пересоздавать rAF-эффект при рендере родителя.
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let offset = 0;
    let half = track.scrollWidth / 2; // ширина одной копии контента
    let last = performance.now();
    let raf = 0;

    // Плавная остановка/возобновление: speed идёт к target (0 при удержании, 1 при отпускании).
    let speed = 1;
    let target = 1;
    // Состояние ручного перетаскивания.
    let dragging = false;
    let moved = false; // был ли это перетаскивание (иначе — тап)
    let startX = 0;
    let startY = 0;
    let startOffset = 0;
    let downTarget: EventTarget | null = null; // фото под пальцем в момент нажатия

    const isRight = direction === "right";
    const wrap = (v: number) => (half > 0 ? ((v % half) + half) % half : v);
    // translateX ленты. Влево: -offset (0 → -half). Вправо: offset - half (-half → 0). Оба цикла бесшовны.
    const tx = () => (isRight ? offset - half : -offset);

    // Подсветка «выбранного» элемента — ближайшего к центру видимой области ленты.
    const container = track.parentElement; // overflow-контейнер
    let items: HTMLElement[] = [];
    let perCopy = 0; // сколько элементов в одной копии (для сопоставления индекса между копиями)
    const collectItems = () => {
      items = [];
      for (const copy of Array.from(track.children)) {
        for (const it of Array.from((copy as HTMLElement).children)) items.push(it as HTMLElement);
      }
      perCopy = items.length / 2;
    };
    if (highlightCenter) collectItems();
    let sinceHl = 0; // аккумулятор времени между пересчётами подсветки
    // Ручной выбор фото по тапу; пока он задан — авто-подсветка по центру не перебивает его.
    let selectedEl: HTMLElement | null = null;
    const selectItem = (el: HTMLElement) => {
      selectedEl = el;
      for (const it of items) it.classList.toggle("mq-selected", it === el);
    };
    // Управляемая подсветка по индексу (одинаково в обеих копиях). Возвращает true, если применена.
    const applyControlledHighlight = () => {
      const si = selectedIndexRef.current;
      if (si == null || si < 0 || perCopy <= 0) return false;
      for (let i = 0; i < items.length; i++) items[i].classList.toggle("mq-selected", i % perCopy === si);
      return true;
    };
    const updateHighlight = () => {
      if (applyControlledHighlight()) return; // управляется извне (индексом)
      if (selectedEl) return; // выбрано вручную — не трогаем
      if (!container || items.length === 0) return;
      const crect = container.getBoundingClientRect();
      const cx = crect.left + crect.width / 2;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const it of items) {
        const r = it.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - cx);
        if (d < bestD) {
          bestD = d;
          best = it;
        }
      }
      for (const it of items) it.classList.toggle("mq-selected", it === best);
    };

    const onResize = () => {
      half = track.scrollWidth / 2;
      if (highlightCenter) collectItems();
    };
    window.addEventListener("resize", onResize);

    const step = (now: number) => {
      if (half <= 0) half = track.scrollWidth / 2; // на случай, если на 1-м кадре ещё не было раскладки
      // dt ограничиваем: после «спячки» (скрытая вкладка/свёрнутое окно) первый кадр не прыгает —
      // лента продолжает движение с того же места, а не «догоняет» пропущенное время.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Экспоненциальное сглаживание speed → target (плавный старт/стоп, ~0.25с).
      speed += (target - speed) * Math.min(dt * 6, 1);
      if (!dragging) {
        offset = wrap(offset + pxPerSecond * dt * speed);
      }
      track.style.transform = `translate3d(${tx()}px,0,0)`;
      if (highlightCenter) {
        sinceHl += dt;
        if (sinceHl >= 0.08) {
          // пересчитываем подсветку ~12 раз/с, а не каждый кадр (экономим layout-замеры)
          sinceHl = 0;
          updateHighlight();
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // --- Ручное перетаскивание (только в режиме draggable) ---
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      moved = false;
      target = 0; // авто-ход плавно затухает
      startX = e.clientX;
      startY = e.clientY;
      startOffset = offset;
      downTarget = e.target; // запоминаем фото до перехвата указателя (после capture e.target = track)
      track.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      // Лента следует за пальцем в обе стороны (знак зависит от направления авто-хода).
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // Любое заметное смещение (по X ИЛИ по Y) — уже не тап, перехода не будет.
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      offset = wrap(startOffset + (isRight ? dx : -dx));
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      target = 1; // плавно возобновляем ход
      // pointercancel = браузер забрал жест (напр. вертикальный скролл страницы) — это не тап.
      const isTap = !moved && e.type !== "pointercancel";
      // Тап (без перетаскивания): выбираем фото (если есть подсветка) и/или отдаём наружу
      // (для чипов onTap = переход на страницу экскурсии).
      if (isTap) {
        if (highlightCenter && downTarget) {
          const i = items.findIndex((x) => x.contains(downTarget as Node));
          if (i >= 0) {
            // Управляемо — отдаём индекс наружу; иначе выбираем локально.
            if (onSelectRef.current && perCopy > 0) onSelectRef.current(i % perCopy);
            else selectItem(items[i]);
          }
        }
        onTapRef.current?.();
      }
      try {
        track.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer уже отпущен */
      }
    };

    if (draggable) {
      track.addEventListener("pointerdown", onPointerDown);
      track.addEventListener("pointermove", onPointerMove);
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      // Тап по фото не должен «проваливаться» в ссылку карточки.
      track.addEventListener("click", (e) => e.preventDefault());
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (draggable) {
        track.removeEventListener("pointerdown", onPointerDown);
        track.removeEventListener("pointermove", onPointerMove);
        track.removeEventListener("pointerup", endDrag);
        track.removeEventListener("pointercancel", endDrag);
      }
    };
  }, [pxPerSecond, draggable, direction, highlightCenter]);

  return (
    <div className={cn("overflow-hidden", draggable && "relative z-10", className)}>
      <div
        ref={trackRef}
        className={cn("flex w-max will-change-transform", draggable && "cursor-grab touch-pan-y active:cursor-grabbing")}
      >
        <div className={cn("flex shrink-0", copyClassName)}>{children}</div>
        <div className={cn("flex shrink-0", copyClassName)} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
