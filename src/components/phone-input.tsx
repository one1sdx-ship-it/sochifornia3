"use client";

import { useEffect, useMemo, useRef, useState, type FC, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Trash2, X } from "lucide-react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import * as Flags from "country-flag-icons/react/3x2";
import { cn } from "@/lib/utils";

// Поле ввода телефона с выбором страны (флаг-дропдаун) на базе libphonenumber-js.
// Используется в панели «Перезвоните мне» [[callback-modal]]. Наружу отдаёт только
// «национальные» цифры (без кода страны) + сам код страны — владелец (модалка) сам
// собирает из них E.164 и кладёт в общий стор [[lead-store]].

// ── Публичные помощники (используются и модалкой) ────────────────────────────

// Национальные значимые цифры → E.164 («9998887766» + RU → «+79998887766»). Пусто → "".
export function toE164(country: CountryCode, national: string): string {
  return national ? "+" + getCountryCallingCode(country) + national : "";
}

// E.164/любые цифры → национальные цифры для выбранной страны (срезаем код страны).
export function fromE164(phone: string, country: CountryCode): string {
  const code = getCountryCallingCode(country);
  let d = phone.replace(/\D/g, "");
  if (d.startsWith(code)) d = d.slice(code.length);
  return d;
}

// Валиден ли номер. Для РФ — СТРОГО мобильный: ровно 10 цифр и первая «9» (диапазон 9XX),
// плюс общая проверка формата библиотекой. Для остальных стран — стандартная isValid().
// (getType() в облегчённых метаданных для РФ отдаёт undefined, поэтому мобильность РФ
// определяем явным правилом 9XX, а не по типу.)
export function isPhoneValid(country: CountryCode, national: string): boolean {
  if (!national) return false;
  const pn = parsePhoneNumberFromString(toE164(country, national));
  if (country === "RU") {
    return !!pn?.isValid() && national.length === 10 && national.startsWith("9");
  }
  return !!pn?.isValid();
}

// ── Внутренние помощники ─────────────────────────────────────────────────────

// Флаг страны как встроенный SVG (country-flag-icons) — рисуется одинаково на всех платформах,
// в т.ч. на десктопном Windows, где эмодзи-флагов нет. Если для кода флага нет — показываем код.
function Flag({ code, className }: { code: string; className?: string }) {
  const F = (Flags as Record<string, FC<SVGProps<SVGSVGElement>>>)[code];
  if (!F) return <span className="text-[11px] font-semibold text-muted">{code}</span>;
  return <F className={cn("h-[14px] w-[21px] shrink-0 rounded-[2px]", className)} />;
}

// Форматирование «на лету»: национальные цифры → человекочитаемый вид для поля
// (RU → «999 888-77-66», US → «(201) 555-0123»). Без кода страны и без «8».
const formatNational = (national: string, country: CountryCode) =>
  national ? new AsYouType(country).input(national) : "";

// Локализованные названия стран (ru). Может отсутствовать в старых движках — тогда код.
let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["ru"], { type: "region" });
} catch {
  regionNames = null;
}
const countryName = (cc: string) => regionNames?.of(cc) ?? cc;

// Страны наверху списка (частые для нашей аудитории) — остальные по алфавиту.
const PRIORITY: CountryCode[] = ["RU", "KZ", "BY", "UA", "AM", "AZ", "GE", "KG", "UZ", "TJ"];

// Максимум национальных цифр ПО СТРАНЕ (задача 4): для основной аудитории задаём точные длины,
// для остальных — общий предел по E.164 (всего ≤15 цифр вместе с кодом страны). Сверх этого
// значения ввести/вставить нельзя — лишние цифры отсекаются в handleInput/paste.
const NATIONAL_MAX: Partial<Record<CountryCode, number>> = {
  RU: 10, KZ: 10, BY: 9, UA: 9, AM: 8, AZ: 9, GE: 9, KG: 9, UZ: 9, TJ: 9,
};
const maxNational = (c: CountryCode) =>
  NATIONAL_MAX[c] ?? Math.max(4, 15 - getCountryCallingCode(c).length);

