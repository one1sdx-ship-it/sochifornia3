"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Compass, Images, MessageCircle, Phone, Star } from "lucide-react";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";
import { smoothScrollToTop } from "@/components/smooth-scroll";

const items = [
  { label: "Каталог", href: "/tours", Icon: Compass },
  { label: "Отзывы", href: "/reviews", Icon: Star },
  { label: "Галерея", href: "/#gallery", Icon: Images },
  { label: "Контакты", href: "/contacts", Icon: Phone },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showTop, setShowTop] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const lastY = useRef(0);

  const onCatalog = pathname === "/tours";

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setShowTop(y > 600);
      if (y < lastY.current - 4) setShowPhone(true); // листают вверх → показать
      else if (y > lastY.current + 4) setShowPhone(false); // листают вниз → скрыть
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // взаимодействие с каруселью фото → показать кнопку телефона
  useEffect(() => {
    const onCarousel = () => setShowPhone(true);
    window.addEventListener("app:carousel", onCarousel);
    return () => window.removeEventListener("app:carousel", onCarousel);
  }, []);

  const phoneVisible = onCatalog && showPhone;

  return (
    <>
      {/* Плавающие кнопки над нижней навигацией */}
      {/* Кнопка «Наверх»: как закладка «Фильтры» — торчит из-за левого края экрана (скругление только
          справа, без левой рамки), опущена ниже (исходно 164 → 132). В скрытом виде уезжает за левый край. */}
      <div className="fixed bottom-[132px] left-0 z-40 lg:hidden">
        <button
          type="button"
          aria-label="Наверх"
          onClick={smoothScrollToTop}
          // Срабатываем и на pointerdown: во время инерции прокрутки (Lenis) обычный click
          // «съедается» остановкой инерции — а по нажатию возврат наверх происходит сразу.
          onPointerDown={smoothScrollToTop}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-r-md border border-l-0 border-hairline bg-surface text-ink shadow-card transition-all duration-300",
            showTop ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0"
          )}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>

      <a
        href={site.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в WhatsApp"
        className={cn(
          "fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-success text-white shadow-float transition-all duration-300 lg:bottom-6",
          phoneVisible ? "bottom-[140px]" : "bottom-[84px]"
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </a>

      {/* Нижний блок: контекстная кнопка телефона (только каталог) + навигация */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        {/* Контекстная кнопка телефона (только каталог): плавно «выдвигается» вверх из-за нижней навигации */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            phoneVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <a
              href={site.phoneHref}
              className={cn(
                "flex w-full items-center justify-center gap-2 border-t border-hairline bg-primary py-3.5 text-base font-semibold text-primary-fg transition-transform duration-300 ease-out",
                phoneVisible ? "translate-y-0" : "translate-y-full"
              )}
            >
              <Phone className="h-5 w-5" /> {site.phone}
            </a>
          </div>
        </div>

        {/* Нижняя навигация (только мобильные) */}
        <nav className="border-t border-hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-lg">
          <div className="grid grid-cols-4">
            {items.map(({ label, href, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                    active ? "text-primary" : "text-muted"
                  )}
                >
                  <Icon className={cn("h-[22px] w-[22px]", active && "scale-110")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
