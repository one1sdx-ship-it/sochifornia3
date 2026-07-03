"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

let lenisInstance: Lenis | null = null;

// Прокрутка к самому верху: нативно (надёжно) + синхронизация Lenis
export function scrollToTop() {
  window.scrollTo(0, 0);
  lenisInstance?.scrollTo(0, { immediate: true });
}

// Прерываемая кастомная прокрутка: анимируем от ТЕКУЩЕЙ позиции скролла собственным rAF.
// Так нет рывка/проскока, который давал Lenis.scrollTo (его внутренняя позиция на тач-скролле
// расходится с реальной, из-за чего анимация «прыгала» в начале).
let centerRAF: number | null = null;

// Плавно и медленно подтянуть элемент ровно к центру экрана (листание стрелками/боковыми зонами)
export function scrollElementToCenter(el: HTMLElement | null, duration = 1200) {
  if (!el) return;
  if (centerRAF !== null) cancelAnimationFrame(centerRAF); // прервать прошлую анимацию (быстрые нажатия)
  const startY = window.scrollY;
  const rect = el.getBoundingClientRect();
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const targetY = Math.min(maxY, Math.max(0, startY + rect.top + rect.height / 2 - window.innerHeight / 2));
  const dist = targetY - startY;
  if (Math.abs(dist) < 1) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetY);
    return;
  }
  const start = performance.now();
  const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2; // easeInOutSine — мягко, без рывков
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, startY + dist * ease(t));
    centerRAF = t < 1 ? requestAnimationFrame(step) : null;
  };
  centerRAF = requestAnimationFrame(step);
}

// Остановить/возобновить прокрутку (полноэкранный просмотр фото и т.п.):
// одного overflow:hidden недостаточно, т.к. Lenis сам крутит window.scrollTo по wheel/touch.
export function stopScroll() {
  lenisInstance?.stop();
  document.body.style.overflow = "hidden";
}

export function startScroll() {
  lenisInstance?.start();
  document.body.style.overflow = "";
}

export const SCROLL_TOP_EVENT = "app:scrolltop";

export function SmoothScroll() {
  const pathname = usePathname();

  // Всегда стартуем сверху (в т.ч. при перезагрузке), без восстановления позиции
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
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

  // Прокрутка наверх при смене страницы и при первой загрузке (кроме якорных ссылок)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) return;
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
