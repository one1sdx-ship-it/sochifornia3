"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeadData, setLeadField } from "@/components/lead-store";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { PhoneInput, isPhoneValid, toE164, fromE164 } from "@/components/phone-input";
import { type CountryCode } from "libphonenumber-js";

// Полноэкранная панель «Перезвоните мне». Открывается кнопкой из синей плашки в нижней
// навигации [[mobile-nav]]. Встаёт СТРОГО в промежутке между шапкой (сверху) и нижней
// навигацией из 4 кнопок (снизу) — обе панели остаются видимы и не перекрываются (как в
// [[lead-overlay]]). Имя и телефон берутся из общего хранилища [[lead-store]] (синхрон с
// остальными формами + сохранение в localStorage). Выбор времени — локальная машина состояний.

// Событие «панель обратного звонка открыта/закрыта» (detail: boolean). Слушает закладка
// «Фильтры» [[filter-tab]], чтобы прятаться, пока панель открыта.
export const CALLBACK_OPEN_EVENT = "app:callback";

// Событие «закрыть панель обратного звонка». Шлём из шапки (клик по логотипу/названию), чтобы
// панель сразу закрывалась при переходе. Слушает владелец состояния [[mobile-nav]].
export const CALLBACK_CLOSE_EVENT = "app:callback-close";

// Пауза перед «уездом» кнопок влево и длительность самого слайда (совпадает с animate-slide-*).
const DELAY_MS = 500;
const SLIDE_MS = 320;

// Кастомный скроллбар внутренней области: отступ дорожки сверху/снизу и мин. высота бегунка (px).
const SB_PAD = 6;
const SB_MIN_THUMB = 36;

// Общая ширина полей и кнопок: на 28% уже полной (центрированная колонка).
// Была 60% → расширена на 20% по горизонтали (60 × 1.2 = 72%).
const COL = "mx-auto w-[72%] min-w-[240px]";

// Пресеты времени (5 кнопок верхнего уровня).
type Preset = "now" | "hour" | "evening" | "tomorrow" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "now", label: "Сейчас" },
  { key: "hour", label: "В течение часа" },
  { key: "evening", label: "Сегодня вечером" },
  { key: "tomorrow", label: "Завтра" },
  { key: "custom", label: "Другое время" },
];

// Части дня для «Завтра» (4 кнопки второго уровня).
type Part = "morning" | "day" | "evening" | "pick";
const PARTS: { key: Part; label: string }[] = [
  { key: "morning", label: "Утро" },
  { key: "day", label: "День" },
  { key: "evening", label: "Вечер" },
  { key: "pick", label: "Выбрать время" },
];

// Горизонтальная ширина кнопок части дня (по просьбе: Утро −40%, День −30%, Вечер −20%).
const PART_WIDTH: Record<Part, number> = { morning: 60, day: 70, evening: 80, pick: 100 };

