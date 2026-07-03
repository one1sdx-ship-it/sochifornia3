"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Липкий бар бронирования снизу (мобайл) — конверсионный паттерн.
// Скроллит к форме заявки на странице.
export function StickyBookingBar({ price }: { price: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToForm = () => {
    document.getElementById("tour-lead")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(63px_+_env(safe-area-inset-bottom))] z-30 border-t border-hairline bg-bg/95 px-5 py-3 backdrop-blur-lg transition-transform duration-300 lg:bottom-0 lg:hidden",
        show ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-xs text-muted">от</span>
          <p className="font-display text-lg font-bold text-ink">{formatPrice(price)}<span className="text-xs font-normal text-muted">/чел</span></p>
        </div>
        <button
          onClick={scrollToForm}
          className="h-11 flex-1 rounded-full bg-primary px-6 font-medium text-primary-fg active:scale-[0.98]"
        >
          Оставить заявку
        </button>
      </div>
    </div>
  );
}
