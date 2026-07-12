"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, Phone, X } from "lucide-react";
import { nav, site } from "@/data/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SCROLL_TOP_EVENT } from "@/components/smooth-scroll";
import { CALLBACK_CLOSE_EVENT } from "@/components/callback-modal";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Закрытие мобильного меню с анимацией «уезжает вправо» (синхронно с slide-out-right)
  const closeMenu = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-hairline bg-bg/80 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="container-wide flex h-24 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label={site.name}
          onClick={() => {
            window.dispatchEvent(new Event(SCROLL_TOP_EVENT));
            // Если открыта панель «Перезвоните мне» — закрываем её сразу.
            window.dispatchEvent(new Event(CALLBACK_CLOSE_EVENT));
          }}
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-[15px] font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={site.phoneHref}
            className="hidden items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-primary sm:flex"
          >
            <Phone className="h-4 w-4 text-primary" />
            {site.phone}
          </a>
          <ThemeToggle />
          <Button href="/tours" size="sm" className="hidden sm:inline-flex">
            Выбрать тур
          </Button>
          <button
            type="button"
            aria-label="Открыть меню"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>

    {/* Мобильное меню */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className={cn(
              "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
              closing ? "opacity-0" : "opacity-100"
            )}
            onClick={closeMenu}
          />
          <div
            className={cn(
              "absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-bg p-6 shadow-float",
              closing ? "animate-slide-out-right" : "animate-slide-in-right"
            )}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={closeMenu}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-1">
              {/* В мобильном меню раздел «Гиды» скрыт (остаётся в десктоп-навигации). */}
              {nav.filter((item) => item.href !== "/guides").map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-lg px-4 py-3 text-lg font-medium text-ink transition-colors hover:bg-surface-2"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/#gallery"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-lg font-medium text-ink transition-colors hover:bg-surface-2"
              >
                Галерея впечатлений
              </Link>
            </nav>
            <div className="mt-auto space-y-3 pt-6">
              <a href={site.phoneHref} className="flex items-center gap-2 text-lg font-semibold text-ink">
                <Phone className="h-5 w-5 text-primary" /> {site.phone}
              </a>
              <p className="text-sm text-muted">{site.workingHours}</p>
              <Button
                href="/tours"
                size="lg"
                className="w-full"
                onClick={() => {
                  // меню уезжает вправо, переход в «Каталог» и однократная прокрутка его наверх
                  closeMenu();
                  window.dispatchEvent(new Event(SCROLL_TOP_EVENT));
                }}
              >
                Выбрать экскурсию
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/LogoSochi.png"
        alt="Sochifornia Travel"
        width={72}
        height={72}
        className="h-[72px] w-[72px] rounded-xl object-contain"
        priority
      />
      <span className="font-display text-[1.2375rem] font-bold tracking-tight text-ink">
        Sochifornia Travel
      </span>
    </span>
  );
}
