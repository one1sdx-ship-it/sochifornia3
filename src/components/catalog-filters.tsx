"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Tour, TourCategory } from "@/data/types";
import { categories } from "@/data/types";
import { TourCard } from "@/components/tour-card";
import { OPEN_FILTERS_EVENT, FILTERS_PANEL_TOGGLE_EVENT } from "@/components/filter-tab";
import { startScroll, stopScroll } from "@/components/smooth-scroll";
import { cn, formatPrice } from "@/lib/utils";

type SortKey = "popular" | "price-asc" | "price-desc";

const formats = [
  { id: "all", label: "Все" },
  { id: "group", label: "Групповые" },
  { id: "individual", label: "Индивидуальные" },
] as const;

const timeSlots = [
  { id: "all", label: "Любое" },
  { id: "morning", label: "Утро (до 12:00)" },
  { id: "day", label: "День (12:00–17:00)" },
  { id: "evening", label: "Вечер (после 17:00)" },
] as const;

function timeBucket(start: string): "morning" | "day" | "evening" | "any" {
  const h = parseInt(start.slice(0, 2), 10);
  if (Number.isNaN(h)) return "any";
  if (h < 12) return "morning";
  if (h < 17) return "day";
  return "evening";
}

export function CatalogFilters({
  tours,
  initialCategory,
}: {
  tours: Tour[];
  initialCategory?: TourCategory;
}) {
  const [category, setCategory] = useState<TourCategory | "all">(initialCategory ?? "all");
  const [format, setFormat] = useState<(typeof formats)[number]["id"]>("all");
  const [time, setTime] = useState<(typeof timeSlots)[number]["id"]>("all");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [sort, setSort] = useState<SortKey>("popular");
  // Боковая панель фильтров (мобильные): open + closing — как в меню сайта (header)
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // Момент открытия панели. Быстрый тап по плавающей кнопке открывает панель на pointerdown, а
  // следом «click» того же тапа попадает по затемнению и тут же её закрывал — из-за этого короткое
  // нажатие «не срабатывало», а срабатывало только долгое (у него закрывающего клика нет). Гасим
  // закрытие по затемнению в первые мгновения после открытия.
  const openedAtRef = useRef(0);
  const markOpened = () => {
    openedAtRef.current = Date.now();
    setOpen(true);
  };

  const closeFilters = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300);
  };

  // Сообщаем шапке о состоянии панели: пока панель открыта, шапка прячет свои элементы
  // (её z-index выше панели, и лого/кнопки иначе торчат поверх «Фильтров»). При начале
  // закрытия (closing) шапка возвращается сразу — синхронно с анимацией «панель уезжает влево».
  const notifyHeader = (opened: boolean) =>
    window.dispatchEvent(new CustomEvent<boolean>(FILTERS_PANEL_TOGGLE_EVENT, { detail: opened }));
  useEffect(() => {
    notifyHeader(open && !closing);
  }, [open, closing]);
  // Уход со страницы с открытой панелью — возвращаем шапку
  useEffect(() => () => { notifyHeader(false); }, []);

  // Блокируем прокрутку фона, пока открыта панель. Голого overflow:hidden мало:
  // Lenis сам крутит window.scrollTo по wheel/touch, поэтому stopScroll/startScroll
  // (останавливают и Lenis, замки́ считаются — см. smooth-scroll.tsx).
  useEffect(() => {
    if (!open) return;
    stopScroll();
    return () => startScroll();
  }, [open]);

  // Открытие панели фильтров единой плавающей кнопкой «Фильтры» (см. filter-tab.tsx):
  //  • мы уже в каталоге → кнопка шлёт событие OPEN_FILTERS_EVENT;
  //  • пришли с главной по кнопке → она ставит сигнал sf:openFilters ДО перехода, открываем панель на входе.
  useEffect(() => {
    const openPanel = () => markOpened();
    window.addEventListener(OPEN_FILTERS_EVENT, openPanel);
    try {
      if (sessionStorage.getItem("sf:openFilters") === "1") {
        sessionStorage.removeItem("sf:openFilters");
        markOpened();
      }
    } catch {}
    return () => window.removeEventListener(OPEN_FILTERS_EVENT, openPanel);
  }, []);

  const filtered = useMemo(() => {
    let list = tours.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (format !== "all" && t.format !== format) return false;
      if (time !== "all" && timeBucket(t.startTime) !== time) return false;
      if (t.price > maxPrice) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else list = [...list].sort((a, b) => b.reviewsCount - a.reviewsCount);
    return list;
  }, [tours, category, format, time, maxPrice, sort]);

  const reset = () => {
    setCategory("all");
    setFormat("all");
    setTime("all");
    setMaxPrice(5000);
    setSort("popular");
  };

  const filtersPanel = (
    <div className="space-y-7">
      <FilterGroup label="Категория">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>Все</Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Тип экскурсии">
        {formats.map((f) => (
          <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>
            {f.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Время начала">
        {timeSlots.map((t) => (
          <Chip key={t.id} active={time === t.id} onClick={() => setTime(t.id)}>
            {t.label}
          </Chip>
        ))}
      </FilterGroup>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Цена до</span>
          <span className="text-sm font-semibold text-primary">{formatPrice(maxPrice)}</span>
        </div>
        <input
          type="range"
          min={1000}
          max={5000}
          step={500}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
          aria-label="Максимальная цена"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>1 000 ₽</span>
          <span>5 000 ₽</span>
        </div>
      </div>

      <button onClick={reset} className="text-sm font-medium text-primary hover:underline">
        Сбросить фильтры
      </button>
    </div>
  );

  return (
    <div className="container-wide grid gap-8 py-12 lg:grid-cols-[280px_1fr]">
      {/* Десктоп — сайдбар */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-lg border border-hairline bg-surface p-6">
          {filtersPanel}
        </div>
      </aside>

      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Найдено: <span className="font-semibold text-ink">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-3">
            <label className="hidden items-center gap-2 text-sm text-muted sm:flex">
              Сортировка
              <SortSelect value={sort} onChange={setSort} />
            </label>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((tour) => (
              <TourCard key={tour.slug} tour={tour} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-hairline bg-surface p-12 text-center">
            <p className="text-lg font-semibold text-ink">Ничего не найдено</p>
            <p className="mt-2 text-body">Попробуйте изменить параметры фильтра.</p>
            <button onClick={reset} className="mt-4 font-medium text-primary hover:underline">
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Мобильная панель фильтров — выезжает слева направо (как меню сайта, зеркально).
          Открывается единой плавающей кнопкой «Фильтры» (filter-tab.tsx) через событие/сигнал.
          z-[65] — выше шапки (z-[61]): выезжая, панель физически заслоняет лого и кнопки,
          а шапка параллельно плавно гаснет (см. header.tsx). Ниже мобильного меню (z-[70]). */}
      {open && (
        <div className="fixed inset-0 z-[65] lg:hidden">
          <div
            className={cn(
              // touch-none — жест по затемнению не должен прокручивать страницу под панелью
              "absolute inset-0 touch-none bg-black/40 backdrop-blur-sm transition-opacity duration-300",
              closing ? "opacity-0" : "opacity-100"
            )}
            onClick={() => {
              // Игнорируем «click», прилетевший тем же тапом, что и открыл панель (короткое нажатие).
              if (Date.now() - openedAtRef.current < 400) return;
              closeFilters();
            }}
          />
          <div
            className={cn(
              "absolute left-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-bg p-6 shadow-float",
              closing ? "animate-slide-out-left" : "animate-slide-in-left"
            )}
          >
            {/* Вместо надписи «Фильтры» — сортировка (что это панель фильтров, ясно и так).
                Логика и стейт — те же, что у селекта в десктоп-тулбаре. */}
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-ink">Сортировка</h3>
              <button
                type="button"
                onClick={closeFilters}
                aria-label="Закрыть"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SortSelect value={sort} onChange={setSort} className="mt-4 w-full" />
            <div className="mt-6 flex-1 overflow-y-auto overscroll-contain">{filtersPanel}</div>
            <button
              onClick={closeFilters}
              className="mt-6 h-12 w-full rounded-full bg-primary font-medium text-primary-fg"
            >
              Показать {filtered.length}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Селект сортировки: общий для десктоп-тулбара и мобильной панели (одна логика и один стейт)
function SortSelect({
  value,
  onChange,
  className,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      aria-label="Сортировка"
      className={cn(
        "rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary",
        className
      )}
    >
      <option value="popular">По популярности</option>
      <option value="price-asc">Сначала дешевле</option>
      <option value="price-desc">Сначала дороже</option>
    </select>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-fg"
          : "border-hairline bg-surface text-body hover:border-primary/40 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
