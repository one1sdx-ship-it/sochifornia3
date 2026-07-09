"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { OPEN_LEAD_EVENT } from "@/components/lead-overlay";

// Липкий бар бронирования снизу (мобайл) — конверсионный паттерн.
// Кнопка «Оставить заявку» открывает полноэкранную панель заявки [[lead-overlay]]
// (та сама прокручивает страницу к основной панели и блокирует прокрутку).
export function StickyBookingBar({ price }: { price: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openLead = () => window.dispatchEvent(new Event(OPEN_LEAD_EVENT));

  return (
    <div
      id="tour-bookingbar"
      className={cn(
        "fixed inset-x-0 bottom-[calc(63px_+_env(safe-area-inset-bottom))] z-30 border-t border-hairline bg-bg/95 px-5 py-3 backdrop-blur-lg transition-transform duration-300 lg:bottom-0 lg:hidden",
        show ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Цены «взрослый/ребёнок» — каждая в одну строку, на одном уровне с кнопкой.
            Детский тариф равен базовой цене экскурсии, взрослый — на 300 ₽ дороже. */}
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-ink">
            от {formatPrice(price + 300)}<span className="text-[11px] font-normal text-muted">/взрослый</span>
          </p>
          <p className="font-display text-sm font-bold text-ink">
            от {formatPrice(price)}<span className="text-[11px] font-normal text-muted">/ребёнок</span>
          </p>
        </div>
        {/* Кнопка справа, по ширине под контент (≈ на 20% уже прежней «во всю ширину») */}
        <button
          onClick={openLead}
          className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg active:scale-[0.98]"
        >
          Оставить заявку
        </button>
      </div>
    </div>
  );
}
