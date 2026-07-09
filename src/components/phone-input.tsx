"use client";

import { useEffect, useMemo, useRef, useState, type FC, type SVGProps } from "react";
import { ChevronDown, Search, X } from "lucide-react";
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

// Максимум национальных цифр (самые длинные планы нумерации ~12–14). Больше — не даём ввести.
const MAX_NATIONAL = 14;

export function PhoneInput({
  country,
  national,
  valid,
  onCountryChange,
  onNationalChange,
  onBlur,
  onFocus,
}: {
  country: CountryCode;
  national: string; // только национальные цифры (без кода страны)
  valid: boolean; // полностью корректный номер → зелёная рамка
  onCountryChange: (c: CountryCode) => void;
  onNationalChange: (digits: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Закрытие по клику вне и по Esc (Esc гасим, чтобы не закрылась вся модалка).
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey, true);
    // Автофокус в поиск при открытии.
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
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
    onNationalChange(d.slice(0, MAX_NATIONAL));
  }

  // Вставка из буфера: пытаемся распознать страну по номеру (если он с «+»), иначе — как есть.
  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const pn = parsePhoneNumberFromString(text, country);
      if (pn?.country) {
        onCountryChange(pn.country);
        onNationalChange(pn.nationalNumber.slice(0, MAX_NATIONAL));
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
        <button
          type="button"
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

        {/* Вставить из буфера обмена */}
        <button
          type="button"
          onClick={paste}
          aria-label="Вставить из буфера"
          className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-ink active:scale-95"
        >
          {/* Иконка «вставить»: стрелка развёрнута внутрь (на буфер обмена) */}
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
        </button>
      </div>

      {/* Выпадающий список стран: поиск + прокручиваемый список */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-hairline bg-bg shadow-float">
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
      )}
    </div>
  );
}
