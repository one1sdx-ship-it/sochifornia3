"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Review } from "@/data/content";
import { ReviewCard } from "@/components/review-card";
import { cn } from "@/lib/utils";

// Блок «Отзывы туристов» на странице экскурсии.
// • Заголовок по центру.
// • Переключатель из двух подразделов: «Текущая экскурсия» (по умолчанию при каждом заходе)
//   и «Все отзывы» — по клику сразу уводит в раздел «Отзывы» (/reviews) (задача 5).
// • Переключатель залипает у нижнего края липкой ленты-карусели: его top берётся из
//   CSS-переменной --tour-strip-bottom, которую задаёт [[tour-hero-carousel]] (задача 6).
export function TourReviews({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  // При каждом новом заходе на страницу выбран подраздел «Текущая экскурсия».
  const [tab, setTab] = useState<"current" | "all">("current");

  const selectAll = () => {
    setTab("all");
    // «Все отзывы» — уводим в раздел «Отзывы» с задержкой 1с, чтобы анимация смены
    // кнопок успела проиграться (задача 4).
    setTimeout(() => router.push("/reviews"), 400);
  };

  return (
    // Фрагмент (без внешней секции): переключатель — прямой ребёнок обёртки «Отзывы + Похожие»
    // в page.tsx, поэтому его sticky-областью становится вся эта область и он не пропадает
    // вместе с карточками отзывов (задача 2).
    <>
      {/* Заголовок */}
      <section className="bg-surface pt-section-sm pb-6">
        <div className="container-wide">
          <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
            Отзывы туристов
          </h2>
        </div>
      </section>

      {/* Переключатель подразделов — залипает под лентой-каруселью (var --tour-strip-bottom).
          Растянут на всю ширину окна; правое скругление убрано (задача 1);
          активный раздел подсвечивает «ползунок» — подложка, плавно едущая между кнопками (задача 4). */}
      <div className="sticky z-30" style={{ top: "var(--tour-strip-bottom, 200px)" }}>
        <div className="relative grid grid-cols-2 rounded-l-md border-y border-hairline bg-bg shadow-card">
          {/* Ползунок-подложка активной кнопки: одна половина ширины, едет влево/вправо. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-primary transition-transform duration-300 ease-out"
            style={{ transform: tab === "all" ? "translateX(100%)" : "translateX(0)" }}
          />
          <button
            type="button"
            onClick={() => setTab("current")}
            className={cn(
              "relative z-10 px-4 py-3 text-sm font-medium transition-colors duration-300",
              tab === "current" ? "text-primary-fg" : "text-body"
            )}
          >
            Отзывы о текущей экскурсии
          </button>
          <button
            type="button"
            onClick={selectAll}
            className={cn(
              // «Все отзывы» — на 20% крупнее (14px → 16.8px), задача 3.
              "relative z-10 px-4 py-3 text-[16.8px] font-medium transition-colors duration-300",
              tab === "all" ? "text-primary-fg" : "text-body"
            )}
          >
            Все отзывы
          </button>
        </div>
      </div>

      {/* Карточки — только отзывы текущей экскурсии (как было раньше). */}
      <section className="bg-surface pb-section-sm">
        <div className="container-wide">
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <ReviewCard key={r.name} review={r} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
