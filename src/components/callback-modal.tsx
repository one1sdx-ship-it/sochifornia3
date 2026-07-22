"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, CornerDownLeft, Loader2, Pencil, User, X } from "lucide-react";
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

// Кнопка «Подтвердить» (после ввода имени) живёт НЕ в самой панели, а внизу экрана — на месте
// нижней навигации из 4 кнопок [[mobile-nav]] (задача 3). Панель сообщает событием, надо ли её
// показывать (detail: boolean), а нажатие возвращается обратным событием.
export const CALLBACK_NAME_CONFIRM_EVENT = "app:callback-name-confirm";
export const CALLBACK_NAME_SUBMIT_EVENT = "app:callback-name-submit";

// Пауза перед «уездом» кнопок влево и длительность самого слайда (совпадает с animate-slide-*).
const DELAY_MS = 500;
const SLIDE_MS = 320;

// Кастомный скроллбар внутренней области: отступ дорожки сверху/снизу и мин. высота бегунка (px).
const SB_PAD = 6;
const SB_MIN_THUMB = 36;

// По ТЗ: свой ползунок-скроллбар в панели не показываем, даже если часть элементов не
// помещается по вертикали. Прокрутка при этом остаётся доступной тач-жестом (нативно).
const SHOW_SCROLLBAR = false;

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

// Кнопки выбора (5 пресетов и 4 части дня): полный и минимальный вертикальный паддинг и промежуток
// между ними (px). Если по высоте все кнопки не помещаются — ужимаем паддинг (12→4) и промежуток
// (12→6), чтобы влезли.
const PRESET_PY_FULL = 12,
  PRESET_PY_MIN = 4;
const PRESET_GAP_FULL = 12,
  PRESET_GAP_MIN = 6;
// Карусели: полная и минимальная высота строки барабана (px). Видимая высота барабана = 3 строки,
// поэтому при нехватке места уменьшаем высоту строки (62→40) — карусели ужимаются по вертикали.
const WHEEL_H_FULL = 62,
  WHEEL_H_MIN = 40;

