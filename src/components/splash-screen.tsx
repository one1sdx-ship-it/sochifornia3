"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { cn } from "@/lib/utils";

// Показываем один раз за сессию браузера (не при каждом внутреннем переходе по сайту)
const SPLASH_SESSION_KEY = "sochifornia:splash-seen";
const SHOW_MS = 1200;
const FADE_MS = 500;

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) return;
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    setVisible(true);
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
        "fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 bg-ink transition-opacity",
        hiding ? "pointer-events-none opacity-0 duration-500 ease-in" : "opacity-100 duration-300 ease-out"
      )}
    >
      <div className="flex animate-fade-up flex-col items-center gap-6">
        <Image
          src="/LogoSochi.png"
          alt="Sochifornia Travel"
          width={176}
          height={176}
          priority
          className="h-32 w-32 rounded-2xl object-contain sm:h-44 sm:w-44"
        />
        <span className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Sochifornia Travel
        </span>
      </div>
    </div>
  );
}
