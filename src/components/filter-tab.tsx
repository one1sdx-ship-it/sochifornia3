"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useFilterDodge, FILTER_DODGE_Y } from "@/components/use-filter-dodge";

// Событие «открыть панель фильтров»: единая плавающая кнопка шлёт его, когда мы уже в каталоге,
// а список с панелью (CatalogFilters) его слушает.
export const OPEN_FILTERS_EVENT = "sf:openFiltersPanel";

// Якорь блока экскурсий на главной — пока он в зоне видимости, кнопка «Фильтры» видна.
const HOME_ANCHOR = "home-tours-anchor";

// Единая плавающая закладка «Фильтры» (мобильные). ОДНА на весь сайт, живёт в layout и НЕ
// пересоздаётся при переходах между страницами — поэтому её положение/затухание не «прыгает»
// (раньше было две кнопки с общим состоянием, и вторая при входе рывком повторяла позицию первой).
// Видна: в каталоге (/tours) — всегда; на главной — пока блок экскурсий в зоне видимости; иначе скрыта.
export function FilterTab() {
  const pathname = usePathname();
  const router = useRouter();
  const onCatalog = pathname === "/tours";
  const [inView, setInView] = useState(false); // блок экскурсий на главной в зоне видимости
  const dodging = useFilterDodge(); // прокрутка/листание фото → плавно опускаем и притушиваем

  const visible = onCatalog || (pathname === "/" && inView);
  const dodgeActive = dodging && visible; // опускаем только видимую кнопку

  // На главной следим за блоком экскурсий; на остальных страницах наблюдатель не нужен.
  useEffect(() => {
    if (pathname !== "/") {
      setInView(false);
      return;
    }
    const el = document.getElementById(HOME_ANCHOR);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [pathname]);

  const openFilters = () => {
    if (onCatalog) {
      window.dispatchEvent(new Event(OPEN_FILTERS_EVENT)); // уже в каталоге — просто открыть панель
    } else {
      // на главной — уходим в каталог; сигнал каталогу открыть панель сразу на входе
      try { sessionStorage.setItem("sf:openFilters", "1"); } catch {}
      router.push("/tours");
    }
  };

  // Действие должно срабатывать СРАЗУ, даже во время инерции прокрутки (Lenis), когда обычный
  // click «съедается» остановкой инерции. Поэтому реагируем на pointerdown (нажатие), а click
  // от того же нажатия гасим флагом. Для клавиатуры/скринридеров (без pointerdown) остаётся click.
  const firedRef = useRef(false);
  const onPointerDown = () => {
    firedRef.current = true;
    openFilters();
  };
  const onClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    openFilters();
  };

  return (
    <div
      className="fixed left-0 top-[60%] z-40 transition-[transform,opacity] duration-500 ease-out lg:hidden"
      style={{
        // X: показ/скрытие слева (закладка вплотную к левому краю); Y: центрирование (-50%) + опускание при прокрутке
        transform: `translateX(${visible ? "0" : "-100%"}) translateY(calc(-50% + ${dodgeActive ? FILTER_DODGE_Y : 0}px))`,
        opacity: visible ? (dodgeActive ? 0.45 : 1) : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={onClick}
        aria-label={onCatalog ? "Открыть фильтры" : "Перейти к фильтрам в каталоге"}
        className="flex items-center gap-2 rounded-r-md bg-blue-600 px-2.5 py-5 text-sm font-semibold text-white shadow-float [writing-mode:vertical-rl]"
      >
        <SlidersHorizontal className="h-4 w-4" /> Фильтры
      </button>
    </div>
  );
}