// Шаг мастера выбора времени и направление анимации активной группы.
type Step = "presets" | "parts" | "wheels";
type Anim = "" | "out" | "in-right" | "in-left";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Каждое слово — с заглавной буквы (для поля имени): «иван петров» → «Иван Петров».
// Трогаем только первую букву после начала строки, пробела или дефиса; остальные символы не меняем.
const capWords = (s: string) => s.replace(/(^|[\s-])(\S)/g, (_, p: string, c: string) => p + c.toUpperCase());

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

  // Авто-подгонка вертикального размера активного шага: если содержимое не помещается по высоте —
  // у кнопочных шагов (5 пресетов / 4 части дня) уменьшаем вертикальный паддинг кнопок и промежуток,
  // у каруселей — высоту строки барабана. null → полный (нативный) размер.
  const presetsColRef = useRef<HTMLDivElement>(null); // колонка кнопок активного шага (пресеты/части дня)
  const [presetPY, setPresetPY] = useState<number | null>(null);
  const [presetGap, setPresetGap] = useState<number | null>(null);
  const [wheelH, setWheelH] = useState<number | null>(null); // высота строки каруселей
  // Актуальные значения в рефах — чтобы замер из ResizeObserver считал стабильно, без устаревания.
  const presetPYRef = useRef<number | null>(null);
  const presetGapRef = useRef<number | null>(null);
  const wheelHRef = useRef<number | null>(null);
  presetPYRef.current = presetPY;
  presetGapRef.current = presetGap;
  wheelHRef.current = wheelH;

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

  // Раскрытие формы. Пока имя не введено — показываем только вопрос «Как к вам обращаться?»
  // и поля (имя + телефон) по центру; блок выбора времени и подвал с кнопками скрыты.
  // Как только имя введено и фокус ушёл с поля имени (клик по телефону/любому месту панели) —
  // раскрываемся: подпись-вопрос уезжает влево и схлопывается, поле имени прижимается к верху,
  // появляется блок времени и подвал. Возврат фокуса в поле имени (или кнопка «Изменить») —
  // сворачивает обратно.
  const [revealed, setRevealed] = useState(false);
  // Открыта ли экранная клавиатура (мобилки). Пока телефон введён корректно и клавиатура поднята —
  // прячем заголовок «Когда вам удобно…» и блок из 5 кнопок; при закрытии клавиатуры они плавно
  // появляются, при повторном открытии — снова скрываются. Определяем по «схлопыванию» визуального
  // вьюпорта: клавиатура забирает существенную часть высоты окна.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // Однократная авто-прокрутка вниз, когда форма раскрылась (видны телефон + 5 кнопок), чтобы были
  // видны нижние кнопки и подвал. Сбрасывается при каждом открытии панели.
  const autoScrolledRef = useRef(false);

  const onNameFocus = () => setRevealed(false);
  const onNameBlur = () => {
    // Раскрываем, если введено имя ИЛИ уже валиден телефон (имя необязательно).
    if (data.name.trim() || phoneOk) setRevealed(true);
  };

  // Как только телефон введён полностью — раскрываем форму, даже если имя пустое
  // (подпись-вопрос и поле имени уезжают, появляются заголовок времени и 5 кнопок).
  // Дополнительно снимаем фокус с активного поля ввода: на мобильных это сразу закрывает
  // экранную клавиатуру → блок «Когда вам удобно…» и 5 кнопок плавно появляются без лишнего тапа.
  useEffect(() => {
    if (!phoneOk) return;
    setRevealed(true);
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
  }, [phoneOk]);

  // Один раз при раскрытии формы на шаге пресетов (видны телефон + 5 кнопок) — плавно прокручиваем
  // вниз, чтобы нижние кнопки и подвал попали в зону видимости (двойной rAF — ждём применения
  // новой раскладки после раскрытия).
  useEffect(() => {
    if (!open || !revealed || step !== "presets" || autoScrolledRef.current) return;
    autoScrolledRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, revealed, step]);
  // ── Кнопка «Подтвердить» рядом с полем имени (задача 2) ──────────────────────
  // Показывается, пока панель открыта, имя введено и форма ещё не раскрыта. Раньше кнопка
  // рисовалась внизу экрана в [[mobile-nav]]; теперь она встаёт ВПЛОТНУЮ СЛЕВА от поля «Ваше имя»
  // (само поле при этом уезжает к правому краю окна) — см. разметку строки ввода имени ниже.
  // Появляется не сразу, а через 1с после ввода последнего символа имени: таймер перезапускается
  // на каждое изменение поля. Скрывается — мгновенно (без задержки).
  const wantNameConfirm = open && !revealed && data.name.trim().length > 0;
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  useEffect(() => {
    if (!wantNameConfirm) {
      setShowNameConfirm(false);
      return;
    }
    const t = window.setTimeout(() => setShowNameConfirm(true), 1000);
    return () => clearTimeout(t);
  }, [wantNameConfirm, data.name]);
  // Нажатие «Подтвердить»: снять фокус с поля имени (закрыть клавиатуру) и раскрыть форму.
  const submitName = () => {
    nameRef.current?.blur();
    setRevealed(true);
  };
  // Ширина текста введённого имени — чтобы при появлении кнопки «Подтвердить» поле сжималось
  // по горизонтали ровно под имя. Меряем невидимым зеркалом-спаном (тот же унаследованный шрифт,
  // что и у input); итоговая ширина поля = ширина текста + место под иконку слева и паддинги.
  const nameMirrorRef = useRef<HTMLSpanElement>(null);
  const [nameTextW, setNameTextW] = useState(0);
  useEffect(() => {
    if (nameMirrorRef.current) setNameTextW(nameMirrorRef.current.offsetWidth);
  }, [data.name]);

  // Режимы поля «Ваше имя» (когда показана кнопка «Готово»), зависят от числа пробелов:
  //  • 0 пробелов (одно слово) — поле рядом с кнопкой, растёт вправо (nameHasSpace=false);
  //  • ≥1 пробел (два слова)   — поле уходит ПОД кнопку и растёт по ширине (nameHasSpace);
  //  • ≥2 пробелов (три слова) — то же + авто-уменьшение шрифта на максимуме ширины (nameShrink).
  const nameWords = data.name.trim() ? data.name.trim().split(/\s+/) : [];
  const nameSpaces = Math.max(0, nameWords.length - 1);

  // Ширина внутренней области полей (реф на блок имени+телефона) — чтобы вычислить минимальную
  // ширину поля имени: правый край короткого имени должен совпадать с правым краем поля телефона
  // (колонка COL шириной 72% центрирована, её правый край = центр + 36% ширины области).
  const nameBlockRef = useRef<HTMLDivElement>(null);
  const [nameAreaW, setNameAreaW] = useState(0);
  useEffect(() => {
    const el = nameBlockRef.current;
    if (!el) return;
    const update = () => setNameAreaW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  // Поле начинается от центра области (+5px зазор), правый край телефона = центр + 36% ширины,
  // значит минимальная ширина поля = 36% ширины области − 5px (снизу ограничиваем 108px).
  const minInlineWidth = nameAreaW ? Math.max(108, Math.round(nameAreaW * 0.36 - 5)) : 108;

  // Наличие пробела задаёт раскладку строки ввода (независимо от того, показана ли уже кнопка):
  //  • 0 пробелов (одно слово) — поле рядом с кнопкой, растёт вправо (горизонтальная раскладка);
  //  • ≥1 пробел (два+ слова)  — поле уходит ПОД кнопку (вертикальная раскладка, nameHasSpace).
  // Уменьшение шрифта включаем только при ≥2 пробелах (три+ слова) и уже показанной кнопке.
  const nameHasSpace = nameSpaces >= 1;
  const nameShrink = showNameConfirm && nameSpaces >= 2;

  // Инлайн-режим (одно слово): целевая ширина поля = имя + иконка/паддинги, минимум minInlineWidth
  // (короткое имя — поле не схлопывается). Конструкция [кнопка «Готово» + поле] ВСЕГДА центрируется
  // ЦЕЛИКОМ (правило «зазор строго по центру экрана» убрано — центрирование группы приоритетно):
  // при росте поля зазор между кнопкой и полем сам смещается левее центра.
  const inlineWidth = Math.max(nameTextW + 88, minInlineWidth);

  // Ширина поля в вертикальном (stacked) режиме: сначала поле ПЛАВНО расширяется по горизонтали
  // под длину имени — от ширины колонки (72% области, как у телефона) до максимума (вся ширина
  // области). Пока имя влезает в этот диапазон — шрифт базовый. Когда поле упёрлось в максимум,
  // а имя всё равно шире — только тогда подключается уменьшение шрифта (см. nameFontPx ниже).
  const minStackWidth = nameAreaW ? Math.round(nameAreaW * 0.72) : 240;
  const maxStackWidth = nameAreaW ? nameAreaW : 320;
  const stackWidth = clamp(nameTextW + 88, minStackWidth, maxStackWidth);

  // Размер шрифта имени (только при ≥2 пробелах): считаем от ЦЕЛЕВОЙ ширины поля (stackWidth), а не
  // от анимируемой фактической. Иначе при повторном открытии окна замер попадал на ещё не доросшую
  // (анимируемую) ширину — и шрифт застревал уменьшенным, хотя имя влезло бы базовым. Пока имя
  // влезает (поле не на максимуме) — scale=1, базовый 16px; когда поле упёрлось в максимум и имя
  // шире доступного места — уменьшаем пропорционально (нижний предел 8px). Замер nameTextW всегда
  // базовым шрифтом (зеркало-спан), поэтому расчёт стабилен, без обратной связи.
  const nameFontPx = useMemo(() => {
    if (!nameShrink || nameTextW <= 0) return 16;
    const avail = stackWidth - 60; // минус иконка слева (40), правый паддинг (16) и запас под каретку
    if (avail <= 0) return 16;
    const scale = Math.min(1, avail / nameTextW);
    return Math.max(8, Math.round(16 * scale));
  }, [nameShrink, nameTextW, stackWidth]);

  // «Изменить» в подвале: то же, что клик по полю имени — вернуть подпись-вопрос и поле на место.
  const startEditName = () => {
    setRevealed(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  // ── Адаптивная кнопка «Изменить имя» в подвале ────────────────────────────────
  // Имя (фиолетовое) центрировано по строке; если его левый край упирается в кнопку —
  // кнопка плавно теряет части текста: «Изменить имя» → «Изменить» → только карандаш.
  // Пороговые ширины кнопки меряем невидимыми клонами (full/short), имя — по реальному
  // спану; расчёт детерминирован (клоны статичны) — без обратной связи от анимации.
  const editRowRef = useRef<HTMLDivElement>(null);
  const editNameRef = useRef<HTMLSpanElement>(null);
  const editBtnFullRef = useRef<HTMLSpanElement>(null);
  const editBtnShortRef = useRef<HTMLSpanElement>(null);
  const [editMode, setEditMode] = useState<"full" | "short" | "icon">("full");
  useEffect(() => {
    if (!open || !revealed) return;
    const row = editRowRef.current;
    if (!row) return;
    const GAP = 8; // мин. зазор между кнопкой и левым краем имени
    const update = () => {
      const nameW = editNameRef.current?.offsetWidth ?? 0;
      if (!nameW) {
        setEditMode("full");
        return;
      }
      const left = (row.clientWidth - nameW) / 2; // левый край центрированного имени
      const fullW = editBtnFullRef.current?.offsetWidth ?? 0;
      const shortW = editBtnShortRef.current?.offsetWidth ?? 0;
      setEditMode(left >= fullW + GAP ? "full" : left >= shortW + GAP ? "short" : "icon");
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(row);
    return () => ro.disconnect();
  }, [open, revealed, status, data.name]);

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

  // Подгонка активного шага под доступную высоту (зависит от вертикального разрешения):
  // • «presets» (5 кнопок) и «parts» (4 кнопки) — ужимаем сперва вертикальный паддинг кнопок
  //   (12→4), затем промежутки между ними (12→6);
  // • «wheels» (карусели «час/минута» и «день и месяц/час/минута») — уменьшаем высоту строки
  //   барабана (62→40); видимая высота каждого барабана = 3 строки.
  // Если всё помещается — возвращаем нативные размеры.
  //
  // Высоту содержимого меряем как СУММУ высот прямых детей области + её вертикальные паддинги —
  // это настоящая «натуральная» высота, которая, в отличие от scrollHeight, не упирается в
  // clientHeight, когда контент помещается. Прибавляя уже сэкономленную высоту (saved), получаем
  // высоту «как при полном размере» → расчёт стабилен и корректно включается/выключается.
  const fitControls = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    // Натуральная высота содержимого = верт. паддинги области + высоты прямых детей + их отступы.
    // ВАЖНО: у первого ребёнка верхний отступ — центрирующий mt-auto, у последнего нижний — mb-auto;
    // они держат «люфт» центрирования и в высоту содержимого НЕ входят (иначе высота всегда была бы
    // равна доступной и подгонка не включалась). Поэтому пропускаем marginTop у первого и marginBottom
    // у последнего, а фиксированные отступы (mt-8 у заголовка, mt-3 у блока времени) — учитываем.
    const cs = getComputedStyle(scroller);
    let content = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const kids = Array.from(scroller.children) as HTMLElement[];
    kids.forEach((el, i) => {
      const s = getComputedStyle(el);
      content += el.offsetHeight;
      if (i > 0) content += parseFloat(s.marginTop) || 0; // верхний auto только у первого — пропускаем
      if (i < kids.length - 1) content += parseFloat(s.marginBottom) || 0; // нижний auto только у последнего
    });

    // ===== Шаг каруселей: ужимаем высоту строки барабанов =====
    if (step === "wheels") {
      const curH = wheelHRef.current ?? WHEEL_H_FULL;
      const saved = (WHEEL_H_FULL - curH) * 3; // барабан показывает 3 строки
      const need = content + saved - scroller.clientHeight;
      if (need <= 0) {
        if (wheelHRef.current !== null) setWheelH(null);
        return;
      }
      const h = Math.round(Math.max(WHEEL_H_MIN, WHEEL_H_FULL - need / 3));
      if (h !== curH) setWheelH(h);
      return;
    }

    // ===== Кнопочные шаги: 5 пресетов или 4 части дня =====
    const col = presetsColRef.current;
    if (!col) return;
    const nBtn = step === "presets" ? PRESETS.length : PARTS.length;
    const gaps = Math.max(0, nBtn - 1);
    const curPy = presetPYRef.current ?? PRESET_PY_FULL;
    const curGap = presetGapRef.current ?? PRESET_GAP_FULL;
    const saved = (PRESET_PY_FULL - curPy) * 2 * nBtn + (PRESET_GAP_FULL - curGap) * gaps;
    // Высота, как если бы кнопки были полноразмерными.
    const need = content + saved - scroller.clientHeight;

    // Помещается при полном размере — нативные отступы.
    if (need <= 0) {
      if (presetPYRef.current !== null) setPresetPY(null);
      if (presetGapRef.current !== null) setPresetGap(null);
      return;
    }
    let rem = need;
    // Сначала ужимаем паддинг самих кнопок…
    const maxPy = (PRESET_PY_FULL - PRESET_PY_MIN) * 2 * nBtn;
    const usePy = Math.min(rem, maxPy);
    const py = Math.round(Math.max(PRESET_PY_MIN, PRESET_PY_FULL - usePy / (2 * nBtn)));
    rem -= usePy;
    // …затем промежутки между ними (если ужима паддинга не хватило).
    const maxGap = (PRESET_GAP_FULL - PRESET_GAP_MIN) * gaps;
    const useGap = Math.min(rem, maxGap);
    const gapPx = gaps
      ? Math.round(Math.max(PRESET_GAP_MIN, PRESET_GAP_FULL - useGap / gaps))
      : PRESET_GAP_FULL;
    if (py !== curPy) setPresetPY(py);
    if (gapPx !== curGap) setPresetGap(gapPx);
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
    // Одновременно обновляем свой скроллбар и подгоняем вертикальный размер активного шага
    // (кнопки/карусели) под доступную высоту.
    const onResize = () => {
      updateScrollbar();
      fitControls();
    };
    const raf = requestAnimationFrame(onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, status, part, preset, phoneOk, revealed]);

  // Дублируем пересчёт подгонки на изменения состояния и размеров окна (высота панели зависит
  // от промежутка gap.top/bottom, а он меняется при ресайзе/повороте) — чтобы срабатывало надёжно,
  // не только по ResizeObserver. rAF — ждём применения новой раскладки перед замером.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(fitControls);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, revealed, step, preset, part, wheelKind, touched, phoneOk, data.name, gap.top, gap.bottom]);

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
    autoScrolledRef.current = false; // сбрасываем однократный авто-скролл вниз при новом открытии
    // Если имя уже сохранено ИЛИ телефон уже валиден (возврат клиента) — открываемся раскрытыми.
    setRevealed(Boolean(data.name.trim()) || phoneOk);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Слежение за экранной клавиатурой через visualViewport: клавиатура уменьшает высоту визуального
  // вьюпорта относительно окна. Порог 120px отсекает адресную строку и мелкие сдвиги.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboardOpen(window.innerHeight - vv.height > 120);
    check();
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    return () => {
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
    };
  }, [open]);

  // Пока телефон введён корректно и клавиатура открыта — держим блок выбора времени свёрнутым
  // (плавно уезжает), чтобы не мешать вводу; после закрытия клавиатуры он так же плавно появляется.
  const timeRevealed = revealed && !(keyboardOpen && phoneOk);

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
    if (step === "wheels") {
      if (wheelKind === "hm") {
        // Возврат из каруселей «Завтра» → к частям дня (пресет «Завтра» остаётся выбранным).
        setStep("parts");
      } else {
        // Возврат из «Другое время»: точное время НЕ задано, а перезвонить «в другое время»
        // не зная его нельзя — поэтому автоматически сбрасываем выбор на «Сейчас».
        setStep("presets");
        setPreset("now");
        setPart(null);
      }
    } else if (step === "parts") {
      setStep("presets");
    }
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
                  // pb-3: небольшой зазор снизу — 5-я кнопка «Другое время» не упирается вплотную
                  // в подвал (border-t). Замер fitControls учитывает паддинги области, так что при
                  // нехватке высоты кнопки ужмутся чуть сильнее, сохраняя этот зазор.
                  className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-6"
                  data-lenis-prevent
                >
                {/* Вертикальное центрирование: mt-auto здесь + mb-auto у блока выбора времени.
                    Пока форма свёрнута — имя+телефон по центру; по мере раскрытия нижней части
                    авто-отступы пересчитываются плавно и конструкция «подтягивается» к верху.
                    При нехватке высоты авто-отступы схлопываются в 0 → прижатие к верху. */}
                {/* Поля: имя + телефон в узкой центрированной колонке (−40% по ширине).
                    shrink-0: дети flex-колонки НЕ сжимаются браузером при нехватке высоты — иначе
                    замер fitControls всегда видел «всё помещается» и ужатие кнопок не включалось. */}
                <div ref={nameBlockRef} className="mt-auto w-full shrink-0">
                  {/* 1. Имя — необязательно. Блок имени занимает ВСЮ ширину (в отличие от узкой
                      колонки COL): это нужно, чтобы поле могло уехать вплотную к правому краю окна,
                      а слева от него поместилась кнопка «Подтвердить» (задача 2). Телефон ниже
                      остаётся в прежней центрированной колонке COL. */}
                  {/* Внешний контейнер — div (не label): внутри строки ввода теперь есть ещё и
                      кнопка «Подтвердить», а <button> внутри <label> перехватил бы ассоциацию
                      label→control. Клик-по-подписи для фокуса поля больше не нужен: сам <label>
                      висит непосредственно на поле ввода (ниже). */}
                  <div className="block">
                    {/* Подпись-вопрос: уезжает влево и схлопывается по высоте при раскрытии
                        (тогда поле имени поднимается к верху), выезжает обратно при возврате. */}
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-500 ease-out",
                        revealed
                          ? "max-h-0 -translate-x-[130%] opacity-0"
                          : "mb-1.5 max-h-10 translate-x-0 opacity-100"
                      )}
                    >
                      <span className="block text-center text-sm font-medium text-ink">
                        Как можем к <strong className="font-bold">вам</strong> обращаться?
                      </span>
                    </div>
                    {/* Поле имени + подпись «НЕ обязательно» уезжают ЗА верхний край окна при
                        раскрытии: внешняя обёртка схлопывает высоту (телефон плавно поднимается),
                        внутренняя уводит содержимое вверх (translateY) с затуханием. */}
                    <div
                      className={cn(
                        "overflow-hidden transition-[max-height,opacity] duration-500 ease-out",
                        revealed ? "max-h-0 opacity-0" : "max-h-28 opacity-100"
                      )}
                    >
                      <div
                        className={cn(
                          "transition-transform duration-500 ease-out",
                          revealed ? "-translate-y-full" : "translate-y-0"
                        )}
                      >
                        {/* Строка ввода имени. По умолчанию поле «Ваше имя» — по центру и шириной
                            72% (как остальные поля). Как только введён ≥1 символ и прошла секунда
                            (showNameConfirm), поле сжимается под введённое имя, а рядом появляется
                            кнопка «Готово»: без пробелов — слева от поля (ряд), с пробелом — над
                            полем (столбец). Конструкция [кнопка + поле] центрируется ЦЕЛИКОМ; зазор
                            между ними (10px в ряду / 8px в столбце) анимируется вместе с кнопкой. */}
                        <div
                          className={cn(
                            "flex",
                            nameHasSpace ? "flex-col items-center" : "items-center justify-center"
                          )}
                        >
                          {/* Кнопка и поле разнесены по двум РАВНЫМ половинам строки, поэтому
                              «условная линия» между ними (центр зазора 10px) приходится ровно на
                              центр экрана: кнопка прижата к центру справа (pr-[5px]), поле — к центру
                              слева (pl-[5px]). В покое левая половина схлопнута (w-0), а правая
                              занимает всю строку и центрирует поле (72%). */}
                          <div
                            // Вертикальный режим: обёртка кнопки плавно раскрывается по высоте
                            // (0→48px = кнопка h-12) с зазором 8px до поля (margin-bottom анимируется
                            // вместе с высотой), толкая поле вниз; сама кнопка проявляется позже
                            // (opacity с задержкой). Горизонтальный: кнопка растёт по ширине слева
                            // от поля, конструкция центрируется целиком.
                            style={
                              nameHasSpace
                                ? {
                                    maxHeight: showNameConfirm ? 48 : 0,
                                    marginBottom: showNameConfirm ? 8 : 0,
                                    transition: "max-height 500ms ease-out, margin-bottom 500ms ease-out",
                                  }
                                : undefined
                            }
                            className={cn(
                              "flex",
                              nameHasSpace
                                ? "w-full justify-center overflow-hidden"
                                : showNameConfirm
                                  ? "shrink-0"
                                  : "w-0 justify-end overflow-hidden"
                            )}
                          >
                          {/* Кнопка «Подтвердить»: прежний вид «клавиши», уменьшенный на 25%
                              (h-16→h-12, border-4→3px, иконка h-8→h-6, текст 20→15px). Ширину и
                              прозрачность анимируем раздельно: сперва поле забирает ширину и уезжает
                              вправо (max-width, 500мс), затем в освободившемся слева месте проявляется
                              кнопка (opacity с задержкой ~350мс) — «поле сместилось → появилась кнопка». */}
                          <button
                            type="button"
                            tabIndex={showNameConfirm ? 0 : -1}
                            aria-hidden={!showNameConfirm}
                            aria-label="Готово"
                            onClick={submitName}
                            // opacity с задержкой 500мс — кнопка проявляется ТОЛЬКО ПОСЛЕ того, как
                            // поле сместилось (вправо в инлайне / вниз в stacked; оба движения 500мс).
                            // margin-right — зазор 10px до поля в ряду, растёт вместе с шириной кнопки
                            // (в столбце зазор даёт margin-bottom обёртки выше).
                            style={{
                              transition:
                                "max-width 500ms ease-out, margin-right 500ms ease-out, opacity 300ms ease-out 500ms",
                              maxWidth: showNameConfirm ? 200 : 0,
                              marginRight: !nameHasSpace && showNameConfirm ? 10 : 0,
                              opacity: showNameConfirm ? 1 : 0,
                            }}
                            className={cn(
                              "flex h-12 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border-[3px] border-primary/70 bg-primary/15 px-3 text-primary shadow-[0_3px_0_rgb(var(--primary)/0.45)] active:translate-y-px active:shadow-none",
                              !showNameConfirm && "pointer-events-none border-0 px-0"
                            )}
                          >
                            <CornerDownLeft className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                            <span className="text-[15px] font-extrabold leading-none">Готово</span>
                          </button>
                          </div>
                          {/* Обёртка поля: в покое занимает всю строку и центрирует поле (72%);
                              при показанной кнопке — участвует в общем центрировании группы
                              (min-w-0: при переполнении области поле ужимается, кнопка — нет). */}
                          <div
                            className={cn(
                              "flex",
                              nameHasSpace
                                ? "w-full justify-center"
                                : showNameConfirm
                                  ? "min-w-0"
                                  : "w-full justify-center"
                            )}
                          >
                          {/* «Утопленный» вид поля (bg-surface-2 + внутренняя тень) + иконка слева —
                              чтобы поле явно читалось как поле ВВОДА, а не как кнопка. По умолчанию —
                              72% и по центру; при showNameConfirm поле сжимается по горизонтали ровно
                              под введённое имя (ширина = текст + иконка + паддинги) и следует за длиной
                              имени в реальном времени. Сам <label> — на поле: клик фокусирует ввод. */}
                          <label
                            // Инлайн-режим (одно слово): ширина под текущее имя = текст (nameTextW) +
                            // место под иконку слева (pl-10=40) + правый паддинг (pr-4=16) + рамки/
                            // каретка + запас ~30px. Нижний предел minInlineWidth — короткое имя не
                            // схлопывает поле; длинное имя перекрывает предел и поле растёт (вся
                            // конструкция [кнопка+поле] при этом остаётся центрированной целиком).
                            // Stacked-режим (≥1 пробел): поле под кнопкой, ширина stackWidth — плавно
                            // растёт под длину имени от колонки (72%) до максимума (вся ширина области);
                            // дальше, при ≥2 пробелах, подключается уменьшение шрифта (nameFontPx).
                            // duration-200: ширина следует за вводом в реальном времени, плавно.
                            style={
                              showNameConfirm
                                ? { width: nameHasSpace ? stackWidth : inlineWidth }
                                : undefined
                            }
                            className={cn(
                              "relative transition-all duration-200 ease-out",
                              showNameConfirm ? "min-w-0" : "w-[72%] min-w-[240px]"
                            )}
                          >
                            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                            <input
                              ref={nameRef}
                              value={data.name}
                              // Каждое слово имени — с заглавной буквы.
                              onChange={(e) => setLeadField("name", capWords(e.target.value))}
                              onFocus={onNameFocus}
                              onBlur={onNameBlur}
                              // Enter в поле имени — перейти дальше (снять фокус → форма раскрывается).
                              onKeyDown={(e) => e.key === "Enter" && nameRef.current?.blur()}
                              placeholder="Ваше имя"
                              // При ≥2 пробелах шрифт уменьшается под ширину поля (nameFontPx).
                              // Зеркало-замер ниже остаётся базовым (шрифт не наследует уменьшение).
                              style={nameShrink ? { fontSize: nameFontPx } : undefined}
                              className="h-12 w-full rounded-md border border-hairline bg-surface-2 pl-10 pr-4 text-ink shadow-inner outline-none transition-colors placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
                            />
                            {/* Невидимое зеркало текста для замера ширины имени (тот же унаследованный
                                шрифт, что и у input). absolute → не влияет на раскладку поля. */}
                            <span
                              ref={nameMirrorRef}
                              aria-hidden="true"
                              className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre"
                            >
                              {data.name}
                            </span>
                          </label>
                          </div>
                        </div>
                        {/* Подпись под именем — «НЕ обязательно», зелёная. На 30% крупнее базового
                            text-xs (0.75rem × 1.3 = 0.975rem). Текст обёрнут в inline-block с
                            циклической анимацией подчёркивания (полоса заполняется слева направо,
                            затем исчезает и начинает заново) — класс .animate-cb-underline. */}
                        {/* pb-1: даём место анимированному подчёркиванию (::after на bottom:-2px),
                            иначе его срезает верхний контейнер overflow-hidden (max-h-28). */}
                        {/* Подпись остаётся на ИСХОДНОМ месте (центрированные 72%, правый край на
                            уровне поля в покое) и НЕ едет вправо вместе с полем при появлении кнопки. */}
                        <span className="mt-1 mx-auto block w-[72%] pb-1 text-right">
                          <span className="animate-cb-underline relative inline-block text-[0.975rem] font-medium text-success">
                            НЕ обязательно
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Телефон — обязательно. Выбор страны флаг-дропдауном + форматирование и
                       валидация из libphonenumber-js (для РФ — строго мобильный 9XX). */}
                  <label className={cn(COL, "mt-6 block")}>
                    <span className="mb-1.5 block text-center text-[1.05rem] font-medium text-ink">Номер телефона:</span>
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

                {/* 3. Заголовок «Когда вам удобно…» — выезжает справа к центру (внутренний
                    translateX) и схлопывается по высоте, когда форма свёрнута. */}
                <div
                  className={cn(
                    "shrink-0 overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-out",
                    timeRevealed ? "mt-8 max-h-20 opacity-100" : "mt-0 max-h-0 opacity-0"
                  )}
                >
                  <div
                    className={cn(
                      "text-center text-[15px] font-medium transition-transform duration-500 ease-out",
                      timeRevealed ? "translate-x-0" : "translate-x-[130%]"
                    )}
                  >
                    <span className="block text-ink">
                      Когда вам удобно <strong className="font-bold">получить консультацию</strong>?
                    </span>
                  </div>
                </div>

                {/* Блок выбора времени — выезжает снизу, из-под нижнего края окна (внутренний
                    translateY), и схлопывается по высоте, когда форма свёрнута.
                    mb-auto — пара к mt-auto колонки полей (вертикальное центрирование). */}
                <div
                  className={cn(
                    "mb-auto shrink-0 overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-out",
                    timeRevealed ? "mt-3 max-h-[560px] opacity-100" : "mt-0 max-h-0 opacity-0"
                  )}
                >
                  <div
                    className={cn(
                      "transition-transform duration-500 ease-out",
                      timeRevealed ? "translate-y-0" : "translate-y-full"
                    )}
                  >
                    {/* overflow-x-clip: прячем горизонтальный уезд кнопок при анимации слайда.
                        ВАЖНО: при overflow-x: clip браузер вычисляет overflow-y тоже как clip
                        (visible рядом с clip невозможен), поэтому по вертикали контент ТОЖЕ
                        обрезается по нижнему краю. Из-за этого срезалась «приподнятая» тень-
                        ступенька последней кнопки «Другое время» (shadow 0 2px 0) — выглядело
                        как будто её нижний край чем-то перекрыт. pb-1 даёт 4px запаса снизу под
                        эту тень (padding входит в область отсечения, поэтому тень снова видна).
                        Без min-h: минимальная высота завышала замер fitControls на шагах
                        «части дня» (натуральная высота ~220px) и «карусели» (~232px) — они
                        ужимались без надобности и не разжимались обратно при появлении места. */}
                    <div className="relative overflow-x-clip pb-1">
                  {/* Шаг 1: 5 пресет-кнопок. Слой анимации — полной ширины (чтобы узкая
                      колонка целиком уезжала за край), внутри — центрированная колонка 60%. */}
                  {step === "presets" && (
                    <div key="presets" className={cn("w-full", animClass)}>
                      <div
                        ref={presetsColRef}
                        className={cn("flex flex-col items-center gap-3", COL)}
                        style={presetGap != null ? { gap: presetGap } : undefined}
                      >
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
                              // вертикальный паддинг ужимается, если 5 кнопок не помещаются по высоте
                              padY={presetPY}
                              onClick={() => choosePreset(key)}
                            />
                            {/* Подсказка следует за выбором. «По умолчанию» — только у «Сейчас»
                                (это выбор по умолчанию); у остальных кнопок «Выберите по желанию»
                                (п.2). Показываем всегда у выбранной кнопки — в т.ч. после ввода
                                телефона (раньше по ошибке скрывалась при валидном номере). */}
                            {preset === key && (
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
                      {/* Та же авто-подгонка, что у 5 пресетов: паддинг и промежутки ужимаются,
                          если 4 кнопки не помещаются по вертикали. */}
                      <div
                        ref={presetsColRef}
                        className={cn("flex flex-col items-center gap-3", COL)}
                        style={presetGap != null ? { gap: presetGap } : undefined}
                      >
                        {PARTS.map(({ key, label }) => (
                          <ChoiceButton
                            key={key}
                            label={label}
                            selected={part === key}
                            // после выбора остальные до 50%
                            dim={part !== null && part !== key ? 50 : false}
                            widthPct={PART_WIDTH[key]}
                            padY={presetPY}
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
                      {/* itemH: высота строки барабанов ужимается fitControls, если карусели
                          не помещаются по вертикали (та же логика, что у кнопок). */}
                      <div className="flex items-start justify-center gap-2 pt-6">
                        {wheelKind === "dhm" && (
                          <WheelPicker label="День и месяц" wide items={days} index={dIdx} onChange={setDIdx} inertia={0.9} itemH={wheelH ?? WHEEL_H_FULL} />
                        )}
                        {/* Часы — выбор только 9:00–21:00 (вне диапазона авто-прокрутка и приглушение),
                            минуты — бесконечно. Обе крутятся нативно (плавность как на iPhone). */}
                        <WheelPicker label="Час" items={hours} index={hIdx} onChange={setHIdx} loop inertia={0.9} range={[9, 21]} itemH={wheelH ?? WHEEL_H_FULL} />
                        <WheelPicker label="Минута" items={minutes} index={mIdx} onChange={setMIdx} loop inertia={0.95} itemH={wheelH ?? WHEEL_H_FULL} />
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                </div>
                </div>

                {/* Свой скроллбар отключён по ТЗ (SHOW_SCROLLBAR=false): бегунок не появляется,
                    даже если контент не помещается по высоте — прокрутка остаётся тач-жестом. */}
                {SHOW_SCROLLBAR && sb.visible && (
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

              {/* «< Назад» — над разделительной линией: на 10% крупнее, чуть выше и правее.
                  Показываем только в раскрытой форме. */}
              {revealed && step !== "presets" && (
                <button
                  type="button"
                  onClick={back}
                  className="-mt-3 mb-4 ml-6 flex items-center gap-1 text-[0.9625rem] font-medium text-muted transition-colors active:text-ink"
                >
                  <ChevronLeft className="h-[18px] w-[18px]" /> Назад
                </button>
              )}

              {/* Подвал: превью + кнопка подтверждения. Виден только в раскрытой форме
                  (а раскрытие возможно лишь при введённом имени). */}
              {revealed && (
              <div className="border-t border-hairline px-4 pt-3 pb-5 animate-fade-in">
                {/* Превью в две строки. 1-я: кнопка «Изменить имя» (карандаш анимирован) + имя
                    пользователя приятным фиолетовым с запятой (прижата к левому краю). 2-я:
                    «мы вам перезвоним: …» (прижата к правому краю). items-stretch — чтобы строки
                    занимали всю ширину и могли выравниваться по разным краям. mb-4 — больше
                    вертикального отступа до кнопки «Подтвердить обратный звонок». */}
                <div className="mb-4 flex flex-col items-stretch gap-1 text-[0.945rem] text-muted">
                  {/* 1-я строка: кнопка «Изменить имя» прижата к левому краю (absolute), а имя
                      клиента центрируется по всей ширине строки (не смещается кнопкой). */}
                  <div ref={editRowRef} className="relative flex min-h-[1.75rem] items-center">
                    <button
                      type="button"
                      onClick={startEditName}
                      aria-label="Изменить имя"
                      className="absolute left-0 inline-flex items-center rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-ink active:scale-95"
                    >
                      {/* Пока имя не введено — приглашаем представиться; как только введено — «Изменить имя».
                          Части текста плавно схлопываются (max-width+margin+opacity) по editMode:
                          full → «Изменить имя», short → «Изменить», icon → только карандаш. */}
                      <Pencil className="animate-pencil-wiggle h-3.5 w-3.5 shrink-0 text-primary" />
                      {data.name.trim() ? (
                        <>
                          <span
                            style={{
                              maxWidth: editMode !== "icon" ? 80 : 0,
                              marginLeft: editMode !== "icon" ? 4 : 0,
                              opacity: editMode !== "icon" ? 1 : 0,
                              transition:
                                "max-width 300ms ease-out, margin-left 300ms ease-out, opacity 300ms ease-out",
                            }}
                            className="inline-block overflow-hidden whitespace-nowrap"
                          >
                            Изменить
                          </span>
                          <span
                            style={{
                              maxWidth: editMode === "full" ? 48 : 0,
                              marginLeft: editMode === "full" ? 4 : 0,
                              opacity: editMode === "full" ? 1 : 0,
                              transition:
                                "max-width 300ms ease-out, margin-left 300ms ease-out, opacity 300ms ease-out",
                            }}
                            className="inline-block overflow-hidden whitespace-nowrap"
                          >
                            имя
                          </span>
                        </>
                      ) : (
                        <span className="ml-1">Как можем к вам обращаться?</span>
                      )}
                    </button>
                    {/* Имя по центру строки. При пустом имени запятую не показываем.
                        Внутренний inline-block-спан — для замера ширины имени (editMode). */}
                    {data.name.trim() && (
                      <span className="w-full text-center">
                        <span ref={editNameRef} className="inline-block whitespace-nowrap">
                          <span className="font-semibold" style={{ color: "#b45cf2" }}>
                            {data.name.trim()}
                          </span>
                          ,
                        </span>
                      </span>
                    )}
                    {/* Невидимые клоны кнопки (те же шрифт/паддинги/рамка) — замер пороговых
                        ширин для режимов full/short. absolute+invisible: на раскладку не влияют. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none invisible absolute left-0 top-0 flex whitespace-nowrap"
                    >
                      <span ref={editBtnFullRef} className="inline-flex items-center border px-2.5 py-1 text-xs font-medium">
                        <span className="h-3.5 w-3.5 shrink-0" />
                        <span className="ml-1">Изменить имя</span>
                      </span>
                      <span ref={editBtnShortRef} className="inline-flex items-center border px-2.5 py-1 text-xs font-medium">
                        <span className="h-3.5 w-3.5 shrink-0" />
                        <span className="ml-1">Изменить</span>
                      </span>
                    </span>
                  </div>
                  {/* 2-я строка: «мы вам перезвоним: …» по центру. */}
                  <div className="text-center">
                    Мы <strong className="font-bold">вам</strong> перезвоним:{" "}
                    <span className="font-semibold text-ink">{whenText()}</span>
                  </div>
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
              )}
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
  padY,
}: {
  label: string;
  selected: boolean;
  dim: false | 30 | 50;
  onClick: () => void;
  widthPct?: number; // ширина в % от колонки (для кнопок части дня); по умолчанию — во всю ширину
  bold?: boolean; // жирная метка (для кнопки «Сейчас»)
  padY?: number | null; // вертикальный паддинг в px (перекрывает py-3), если кнопки не влезают по высоте
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Инлайн-стиль (если задан) перекрывает классы: ширину — для кнопок части дня, вертикальный
      // паддинг — когда 5 пресет-кнопок ужимаются, чтобы поместиться по высоте.
      style={{
        ...(widthPct ? { width: `${widthPct}%` } : {}),
        ...(padY != null ? { paddingTop: padY, paddingBottom: padY } : {}),
      }}
      // Явный «кнопочный» вид, чтобы вариант нельзя было спутать с полем ввода:
      // • форма-пилюля (rounded-full) в отличие от прямоугольных полей;
      // • радио-индикатор слева (кольцо → зелёная галка);
      // • «приподнятая» нижняя тень-ступенька (0 2px 0) с проседанием при нажатии.
      // Анимируем только цвета/тень/нажатие/прозрачность — НЕ паддинг (transition-all нельзя):
      // иначе авто-ужатие высоты (padY из fitControls) анимируется, ResizeObserver ловит
      // промежуточные высоты и кнопки «пружинят» туда-сюда. Размер применяется мгновенно.
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-center rounded-full border px-11 py-3 text-center text-[15px] shadow-[0_2px_0_rgba(17,17,17,0.08)] transition-[border-color,background-color,color,box-shadow,transform,opacity] duration-200 active:translate-y-px active:shadow-none",
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
  itemH = WHEEL_H_FULL,
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (i: number) => void;
  wide?: boolean;
  loop?: boolean; // бесконечная прокрутка вверх/вниз (час/минута)
  inertia?: number; // сила инерции ручного перетаскивания мышью (0 — без инерции)
  range?: [number, number]; // допустимый диапазон значений (час: [9,21]); вне — приглушение + авто-докрутка
  itemH?: number; // высота строки (px); ужимается fitControls, если карусели не влезают по вертикали
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM_H = itemH; // высота строки

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
  // При смене высоты строки (авто-ужатие itemH) пересинхронизируем позицию к выбранному значению,
  // иначе scrollTop, посчитанный под старую высоту, укажет на другой элемент.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = topFor(index);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemH]);

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
