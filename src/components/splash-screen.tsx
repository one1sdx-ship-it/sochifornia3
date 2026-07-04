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

  // Пока заставка на экране — прокрутка страницы отключена (в т.ч. Lenis)
  useEffect(() => {
    if (!visible) return;
    stopScroll();
    return () => startScroll();
  }, [visible]);

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
          className="h-[13.6rem] w-[13.6rem] rounded-2xl object-contain sm:h-[18.7rem] sm:w-[18.7rem]"
        />
        <span className="animate-splash-title font-display text-[2.25rem] font-bold tracking-tight text-primary sm:text-[2.8125rem]">
          Sochifornia Travel
        </span>
      </div>
    </div>
  );
}
