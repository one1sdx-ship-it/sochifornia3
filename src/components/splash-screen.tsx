"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { cn } from "@/lib/utils";

// Заставка показывается при каждой полной загрузке страницы и ВСЕГДА уходит плавно.
// Гейт через sessionStorage убран намеренно: он давал «мгновенное» исчезновение при повторных
// перезагрузках (когда ключ уже стоял). Компонент живёт в root-layout и при внутренних
// клиентских переходах не перемонтируется, поэтому эффект и так отрабатывает один раз за загрузку.
const SHOW_MS = 2000;
const FADE_MS = 500;

export function SplashScreen() {
  // Стартуем видимой: заставка попадает в SSR-разметку и перекрывает сайт с первого
  // кадра, поэтому сайт не «мелькает» раньше вступительной страницы.
  const [visible, setVisible] = useState(true);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    // Показали SHOW_MS — затем всегда плавно скрываем (см. эффект по [hiding])
    const t = setTimeout(() => setHiding(true), SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  // Пока заставка полностью видима — прокрутка страницы отключена (в т.ч. Lenis).
  // Замок снимаем в момент СТАРТА исчезновения (hiding), а не после 500мс фейда: мобильный
  // браузер классифицирует жест в момент касания, и свайп, начатый при ещё заблокированной
  // прокрутке (например, сразу после тапа-скипа по заставке), оставался «мёртвым» до
  // отпускания пальца — прокрутка «не работала». Во время фейда заставка уже прозрачнеет и
  // pointer-events-none, так что ранняя разблокировка ничего не ломает.
  useEffect(() => {
    if (hiding) return;
    stopScroll();
    return () => startScroll();
  }, [hiding]);

  useEffect(() => {
    if (!hiding) return;
    const t = setTimeout(() => setVisible(false), FADE_MS);
    return () => clearTimeout(t);
  }, [hiding]);

  if (!visible) return null;

  return (
    <div
      onClick={() => setHiding(true)}
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 bg-white transition-opacity",
        hiding ? "pointer-events-none opacity-0 duration-500 ease-in" : "opacity-100 duration-300 ease-out"
      )}
    >
      <div className="flex animate-fade-up flex-col items-center gap-6">
        <Image
          src="/LogoSochi.png"
          alt="Sochifornia Travel"
          width={320}
          height={320}
          priority
          className="animate-splash-title h-[22.1rem] w-[22.1rem] rounded-2xl object-contain sm:h-[30.3875rem] sm:w-[30.3875rem]"
        />
      </div>
    </div>
  );
}
