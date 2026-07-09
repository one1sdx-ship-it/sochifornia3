"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useFilterDodge, FILTER_DODGE_Y } from "@/components/use-filter-dodge";
import { CALLBACK_OPEN_EVENT } from "@/components/callback-modal";

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
  const [callbackOpen, setCallbackOpen] = useState(false); // открыта ли панель «Перезвоните мне»
  const [dodgeAllowed, setDodgeAllowed] = useState(false); // «ворота»: разрешён ли подъём вверх (п.2)
  const dodging = useFilterDodge(); // прокрутка/листание фото → плавно опускаем и притушиваем

  // Пока открыта панель обратного звонка [[callback-modal]] — прячем закладку «Фильтры».
  useEffect(() => {
    const onToggle = (e: Event) => setCallbackOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(CALLBACK_OPEN_EVENT, onToggle);
    return () => window.removeEventListener(CALLBACK_OPEN_EVENT, onToggle);
  }, []);

  const visible = (onCatalog || (pathname === "/" && inView)) && !callbackOpen;
  // Подъём кнопки вверх применяем только когда открыты «ворота» dodgeAllowed (п.2): в каталоге —
  // спустя 2с после начала прокрутки, на главной — после того как блок экскурсии пробыл в зоне
  // видимости ≥2с. До этого кнопка при прокрутке остаётся на исходном месте.
  const dodgeActive = dodging && visible && dodgeAllowed;

  // «Ворота» для каталога (п.2): при каждом заходе на /tours сбрасываем разрешение и открываем
  // его лишь спустя 2с после ПЕРВОЙ прокрутки. На других страницах этот эффект ничего не слушает.
  useEffect(() => {
    setDodgeAllowed(false);
    if (!onCatalog) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let started = false;
    const onScroll = () => {
      if (started) return; // отсчёт 2с запускаем один раз — от начала прокрутки
      started = true;
      timer = setTimeout(() => setDodgeAllowed(true), 2000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [pathname, onCatalog]);

  // «Ворота» для главной (п.2): разрешаем подъём, только когда блок экскурсии непрерывно пробыл
  // в зоне видимости ≥2с. Если ушёл раньше — таймер сбрасывается (cleanup) и ждём следующего.
  // Как только блоки ушли из вида — сбрасываем разрешение (п.3), чтобы при обратной прокрутке
  // кнопка появилась в ИСХОДНОМ состоянии (не сдвинута, полностью видима), а не сохраняла «верхнее
  // полупрозрачное» положение с момента исчезновения.
  useEffect(() => {
    if (pathname !== "/") return;
    if (!inView) {
      setDodgeAllowed(false);
      return;
    }
    const t = setTimeout(() => setDodgeAllowed(true), 2000);
    return () => clearTimeout(t);
  }, [pathname, inView]);

  // При прокрутке кнопка уезжает не вниз, а сильно ВВЕРХ — к шапке (п.4). Базовый top кнопки
  // динамический (min(60%, …)), поэтому нужный сдвив считаем замером: цель — верх кнопки в 20px
  // под нижним краём шапки. Значение отрицательное (вверх). Исходное положение не меняем.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dodgeUp, setDodgeUp] = useState(0);
  // Замер делаем ТОЛЬКО в покое — при монтировании и на resize (п.5). Раньше он пересчитывался и во
  // время анимации возврата (когда dodgeActive гас), а getBoundingClientRect в этот момент отдаёт
  // промежуточную позицию едущей кнопки → dodgeUp портился, и следующий сдвиг вверх не срабатывал.
  // На старте transform кнопки в покое (dodge=0), поэтому rect.top = её исходный верх — корректно.
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const header = document.querySelector("header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 96;
      const restTop = el.getBoundingClientRect().top; // верх кнопки в исходном положении
      setDodgeUp(Math.min(0, headerBottom + 20 - restTop));
    };
    const raf = requestAnimationFrame(measure); // ждём финальный layout
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, []);

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
      ref={wrapRef}
      className="fixed left-0 z-40 transition-[transform,opacity] duration-500 ease-out lg:hidden"
      style={{
        // Верх: обычно 60% высоты, но на высоких экранах (Poco F2 Pro и т.п.) не ниже, чем
        // «экран минус нижний коридор кнопок»: резервируем место под опускание (FILTER_DODGE_Y),
        // саму закладку (~72px) и зону нижних плавающих кнопок «Наверх»/навигации (~172px).
        // Иначе 60% + опускание наезжает на кнопку «Наверх» у нижнего края.
        top: `min(60%, calc(100% - ${FILTER_DODGE_Y + 128 + 172}px))`,
        // X: показ/скрытие слева (закладка вплотную к левому краю); Y: центрирование (-50%) + подъём к шапке при прокрутке (п.4)
        transform: `translateX(${visible ? "0" : "-100%"}) translateY(calc(-50% + ${dodgeActive ? dodgeUp : 0}px))`,
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
