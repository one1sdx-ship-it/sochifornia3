"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

let lenisInstance: Lenis | null = null;

// Прокрутка к самому верху: нативно (надёжно) + синхронизация Lenis
export function scrollToTop() {
  window.scrollTo(0, 0);
  lenisInstance?.scrollTo(0, { immediate: true });
}

// Плавный возврат наверх, устойчивый к активной инерции прокрутки.
// Командуем ИМЕННО Lenis (владелец скролла) с force — иначе нативный window.scrollTo во
// время инерции Lenis каждый кадр перебивается, и возврат «не срабатывает» с первого раза
// (визуально прокрутка лишь резко останавливается). Здесь возврат идёт сразу.
export function smoothScrollToTop() {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { force: true });
  } else {
    window.scrollTo(0, 0); // reduced-motion / Lenis отключён — мгновенно
  }
}

// Плавный переход к якорю (id элемента) — той же схемой, что smoothScrollToTop: командуем
// ИМЕННО Lenis с force, потому что нативный прыжок по hash во время его инерции/анимации
// перебивается кадровым scrollTo, и переход «не срабатывает». Учитываем scroll-margin-top
// элемента (нативный якорный переход его уважает, Lenis сам — нет).
export function smoothScrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) {
    const offset = -(parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    lenisInstance.scrollTo(el, { force: true, offset });
  } else {
    el.scrollIntoView(); // reduced-motion / Lenis отключён — нативно
  }
}

// Прокрутка к абсолютной позиции Y (синхронно с Lenis — владельцем скролла).
// immediate=true — мгновенно (напр. под открывающейся панелью заявки прокрутки не видно).
export function scrollToY(y: number, immediate = false) {
  if (lenisInstance) lenisInstance.scrollTo(y, immediate ? { immediate: true } : { force: true });
  else window.scrollTo(0, y);
}

// Прерываемая кастомная прокрутка: анимируем от ТЕКУЩЕЙ позиции скролла собственным rAF.
// Так нет рывка/проскока, который давал Lenis.scrollTo (его внутренняя позиция на тач-скролле
// расходится с реальной, из-за чего анимация «прыгала» в начале).
let centerRAF: number | null = null;
let centerTargetY: number | null = null; // цель текущей анимации центрирования

// Плавно и медленно подтянуть элемент ровно к центру экрана (листание стрелками/боковыми зонами)
export function scrollElementToCenter(el: HTMLElement | null, duration = 1200) {
  if (!el) return;
  const startY = window.scrollY;
  const rect = el.getBoundingClientRect();
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const targetY = Math.min(maxY, Math.max(0, startY + rect.top + rect.height / 2 - window.innerHeight / 2));

  // Если анимация к тому же центру уже идёт — НЕ перезапускаем её. Иначе каждое нажатие
  // стрелки сбрасывало бы ease в начало, и центрирование «тормозило» бы при частом листании.
  // Блок при листании не смещается, поэтому цель стабильна — даём анимации спокойно доехать.
  if (centerRAF !== null && centerTargetY !== null && Math.abs(targetY - centerTargetY) < 4) return;

  const dist = targetY - startY;
  if (Math.abs(dist) < 1) return;
  if (centerRAF !== null) cancelAnimationFrame(centerRAF); // цель заметно сменилась — перецелиться
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetY);
    return;
  }
  centerTargetY = targetY;
  const start = performance.now();
  const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2; // easeInOutSine — мягко, без рывков
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, startY + dist * ease(t));
    if (t < 1) {
      centerRAF = requestAnimationFrame(step);
    } else {
      centerRAF = null;
      centerTargetY = null;
    }
  };
  centerRAF = requestAnimationFrame(step);
}

// Остановить/возобновить прокрутку (полноэкранный просмотр фото, панель заявки и т.п.):
// одного overflow:hidden недостаточно, т.к. Lenis сам крутит window.scrollTo по wheel/touch.
//
// Замки́ считаются: разные компоненты могут блокировать прокрутку независимо и одновременно
// (напр. поверх открытой панели заявки открыли просмотр фото). Разблокируем только когда сняты
// ВСЕ замки́ — иначе закрытие одного разблокировало бы страницу под ещё открытым другим.
let scrollLocks = 0;

export function stopScroll() {
  scrollLocks++;
  if (scrollLocks === 1) {
    lenisInstance?.stop();
    document.body.style.overflow = "hidden";
  }
}

export function startScroll() {
  if (scrollLocks === 0) return;
  scrollLocks--;
  if (scrollLocks === 0) {
    lenisInstance?.start();
    document.body.style.overflow = "";
  }
}

export const SCROLL_TOP_EVENT = "app:scrolltop";

export function SmoothScroll() {
  const pathname = usePathname();
  // Навигация «назад/вперёд» (кнопка Android) — чтобы НЕ прокручивать наверх, а вернуть позицию
  const isPopRef = useRef(false);
  // Сохранённые позиции скролла по маршрутам (для восстановления при возврате назад)
  const positionsRef = useRef<Map<string, number>>(new Map());

  // Всегда стартуем сверху (в т.ч. при перезагрузке), без восстановления позиции
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Помечаем переходы «назад/вперёд»: popstate срабатывает до смены pathname
  useEffect(() => {
    const onPop = () => {
      isPopRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Непрерывно запоминаем позицию скролла текущего маршрута
  useEffect(() => {
    const save = () => positionsRef.current.set(window.location.pathname, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenisInstance = lenis;
    let raf: number;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  // Прокрутка наверх при смене страницы и при первой загрузке (кроме якорных ссылок).
  // Исключение: возврат «назад» (кнопка Android) — сохраняем позицию, не прыгаем наверх,
  // напр. со страницы экскурсии обратно в каталог остаёмся на прежнем месте.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) return;
    if (isPopRef.current) {
      isPopRef.current = false;
      const y = positionsRef.current.get(pathname);
      if (y != null) {
        requestAnimationFrame(() => {
          window.scrollTo(0, y);
          lenisInstance?.scrollTo(y, { immediate: true });
        });
      }
      return;
    }
    // Навигация ради открытия панели заявки (кнопка «Выбрать» из [[tour-card]]): НЕ прыгаем
    // наверх — [[lead-overlay]] сам спозиционирует скролл так, чтобы основная форма встала под
    // формой оверлея. Иначе этот scrollToTop перебил бы его scrollToY, и панель открывалась бы
    // над началом страницы. Флаг читаем синхронно (до rAF): rAF оверлея, снимающий флаг, ещё
    // не запускался, поэтому гонки нет — решение принимаем раньше, чем флаг успеют снять.
    let openingLead = false;
    try {
      openingLead = sessionStorage.getItem("sf:open-lead") === "1";
    } catch {}
    if (openingLead) return;
    requestAnimationFrame(() => scrollToTop());
  }, [pathname]);

  // Явный запрос «наверх» (клик по логотипу)
  useEffect(() => {
    const handler = () => scrollToTop();
    window.addEventListener(SCROLL_TOP_EVENT, handler);
    return () => window.removeEventListener(SCROLL_TOP_EVENT, handler);
  }, []);

  return null;
}