// Шаг мастера выбора времени и направление анимации активной группы.
type Step = "presets" | "parts" | "wheels";
type Anim = "" | "out" | "in-right" | "in-left";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Форматирование, валидация и разбор телефона вынесены в [[phone-input]] (на базе
// libphonenumber-js): здесь используем helpers toE164 / fromE164 / isPhoneValid.

export function CallbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useLeadData();

  // Границы промежутка «шапка ↔ нижняя навигация» в пикселях от верха/низа вьюпорта.
  const [gap, setGap] = useState({ top: 96, bottom: 88 });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  // Машина выбора времени.
  const [step, setStep] = useState<Step>("presets");
  const [anim, setAnim] = useState<Anim>("");
  const [touched, setTouched] = useState(false); // нажимал ли клиент хоть одну из 5 кнопок
  const [preset, setPreset] = useState<Preset>("now"); // по умолчанию выбрано «Сейчас»
  const [part, setPart] = useState<Part | null>(null);
  const [wheelKind, setWheelKind] = useState<"hm" | "dhm">("hm"); // 2 или 3 карусели

  // Индексы каруселей (час / минута / день-месяц).
  const [hIdx, setHIdx] = useState(12);
  const [mIdx, setMIdx] = useState(0);
  const [dIdx, setDIdx] = useState(0);

  // Кастомный (всегда видимый) скроллбар внутренней области: нативный на тач-устройствах
  // исчезает и не поддерживается на iOS — рисуем свой. Виден, пока есть что прокручивать.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sb, setSb] = useState({ visible: false, top: 0, height: 0 });
  const sbDrag = useRef({ active: false, startY: 0, startScroll: 0 });

  // Актуальный onClose без пересоздания эффекта открытия при каждом рендере родителя.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Таймеры переходов — чтобы гарантированно снимать их при закрытии/размонтировании.
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  const push = (t: number) => timers.current.push(t);

  // Страна и национальные цифры телефона (общий стор [[lead-store]] хранит E.164 + country).
  const country = ((data.country as CountryCode) || "RU") as CountryCode;
  const national = fromE164(data.phone, country);
  const phoneOk = isPhoneValid(country, national);
  const phoneIncomplete = national.length > 0 && !phoneOk; // что-то ввели, но номер ещё не валиден

  // Запись телефона в стор: страна — отдельным полем, phone — в формате E.164.
  const setCountry = (c: CountryCode) => {
    setLeadField("country", c);
    setLeadField("phone", toE164(c, national));
  };
  const setNational = (d: string) => setLeadField("phone", toE164(country, d));
  // «Мягкая ошибка»: про неполный номер сообщаем только ПОСЛЕ ухода из поля (onBlur), а пока
  // пользователь печатает — не ругаемся. Флаг сбрасываем при возврате в поле (onFocus) и при открытии.
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Пересчёт размера/положения бегунка по метрикам прокрутки внутренней области.
  const updateScrollbar = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setSb((s) => (s.visible ? { visible: false, top: 0, height: 0 } : s));
      return;
    }
    const trackH = clientHeight - SB_PAD * 2;
    const thumbH = Math.max(SB_MIN_THUMB, (clientHeight / scrollHeight) * trackH);
    const maxTop = trackH - thumbH;
    const top = maxTop > 0 ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
    setSb({ visible: true, top, height: thumbH });
  };

  // Перетаскивание бегунка (палец/мышь) → прокрутка области.
  const onSbDown = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    sbDrag.current = { active: true, startY: e.clientY, startScroll: el.scrollTop };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onSbMove = (e: React.PointerEvent) => {
    if (!sbDrag.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const trackH = el.clientHeight - SB_PAD * 2;
    const maxTop = trackH - sb.height;
    if (maxTop <= 0) return;
    const dy = e.clientY - sbDrag.current.startY;
    el.scrollTop = sbDrag.current.startScroll + (dy / maxTop) * (el.scrollHeight - el.clientHeight);
  };
  const onSbUp = (e: React.PointerEvent) => {
    sbDrag.current.active = false;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* указатель уже отпущен */
    }
  };

  // Держим бегунок актуальным: при открытии, смене шага/статуса, вводе телефона и любом
  // изменении размеров (появление клавиатуры, поворот экрана).
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(updateScrollbar);
    const ro = new ResizeObserver(updateScrollbar);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, status, part, preset, phoneOk]);

  // Значения каруселей.
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
  const days = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        // Короткий месяц («8 июл.») — компактнее для узкой карусели.
        return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      }),
    []
  );

  // Замер видимого промежутка: низ шапки (сверху) и высота нижней навигации (снизу).
  const measure = () => {
    const header = document.querySelector("header");
    const nav = document.getElementById("mobile-bottom-nav");
    const top = header ? Math.round(header.getBoundingClientRect().bottom) : 96;
    const bottom = nav ? Math.round(window.innerHeight - nav.getBoundingClientRect().top) : 88;
    setGap({ top: Math.max(0, top), bottom: Math.max(0, bottom) });
  };

  // Жизненный цикл открытой панели: сброс машины, замок прокрутки, Esc, «Назад» (Android), resize.
  useEffect(() => {
    if (!open) return;
    // Сброс выбора времени при каждом открытии (имя/телефон сохраняются в хранилище).
    setStatus("idle");
    setStep("presets");
    setAnim("");
    setTouched(false);
    setPhoneTouched(false);
    setPreset("now");
    setPart(null);

    measure();
    stopScroll();
    // Сообщаем закладке «Фильтры», что панель открыта → она скрывается.
    window.dispatchEvent(new CustomEvent(CALLBACK_OPEN_EVENT, { detail: true }));

    const onResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    // Держим «фиктивную» запись в истории: системная кнопка «Назад» закроет панель, а не уведёт со страницы.
    window.history.pushState({ ...window.history.state, callback: true }, "");
    const onPop = () => onCloseRef.current();

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    const raf = requestAnimationFrame(measure); // добор после раскладки

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      cancelAnimationFrame(raf);
      clearTimers();
      startScroll();
      window.dispatchEvent(new CustomEvent(CALLBACK_OPEN_EVENT, { detail: false }));
      // Снимаем свою запись истории, если закрылись не «Назадом».
      if (window.history.state?.callback) window.history.back();
    };
  }, [open]);

  // Класс анимации активной группы.
  const animClass =
    anim === "out"
      ? "animate-slide-out-left"
      : anim === "in-right"
        ? "animate-slide-in-right"
        : anim === "in-left"
          ? "animate-slide-in-left"
          : "";

  // Выбор одной из 5 пресет-кнопок.
  function choosePreset(p: Preset) {
    clearTimers();
    setTouched(true);
    setPreset(p);
    setPart(null);
    // «Сейчас» / «В течение часа» / «Сегодня вечером» — шаг завершён, остаёмся на пресетах.
    if (p !== "tomorrow" && p !== "custom") return;
    // «Завтра» / «Другое время»: через 0.5с 5 кнопок уезжают влево, затем въезжает следующий шаг.
    push(
      window.setTimeout(() => {
        setAnim("out");
        push(
          window.setTimeout(() => {
            if (p === "tomorrow") {
              setStep("parts");
            } else {
              setWheelKind("dhm"); // «Другое время» → сразу 3 карусели (день-месяц, час, минута)
              setStep("wheels");
            }
            setAnim("in-right");
          }, SLIDE_MS)
        );
      }, DELAY_MS)
    );
  }

  // Выбор одной из 4 кнопок части дня (ветка «Завтра»).
  function choosePart(p: Part) {
    clearTimers();
    setPart(p);
    // Утро / День / Вечер — шаг завершён.
    if (p !== "pick") return;
    // «Выбрать время» → через 0.5с 4 кнопки уезжают влево, въезжают 2 карусели (час, минута).
    push(
      window.setTimeout(() => {
        setAnim("out");
        push(
          window.setTimeout(() => {
            setWheelKind("hm");
            setStep("wheels");
            setAnim("in-right");
          }, SLIDE_MS)
        );
      }, DELAY_MS)
    );
  }

  // «< Изменить»: возврат на предыдущий шаг (группа въезжает слева).
  function back() {
    clearTimers();
    if (step === "wheels") setStep(wheelKind === "hm" ? "parts" : "presets");
    else if (step === "parts") setStep("presets");
    setAnim("in-left");
  }

  // Отправка (заглушка, как в [[lead-form]] — позже подключим API/CRM).
  async function submit() {
    if (!phoneOk || status === "loading") return;
    setStatus("loading");
    await new Promise((r) => setTimeout(r, 900));
    setStatus("done");
  }

  // Человеко-понятное «когда перезвонить» — для превью и экрана успеха.
  function whenText(): string {
    if (step === "wheels") {
      const time = `${hours[hIdx]}:${minutes[mIdx]}`;
      return wheelKind === "hm" ? `Завтра в ${time}` : `${days[dIdx]}, ${time}`;
    }
    if (preset === "tomorrow") {
      if (part === "morning") return "Завтра утром";
      if (part === "day") return "Завтра днём";
      if (part === "evening") return "Завтра вечером";
      return "Завтра";
    }
    return { now: "Сейчас", hour: "В течение часа", evening: "Сегодня вечером", custom: "Другое время" }[
      preset as "now" | "hour" | "evening" | "custom"
    ];
  }

  if (!open) return null;

  return (
    <div className="lg:hidden">
      {/* Затемнение промежутка. Шапка (z-50) и нижняя навигация (z-40) выше — не затемняются. */}
      <div
        className="fixed inset-0 z-30 bg-black/50 animate-fade-in"
        onClick={() => onCloseRef.current()}
      />

      {/* Панель строго между шапкой и нижней навигацией. Выезжает снизу. */}
      <div
        className="fixed inset-x-0 z-30 animate-slide-in-up"
        style={{ top: gap.top, bottom: gap.bottom }}
      >
        <div className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-bg shadow-float">
          {status === "done" ? (
            // ===== Экран успеха =====
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink">Заявка принята!</h3>
              <p className="mt-2 text-body">
                Перезвоним вам: <span className="font-semibold text-ink">{whenText()}</span>.
              </p>
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                className="mt-6 rounded-xl border border-hairline bg-surface px-6 py-2.5 text-sm font-semibold text-ink active:scale-95"
              >
                Готово
              </button>
            </div>
          ) : (
            <>
              {/* Крестик закрытия — плавает в правом верхнем углу панели. Отдельной белой шапки
                  с разделительной линией больше нет, поэтому всё содержимое поднимается выше. */}
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => onCloseRef.current()}
                className="absolute right-4 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Прокручиваемая середина + свой всегда видимый скроллбар справа. */}
              <div className="relative flex min-h-0 flex-1 flex-col">
                {/* data-lenis-prevent: отдаём touch/wheel нативной прокрутке (иначе Lenis,
                    работающий на всей странице, перехватывает их и внутренний скролл «не работает»).
                    no-scrollbar: прячем нативную полосу — рисуем свою (ниже), она не исчезает. */}
                <div
                  ref={scrollRef}
                  onScroll={updateScrollbar}
                  className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-6"
                  data-lenis-prevent
                >
                {/* Вся конструкция (имя → телефон → заголовок → кнопки) центрируется по вертикали:
                    mt-auto здесь + mb-auto у блока кнопок ниже. При нехватке высоты авто-поля
                    схлопываются в 0 → конструкция прижимается к верху и появляется прокрутка. */}
                {/* Поля: имя + телефон в узкой центрированной колонке (−40% по ширине) */}
                <div className={cn(COL, "mt-auto")}>
                  {/* 1. Имя — необязательно */}
                  <label className="block">
                    <span className="mb-1.5 block text-center text-sm font-medium text-ink">
                      Как можем к <strong className="font-bold">вам</strong> обращаться?
                    </span>
                    {/* «Утопленный» вид поля (bg-surface-2 + внутренняя тень) + иконка слева и
                        текст по левому краю — чтобы поле явно читалось как поле ВВОДА, а не как кнопка. */}
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input
                        value={data.name}
                        onChange={(e) => setLeadField("name", e.target.value)}
                        placeholder="Ваше имя"
                        className="h-12 w-full rounded-md border border-hairline bg-surface-2 pl-10 pr-4 text-ink shadow-inner outline-none transition-colors placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    {/* Подпись под именем — «НЕ обязательно», зелёная; правый край выровнен по
                        правой стороне поля (п.1) */}
                    <span className="mt-1 block text-right text-xs font-medium text-success">
                      НЕ обязательно
                    </span>
                  </label>

                  {/* 2. Телефон — обязательно. Выбор страны флаг-дропдауном + форматирование и
                       валидация из libphonenumber-js (для РФ — строго мобильный 9XX). */}
                  <label className="mt-6 block">
                    <span className="mb-1.5 block text-center text-sm font-medium text-ink">Номер телефона:</span>
                    <PhoneInput
                      country={country}
                      national={national}
                      valid={phoneOk}
                      onCountryChange={setCountry}
                      onNationalChange={setNational}
                      onFocus={() => setPhoneTouched(false)}
                      onBlur={() => setPhoneTouched(true)}
                    />
                    <span
                      className={cn(
                        // Правый край подписи выровнен по правой стороне поля (п.1)
                        "mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-xs font-medium",
                        phoneOk
                          ? "text-success"
                          : phoneTouched && phoneIncomplete
                            ? "text-amber-500" // мягкая ошибка: номер введён, но ещё не валиден
                            : "text-error"
                      )}
                    >
                      {phoneOk ? (
                        <>
                          <Check className="h-3.5 w-3.5 shrink-0" /> Вашего номера телефона достаточно
                        </>
                      ) : phoneTouched && phoneIncomplete ? (
                        country === "RU" && national.length > 0 && national[0] !== "9"
                          ? "Введите мобильный номер (9XX)"
                          : "Кажется, номер неполный"
                      ) : (
                        "Обязательно для заполнения"
                      )}
                    </span>
                  </label>
                </div>

                {/* 3. Заголовок выбора времени — обычный статичный текст (без анимации и без
                    подмены на зелёную «НЕ обязательно»). Сама подсказка «НЕ обязательно» теперь
                    показывается под кнопкой «Сейчас» (см. шаг с пресетами ниже). */}
                <div className="mt-8 text-center text-[15px] font-medium">
                  <span className="block text-ink">
                    Когда вам удобно <strong className="font-bold">получить консультацию</strong>?
                  </span>
                </div>

                <div className="relative mb-auto mt-3 min-h-[300px] overflow-hidden">
                  {/* Шаг 1: 5 пресет-кнопок. Слой анимации — полной ширины (чтобы узкая
                      колонка целиком уезжала за край), внутри — центрированная колонка 60%. */}
                  {step === "presets" && (
                    <div key="presets" className={cn("w-full", animClass)}>
                      <div className={cn("flex flex-col items-center gap-3", COL)}>
                        {PRESETS.map(({ key, label }) => (
                          // Каждая кнопка в своей колонке: под ВЫБРАННОЙ показываем зелёную
                          // подсказку. items-end → правый край подписи выровнен по правому краю
                          // кнопки (кнопка w-full) (п.1).
                          <div key={key} className="flex w-full flex-col items-end">
                            <ChoiceButton
                              label={label}
                              bold={key === "now"} // жирная метка только у «Сейчас»
                              selected={preset === key}
                              // приглушаем остальные до 30% только ПОСЛЕ первого выбора
                              dim={touched && preset !== key ? 30 : false}
                              onClick={() => choosePreset(key)}
                            />
                            {/* Подсказка следует за выбором. «По умолчанию» — только у «Сейчас»
                                (это выбор по умолчанию); у остальных кнопок «Выберите по желанию»
                                (п.2). Показываем, пока телефон не введён. */}
                            {preset === key && !phoneOk && (
                              <span className="mt-1 text-right text-xs font-medium text-success">
                                {key === "now"
                                  ? "НЕ обязательно | По умолчанию"
                                  : "НЕ обязательно | Выберите по желанию"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Шаг 2: 4 кнопки части дня (ветка «Завтра») ровно по центру + метка справа */}
                  {step === "parts" && (
                    <div key="parts" className={cn("relative", animClass)}>
                      <div className={cn("flex flex-col items-center gap-3", COL)}>
                        {PARTS.map(({ key, label }) => (
                          <ChoiceButton
                            key={key}
                            label={label}
                            selected={part === key}
                            // после выбора остальные до 50%
                            dim={part !== null && part !== key ? 50 : false}
                            widthPct={PART_WIDTH[key]}
                            onClick={() => choosePart(key)}
                          />
                        ))}
                      </div>
                      {/* Зелёная; absolute — не смещает кнопки с центра */}
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium text-success">
                        НЕ обязательно
                      </span>
                    </div>
                  )}

                  {/* Шаг 3: карусели (2 — для «Выбрать время», 3 — для «Другое время») */}
                  {step === "wheels" && (
                    <div key="wheels" className={animClass}>
                      <div className="flex items-start justify-center gap-2 pt-6">
                        {wheelKind === "dhm" && (
                          <WheelPicker label="День и месяц" wide items={days} index={dIdx} onChange={setDIdx} inertia={0.9} />
                        )}
                        {/* Часы — выбор только 9:00–21:00 (вне диапазона авто-прокрутка и приглушение),
                            минуты — бесконечно. Обе крутятся нативно (плавность как на iPhone). */}
                        <WheelPicker label="Час" items={hours} index={hIdx} onChange={setHIdx} loop inertia={0.9} range={[9, 21]} />
                        <WheelPicker label="Минута" items={minutes} index={mIdx} onChange={setMIdx} loop inertia={0.95} />
                      </div>
                    </div>
                  )}
                </div>
                </div>

                {/* Свой скроллбар: всегда виден, пока есть прокрутка. Заметный тёмный бегунок,
                    перетаскивается пальцем/мышью; дорожка показывает, что снизу есть ещё кнопки. */}
                {sb.visible && (
                  <div className="pointer-events-none absolute bottom-1.5 right-1 top-1.5 z-20 w-[14px] rounded-full bg-ink/10">
                    <div
                      onPointerDown={onSbDown}
                      onPointerMove={onSbMove}
                      onPointerUp={onSbUp}
                      onPointerCancel={onSbUp}
                      style={{ top: sb.top, height: sb.height }}
                      className="pointer-events-auto absolute inset-x-0 cursor-grab touch-none rounded-full bg-ink/60 active:cursor-grabbing active:bg-ink/80"
                    />
                  </div>
                )}
              </div>

              {/* «< Назад» — над разделительной линией: на 10% крупнее, чуть выше и правее */}
              {step !== "presets" && (
                <button
                  type="button"
                  onClick={back}
                  className="-mt-3 mb-4 ml-6 flex items-center gap-1 text-[0.9625rem] font-medium text-muted transition-colors active:text-ink"
                >
                  <ChevronLeft className="h-[18px] w-[18px]" /> Назад
                </button>
              )}

              {/* Подвал: превью + кнопка подтверждения */}
              <div className="border-t border-hairline px-4 py-3">
                <div className="mb-2 text-center text-[0.945rem] text-muted">
                  Перезвоним: <span className="font-semibold text-ink">{whenText()}</span>
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!phoneOk}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[1.1rem] font-semibold transition-colors",
                    phoneOk
                      ? "animate-cb-blink bg-success text-white" // моргает зелёным, как только введён телефон
                      : "cursor-not-allowed bg-surface-2 text-muted" // неактивна, пока телефона нет
                  )}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Отправляем…
                    </>
                  ) : (
                    "Подтвердить обратный звонок"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Кнопка выбора (пресет / часть дня): выделенная — зелёная галочка, остальные приглушены.
// Ширину задаёт родительская колонка (w-full → та же ширина, что у полей).
function ChoiceButton({
  label,
  selected,
  dim,
  onClick,
  widthPct,
  bold,
}: {
  label: string;
  selected: boolean;
  dim: false | 30 | 50;
  onClick: () => void;
  widthPct?: number; // ширина в % от колонки (для кнопок части дня); по умолчанию — во всю ширину
  bold?: boolean; // жирная метка (для кнопки «Сейчас»)
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Инлайн-ширина (если задана) перекрывает w-full — так уменьшаем отдельные кнопки по горизонтали.
      style={widthPct ? { width: `${widthPct}%` } : undefined}
      // Явный «кнопочный» вид, чтобы вариант нельзя было спутать с полем ввода:
      // • форма-пилюля (rounded-full) в отличие от прямоугольных полей;
      // • радио-индикатор слева (кольцо → зелёная галка);
      // • «приподнятая» нижняя тень-ступенька (0 2px 0) с проседанием при нажатии.
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-center rounded-full border px-11 py-3 text-center text-[15px] shadow-[0_2px_0_rgba(17,17,17,0.08)] transition-all duration-200 active:translate-y-px active:shadow-none",
        bold ? "font-bold" : "font-medium",
        selected
          ? "border-primary bg-primary/10 text-ink"
          : "border-hairline bg-surface text-body hover:border-primary/50 hover:bg-surface-2",
        dim === 30 && "opacity-30",
        dim === 50 && "opacity-50"
      )}
    >
      {/* Радио-индикатор слева (absolute — не смещает надпись с центра): пустое кольцо →
          выбранное с синей галкой. Однозначно сигналит, что это кнопка-вариант, а не поле. */}
      <span
        className={cn(
          "absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary bg-primary text-primary-fg" : "border-muted/40"
        )}
      >
        {selected && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

// Минималистичная вертикальная карусель (scroll-snap), плавность как на iPhone.
//
// Плавность (п.6): ленту крутим сами через onPointer* (мышь/палец/перо) — это стабильно
// работает во всех окружениях, включая эмуляцию устройства. Инерция при отпускании даёт
// «долистывание». Главное против лагов: выбранное значение фиксируем ТОЛЬКО когда лента
// остановилась (debounce), а не на каждом кадре — иначе список из сотен строк перерисовывался
// бы 60 раз в секунду. Список статичен (без per-item подсветки от индекса), края затемнены
// CSS-маской (эффект «барабана»).
//
// range (час, п.7/8): значения вне [lo..hi] показываются приглушёнными (65%) и на них нельзя
// «остановиться» — лента авто-докручивается в диапазон по кратчайшему пути (9↑→21, 21↓→9).
function WheelPicker({
  label,
  items,
  index,
  onChange,
  wide = false,
  loop = false,
  inertia = 0,
  range,
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (i: number) => void;
  wide?: boolean;
  loop?: boolean; // бесконечная прокрутка вверх/вниз (час/минута)
  inertia?: number; // сила инерции ручного перетаскивания мышью (0 — без инерции)
  range?: [number, number]; // допустимый диапазон значений (час: [9,21]); вне — приглушение + авто-докрутка
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM_H = 62; // высота строки

  const base = items.length;
  // Бесконечная лента: повторяем значения и стартуем из центрального блока.
  const REP = loop ? Math.max(5, Math.ceil(360 / base)) : 1;
  const CENTER = Math.floor(REP / 2);
  const rendered = useMemo(
    () => (loop ? Array.from({ length: REP * base }, (_, i) => items[i % base]) : items),
    [items, loop, REP, base]
  );

  // Абсолютный scrollTop (в пикселях) для логического индекса.
  const topFor = (i: number) => (loop ? (CENTER * base + i) * ITEM_H : i * ITEM_H);

  const drag = useRef({ active: false, startY: 0, startTop: 0, lastY: 0, lastT: 0, v: 0 });
  const raf = useRef(0); // кадр инерции (мышь)
  const settle = useRef(0); // таймер «прокрутка остановилась»

  // При монтировании прокручиваем к текущему значению (в центральный блок для loop).
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = topFor(index);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Держим бесконечную ленту в середине: у края сдвигаем на целые блоки (незаметно для глаза).
  const keepCentered = (el: HTMLDivElement) => {
    if (!loop) return;
    const blockPx = base * ITEM_H;
    const shift = CENTER * blockPx;
    if (el.scrollTop < blockPx) {
      el.scrollTop += shift;
      drag.current.startTop += shift;
    } else if (el.scrollTop > (REP - 1) * blockPx) {
      el.scrollTop -= shift;
      drag.current.startTop -= shift;
    }
  };

  // Фиксируем выбор ТОЛЬКО после остановки — так список не перерисовывается на каждом кадре.
  const commit = () => {
    const el = ref.current;
    if (!el || drag.current.active) return; // пока держим — не фиксируем и не докручиваем
    const abs = Math.round(el.scrollTop / ITEM_H);
    const logical = loop ? ((abs % base) + base) % base : clamp(abs, 0, base - 1);
    // Час вне диапазона — авто-докрутка к границе по кратчайшему пути (продолжая направление).
    if (range && (logical < range[0] || logical > range[1])) {
      const target = logical < range[0] ? range[1] : range[0];
      const fwd = (((target - abs) % base) + base) % base;
      const targetAbs = fwd <= base / 2 ? abs + fwd : abs + fwd - base;
      el.scrollTo({ top: targetAbs * ITEM_H, behavior: "smooth" });
      if (target !== index) onChange(target);
      return;
    }
    if (logical !== index) onChange(logical);
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    keepCentered(el);
    clearTimeout(settle.current);
    settle.current = window.setTimeout(commit, 120);
  };

  // Крутим ленту вручную (мышь/палец/перо) — надёжно во всех окружениях, включая эмуляцию
  // устройства. Плавность даёт инерция + фиксация значения только после остановки.
  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    drag.current = { active: true, startY: e.clientY, startTop: el.scrollTop, lastY: e.clientY, lastT: performance.now(), v: 0 };
    el.style.scrollSnapType = "none";
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;
    el.scrollTop = drag.current.startTop - (e.clientY - drag.current.startY);
    const now = performance.now();
    const dt = now - drag.current.lastT || 16;
    const inst = -(e.clientY - drag.current.lastY) / dt; // скорость в «пространстве прокрутки»
    drag.current.v = drag.current.v * 0.7 + inst * 0.3;
    drag.current.lastY = e.clientY;
    drag.current.lastT = now;
  };

  // Плавно примагничиваемся к ближайшему значению.
  const snap = (el: HTMLDivElement) => {
    el.style.scrollSnapType = "";
    el.scrollTo({ top: Math.round(el.scrollTop / ITEM_H) * ITEM_H, behavior: "smooth" });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;
    drag.current.active = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* указатель уже отпущен */
    }
    if (!inertia || Math.abs(drag.current.v) < 0.02) {
      snap(el);
      return;
    }
    let v = drag.current.v;
    let last = performance.now();
    const stepFrame = (now: number) => {
      const dt = now - last;
      last = now;
      el.scrollTop += v * dt;
      v *= Math.pow(inertia, dt / 16); // затухание, нормированное на кадр ~16мс
      if (Math.abs(v) > 0.02) raf.current = requestAnimationFrame(stepFrame);
      else snap(el);
    };
    raf.current = requestAnimationFrame(stepFrame);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1.5 text-xs font-medium text-muted">{label}</span>
      <div className={cn("relative", wide ? "w-[149px]" : "w-[101px]")} style={{ height: ITEM_H * 3 }}>
        {/* Центральная зелёная полоса — рамка выбранного значения */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-success/40 bg-success/5"
          style={{ height: ITEM_H }}
        />
        <div
          ref={ref}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto"
          style={{
            paddingTop: ITEM_H,
            paddingBottom: ITEM_H,
            touchAction: "none", // прокрутку ведём сами (onPointer*) — стабильно во всех окружениях
            overscrollBehavior: "contain",
            cursor: "grab",
            transform: "translateZ(0)", // отдельный слой композитинга → плавнее
            // Затемнение краёв — эффект «барабана» как в iOS-пикере
            maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)",
          }}
        >
          {rendered.map((it, i) => {
            const val = loop ? i % base : i;
            const dim = range ? val < range[0] || val > range[1] : false; // час вне 9..21 — приглушён
            return (
              <div
                key={i}
                style={{ height: ITEM_H, opacity: dim ? 0.65 : 1 }}
                className="flex snap-center items-center justify-center whitespace-nowrap text-lg text-ink"
              >
                {it}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