export function PhoneInput({
  country,
  national,
  valid,
  onCountryChange,
  onNationalChange,
  onBlur,
  onFocus,
  dropUp = false,
}: {
  country: CountryCode;
  national: string; // только национальные цифры (без кода страны)
  valid: boolean; // полностью корректный номер → зелёная рамка
  onCountryChange: (c: CountryCode) => void;
  onNationalChange: (digits: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  dropUp?: boolean; // список стран раскрывать ВВЕРХ, а не вниз (задача 7 — в окне «Чат»)
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Смена «Вставка ↔ Удалить» происходит НЕ мгновенно, а через 1с после действия (появилась первая
  // цифра / поле полностью очищено). Сам кросс-фейд иконок длится ~300мс. От showClear зависит и
  // вид кнопки, и её действие — чтобы клик всегда соответствовал показанной иконке.
  const hasDigits = national.length > 0;
  const [showClear, setShowClear] = useState(hasDigits);
  useEffect(() => {
    const t = window.setTimeout(() => setShowClear(hasDigits), 1000);
    return () => clearTimeout(t);
  }, [hasDigits]);

  // Полный список стран: приоритетные сверху, дальше по алфавиту (ru).
  const countries = useMemo(() => {
    const all = getCountries();
    const rest = all
      .filter((c) => !PRIORITY.includes(c))
      .sort((a, b) => countryName(a).localeCompare(countryName(b), "ru"));
    return [...PRIORITY.filter((c) => all.includes(c)), ...rest];
  }, []);

  // Фильтрация по названию / ISO-коду / телефонному коду.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      const name = countryName(c).toLowerCase();
      const calling = getCountryCallingCode(c);
      return name.includes(q) || c.toLowerCase().includes(q) || calling.includes(q.replace("+", ""));
    });
  }, [countries, query]);

  // Координаты поля для портала списка. Список стран и затемнение рисуем в <body> (см. ниже),
  // поэтому позицию выпадашки вычисляем по замеру самого поля.
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Открытый список: непрерывно отслеживаем позицию поля (rAF), автофокус в поиск, закрытие по Esc.
  // Позицию меряем каждый кадр, потому что поле может «уехать» из-за анимации раскрытия формы в
  // «Перезвоните мне» (имя введено → при первом же действии форма раскрывается и элементы смещаются)
  // — фиксированный портал обязан следовать за полем, иначе список повиснет на старом месте.
  // Клик мимо списка закрывает его через оверлей-затемнение (ниже), поэтому отдельного mousedown-
  // слушателя больше нет — он к тому же считал бы портал-список «внешним» кликом и закрывал его.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const track = () => {
      if (rootRef.current) {
        const r = rootRef.current.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.bottom === r.bottom
            ? prev
            : r
        );
      }
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    // Автофокус в поиск при открытии.
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(t);
    };
  }, [open]);

  // Ввод в поле: оставляем только цифры. Если ввели/вставили с кодом страны или ведущей «8»
  // (частый ввод для РФ) — срезаем лишний ведущий код.
  function handleInput(raw: string) {
    let d = raw.replace(/\D/g, "");
    const code = getCountryCallingCode(country);
    if (country === "RU") {
      if ((d.startsWith("8") || d.startsWith("7")) && d.length > 10) d = d.slice(1);
    } else if (d.startsWith(code) && d.length > code.length) {
      d = d.slice(code.length);
    }
    const max = maxNational(country);
    // Номер уже заполнен до предела: «поверх» менять цифры нельзя — принимаем только УМЕНЬШЕНИЕ
    // (удаление). Чтобы изменить номер, надо сперва удалить цифры, затем ввести новые.
    if (national.length >= max && d.length >= national.length) return;
    // Жёсткий лимит по стране (задача 4): сверх максимума цифры не принимаем.
    onNationalChange(d.slice(0, max));
  }

  // Вставка из буфера (задача 3): пытаемся распознать страну по номеру (если он с «+»), иначе —
  // как есть. Сначала ставим фокус в поле — часть браузеров требует, чтобы целевой input/документ
  // были в фокусе, иначе navigator.clipboard.readText() молча отклоняется (из-за этого кнопка
  // «Вставка» в «Перезвоните мне» вела себя иначе, чем в чате).
  async function paste() {
    inputRef.current?.focus();
    try {
      if (!navigator.clipboard?.readText) return; // напр. iOS Safari не умеет читать буфер
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const pn = parsePhoneNumberFromString(text, country);
      if (pn?.country) {
        onCountryChange(pn.country);
        onNationalChange(pn.nationalNumber.slice(0, maxNational(pn.country)));
      } else {
        handleInput(text);
      }
      inputRef.current?.focus();
    } catch {
      /* браузер не дал доступ к буферу — молча игнорируем */
    }
  }

  function pickCountry(c: CountryCode) {
    onCountryChange(c);
    setOpen(false);
    setQuery("");
    // Возвращаем фокус в поле ввода, чтобы можно было сразу набирать номер.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        // «Утопленный» вид поля (bg-surface-2 + внутренняя тень) — чтобы поле явно
        // читалось как поле ввода, а не как кнопка.
        className={cn(
          "flex h-12 w-full items-center rounded-md border bg-surface-2 text-ink shadow-inner transition-colors focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/20",
          valid ? "border-success" : "border-hairline focus-within:border-primary"
        )}
      >
        {/* Кнопка выбора страны: флаг + телефонный код */}
        {/* onMouseDown preventDefault: не снимаем фокус с поля имени при нажатии — иначе его onBlur
            раскроет форму, элементы сместятся и click «промахнётся» мимо уехавшей кнопки. Раскрытие
            произойдёт следом, когда список заберёт фокус себе (см. [[callback-modal]]). */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          aria-label="Выбрать страну"
          aria-expanded={open}
          className="flex h-full shrink-0 items-center gap-1 rounded-l-md pl-3 pr-2 active:scale-95"
        >
          <Flag code={country} />
          <span className="text-[15px] font-semibold">+{getCountryCallingCode(country)}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
        </button>

        {/* Разделитель */}
        <span className="mx-1 h-6 w-px shrink-0 bg-hairline" />

        {/* Национальный номер */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={formatNational(national, country)}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder="999 888-77-66"
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-left text-ink outline-none placeholder:text-muted"
        />

        {/* Переключатель «Вставка ↔ Мусорка» (задача 5): поле пустое → кнопка «вставить из буфера»;
            есть хотя бы одна цифра → красная «мусорка» (очистить). Иконки лежат в одном круглом
            слоте и перетекают друг в друга (поворот + масштаб + фейд) — видно, что одно сменяет другое. */}
        {/* onMouseDown preventDefault: та же причина, что у кнопки страны — не даём полю имени
            расфокуситься на нажатии, чтобы «Вставить/Удалить» сработали с первого тапа даже когда
            имя уже введено и форма вот-вот раскроется. */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={
            showClear
              ? () => {
                  onNationalChange("");
                  inputRef.current?.focus();
                }
              : paste
          }
          aria-label={showClear ? "Очистить номер" : "Вставить из буфера"}
          className="relative mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors active:scale-95"
        >
          {/* Иконка «вставить»: стрелка развёрнута внутрь (на буфер обмена) */}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center text-muted transition-all duration-300 ease-out",
              showClear ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
            )}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
              <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2" />
              <path d="M16 4h2a2 2 0 0 1 2 2v4" />
              <path d="M21 14H11" />
              <path d="m15 10-4 4 4 4" />
            </svg>
          </span>
          {/* Иконка «мусорка» — красная (очистить поле) */}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center text-error transition-all duration-300 ease-out",
              showClear ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
            )}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </span>
        </button>
      </div>

      {/* Список стран рисуем ПОРТАЛОМ в <body>. Иначе backdrop-blur родителя (футер чата) делает
          себя containing block для fixed-оверлея — затемнение зажимается в пределах строки ввода и
          не накрывает всё окно. Через портал затемнение накрывает ВЕСЬ экран (оба полноэкранных
          окна), а клик по любому месту фона закрывает список. Сам список — над затемнением,
          позиционируется по замеренным координатам поля (вниз или вверх при dropUp). */}
      {open && rect && typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[80] bg-black/50 animate-fade-in"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[81] overflow-hidden rounded-lg border border-hairline bg-bg shadow-float"
              style={{
                left: rect.left,
                width: rect.width,
                ...(dropUp
                  ? { bottom: window.innerHeight - rect.top + 4 }
                  : { top: rect.bottom + 4 }),
              }}
            >
          <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск страны или кода…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить"
                className="shrink-0 text-muted active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="no-scrollbar max-h-56 overflow-y-auto py-1" data-lenis-prevent>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted">Ничего не найдено</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickCountry(c)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors active:scale-[0.99]",
                    c === country ? "bg-success/10 text-ink" : "text-body hover:bg-surface-2"
                  )}
                >
                  <Flag code={c} />
                  <span className="min-w-0 flex-1 truncate">{countryName(c)}</span>
                  <span className="shrink-0 text-muted">+{getCountryCallingCode(c)}</span>
                </button>
              ))
            )}
          </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
