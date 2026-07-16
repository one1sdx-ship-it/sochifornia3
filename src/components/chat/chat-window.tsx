"use client";

// Окно чата. Мобильные: во весь экран под шапкой (fade — как «Перезвоните мне»).
// Десктоп: панель справа снизу (~25% экрана). Фон — градиент в фирменных цветах,
// типографика «воздушнее» (крупнее текст, больше отступов).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, Camera, Headset, Loader2, Mic, Send, Square, Trash2, User, X,
} from "lucide-react";
import { type CountryCode } from "libphonenumber-js";
import { cn } from "@/lib/utils";
import { useLeadData, setLeadField } from "@/components/lead-store";
import { PhoneInput, isPhoneValid, toE164, fromE164 } from "@/components/phone-input";
import { stopScroll, startScroll } from "@/components/smooth-scroll";
import { Bubble, DayDivider, TypingBubble, dayLabel } from "@/components/chat/chat-bubbles";
import type { ChatMsg, StaffInfo, TourCtx } from "@/components/chat/use-chat";

// Быстрые вопросы при первом открытии (в один тап).
const QUICK_QUESTIONS = [
  "Сколько стоит и как оплатить?",
  "Есть ли места на ближайшие даты?",
  "Можно ли с детьми?",
  "Как одеться и что взять с собой?",
];

// Ключ черновика сообщения в localStorage: текст поля ввода сохраняется между сессиями, чтобы не
// потерялся при закрытии сайта/приложения (в т.ч. когда номер ещё не введён).
const DRAFT_KEY = "chat:draft";

// Каждое слово — с заглавной буквы (для поля имени): «иван петров» → «Иван Петров».
// Трогаем только первую букву после начала строки, пробела или дефиса; остальные символы не меняем.
const capWords = (s: string) => s.replace(/(^|[\s-])(\S)/g, (_, p: string, c: string) => p + c.toUpperCase());

type SendPayload = { type: "TEXT" | "IMAGE" | "VOICE"; text?: string; attachmentUrl?: string };

export function ChatWindow({
  open, onClose, messages, localMsgs, staffTyping, staff, online, exists,
  tgLink, tgLinked, readUpTo, tourCtx,
  onSend, onTyping, onUpload, canAskPush, onEnablePush, onPickContact,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMsg[];
  localMsgs: ChatMsg[]; // приветствие/приглашение робота — живут только в браузере
  staffTyping: { name: string } | null;
  staff: StaffInfo;
  online: boolean;
  exists: boolean; // диалог уже создан (телефон получен)
  tgLink: string | null;
  tgLinked: boolean;
  readUpTo: string | null;
  tourCtx: TourCtx;
  onSend: (p: SendPayload, contact?: { name: string; phone: string }) => Promise<{ ok: boolean; error?: string }>;
  onTyping: () => void;
  onUpload: (file: Blob, filename: string) => Promise<string | null>;
  canAskPush: boolean;
  onEnablePush: () => void;
  // Клиент выбрал канал обратной связи (телефон/tg/wa/max) — сохраняем, чтобы видел админ (задача 5).
  onPickContact: (channel: string) => void;
}) {
  const data = useLeadData();
  // Плавное закрытие: когда open становится false, окно не исчезает мгновенно, а доигрывает
  // анимацию ухода вниз (зеркально открытию снизу вверх), и лишь затем размонтируется.
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
    } else if (render) {
      // Окно было открыто → проигрываем уход вниз, затем размонтируем.
      setClosing(true);
      const t = setTimeout(() => {
        setRender(false);
        setClosing(false);
      }, 340); // == длительность chat-slide-down
      return () => clearTimeout(t);
    }
  }, [open, render]);
  const [input, setInput] = useState("");
  const [gateError, setGateError] = useState(false);
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gapTop, setGapTop] = useState(0);
  // Выбранные, но ещё не отправленные фото (Telegram-стиль: превью + подпись).
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ── Телефон/имя — те же общие поля, что в «Перезвоните мне» ([[lead-store]]) ──
  const country = ((data.country as CountryCode) || "RU") as CountryCode;
  const national = fromE164(data.phone, country);
  const phoneOk = isPhoneValid(country, national);
  const setCountry = (c: CountryCode) => {
    setLeadField("country", c);
    setLeadField("phone", toE164(c, national));
  };
  const setNational = (d: string) => setLeadField("phone", toE164(country, d));

  // ── Голосовые ──
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [recTime, setRecTime] = useState(0);
  const recChunks = useRef<Blob[]>([]);
  const recCancelled = useRef(false);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Жизненный цикл открытого окна: замок прокрутки, Esc, «Назад» (Android), замер шапки.
  useEffect(() => {
    if (!open) return;
    const header = document.querySelector("header");
    const measure = () => setGapTop(header ? Math.round(header.getBoundingClientRect().bottom) : 0);
    measure();
    stopScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.history.pushState({ ...window.history.state, chat: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("resize", measure);
      startScroll();
      if (window.history.state?.chat) window.history.back();
    };
  }, [open]);

  const total = messages.length + localMsgs.length + (staffTyping ? 1 : 0);

  // «Держаться низа»: пока пользователь не пролистнул историю вверх, лента возвращается к
  // последнему сообщению. Флаг обновляем по скроллу самого списка.
  const stickRef = useRef(true);
  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Жёсткая прокрутка вниз при КАЖДОМ открытии окна (в т.ч. после перезагрузки F5+Ctrl и после
  // «закрыл → открыл»). История и картинки могут дозагрузиться уже после появления окна, а плавная
  // прокрутка при этом «не доезжает» — поэтому прыгаем мгновенно (scrollTop) несколько раз: сразу,
  // на ближайших кадрах и с задержками, пока лента не устаканится.
  useEffect(() => {
    if (!open) return;
    stickRef.current = true;
    const el = listRef.current;
    if (!el) return;
    const toBottom = () => {
      const node = listRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    };
    toBottom();
    const rafs = [
      requestAnimationFrame(toBottom),
      requestAnimationFrame(() => requestAnimationFrame(toBottom)),
    ];
    const timers = [60, 160, 320, 600, 1000].map((ms) => setTimeout(toBottom, ms));
    return () => {
      rafs.forEach(cancelAnimationFrame);
      timers.forEach(clearTimeout);
    };
  }, [open]);

  // Новые сообщения/«печатает…» при открытом окне: подматываем вниз, только если пользователь
  // уже у низа ленты (не мешаем читать историю, если он пролистнул вверх).
  useEffect(() => {
    if (!open || !stickRef.current) return;
    const el = listRef.current;
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [open, total]);

  // Освобождаем object-URL превью при размонтировании (без утечек памяти).
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Черновик сообщения переживает закрытие сайта: читаем при монтировании, пишем при каждом
  // изменении, очищаем — только после успешной отправки (setInput("")). Поэтому текст не теряется,
  // если номер ещё не введён.
  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) {
        setInput(d);
        requestAnimationFrame(() => fitTextarea(d));
      }
    } catch {
      /* localStorage недоступен */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, input);
    } catch {
      /* localStorage недоступен */
    }
  }, [input]);

  // Лента: локальные (приветствие/робот) + серверные, с разделителями дней.
  const feed = useMemo(() => {
    const all = [...localMsgs, ...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: ({ kind: "day"; label: string; key: string } | { kind: "msg"; msg: ChatMsg })[] = [];
    let lastDay = "";
    for (const m of all) {
      const day = dayLabel(m.createdAt);
      if (day !== lastDay) {
        out.push({ kind: "day", label: day, key: "day-" + day + m.createdAt });
        lastDay = day;
      }
      out.push({ kind: "msg", msg: m });
    }
    return out;
  }, [messages, localMsgs]);

  async function doSend(payload: SendPayload) {
    setSendError("");
    // Первое сообщение — нужен телефон (форма «как в Перезвоните мне»).
    if (!exists && !phoneOk) {
      setGateError(true);
      return;
    }
    setBusy(true);
    const res = await onSend(payload, { name: data.name.trim(), phone: toE164(country, national) });
    setBusy(false);
    if (!res.ok) setSendError(res.error ?? "Не отправилось — попробуйте ещё раз");
  }

  async function sendText(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    // Номер ещё не введён — НЕ стираем поле (иначе сообщение терялось): показываем гейт и выходим,
    // черновик остаётся в поле и в localStorage.
    if (!exists && !phoneOk) {
      setGateError(true);
      return;
    }
    setInput("");
    fitTextarea("");
    await doSend({ type: "TEXT", text: t });
  }

  // Быстрый вопрос: диалог уже есть — отправляем сразу; нет — кладём в поле (сначала телефон).
  function quickQuestion(q: string) {
    if (exists || phoneOk) void sendText(q);
    else {
      setInput(q);
      setGateError(true);
    }
  }

  // Выбор фото: не отправляем сразу, а копим превью (как в Telegram — можно
  // добавить несколько, убрать лишние, подписать и отправить одним действием).
  function addPhotos(files: FileList) {
    if (!exists && !phoneOk) {
      setGateError(true);
      return;
    }
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setSendError("");
    setPhotos((prev) =>
      [...prev, ...imgs.map((f) => ({ file: f, url: URL.createObjectURL(f) }))].slice(0, 10),
    );
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const p = prev[idx];
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  // Отправка выбранных фото альбомом. Подпись (текст из поля) прикрепляем к
  // последнему фото — как делает Telegram для альбома.
  async function sendPhotos() {
    if (busy || photos.length === 0) return;
    if (!exists && !phoneOk) {
      setGateError(true);
      return;
    }
    const caption = input.trim();
    const contact = { name: data.name.trim(), phone: toE164(country, national) };
    setBusy(true);
    setSendError("");
    for (let i = 0; i < photos.length; i++) {
      const url = await onUpload(photos[i].file, photos[i].file.name);
      if (!url) {
        setBusy(false);
        setSendError("Не удалось загрузить фото");
        return;
      }
      const isLast = i === photos.length - 1;
      const res = await onSend(
        { type: "IMAGE", attachmentUrl: url, text: isLast && caption ? caption : undefined },
        contact,
      );
      if (!res.ok) {
        setBusy(false);
        setSendError(res.error ?? "Не отправилось — попробуйте ещё раз");
        return;
      }
    }
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setInput("");
    fitTextarea("");
    setBusy(false);
  }

  // ── Запись голосового: тап — начать, тап — отправить, корзина — отменить ──
  async function startRec() {
    if (rec) return;
    if (!exists && !phoneOk) {
      setGateError(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Chrome/Android — webm/opus; iOS Safari — mp4/aac. Берём первый поддерживаемый.
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", ""].find(
        (m) => m === "" || MediaRecorder.isTypeSupported(m),
      );
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recChunks.current = [];
      recCancelled.current = false;
      r.ondataavailable = (e) => e.data.size > 0 && recChunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        if (recTimer.current) clearInterval(recTimer.current);
        setRecTime(0);
        if (recCancelled.current || recChunks.current.length === 0) return;
        const type = r.mimeType.split(";")[0] || "audio/webm";
        const blob = new Blob(recChunks.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        setBusy(true);
        const url = await onUpload(blob, `voice.${ext}`);
        setBusy(false);
        if (!url) {
          setSendError("Не удалось отправить голосовое");
          return;
        }
        await doSend({ type: "VOICE", attachmentUrl: url });
      };
      r.start(250); // собираем куски каждые 250мс — запись не теряется при сбое
      setRec(r);
      setRecTime(0);
      recTimer.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch {
      setSendError("Нет доступа к микрофону");
    }
  }
  function stopRec(cancel: boolean) {
    recCancelled.current = cancel;
    rec?.stop();
  }

  // Автоувеличение поля ввода (до ~4 строк).
  function fitTextarea(value: string) {
    const ta = taRef.current;
    if (!ta) return;
    ta.value = value; // на случай программной очистки
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 112) + "px";
  }

  if (!render) return null;

  const headerName = staff?.name ?? "Sochifornia Travel";
  const greetingSub = online ? "обычно отвечаем за пару минут" : "офлайн · честно ответим утром";

  // Номер введён, диалог ещё не начат, поле пустое → показываем анимированную подсказку-плейсхолдер
  // «Напишите сообщение…» отдельным overlay-элементом (перелив цвета + умеренная вибрация, задача 1).
  const phVibrate = !exists && phoneOk && !input && photos.length === 0;

  return (
    <>
      {/* Затемнение (десктоп) — клик мимо окна закрывает */}
      <div
        className={cn(
          "fixed inset-0 z-[59] hidden bg-black/30 lg:block",
          closing ? "animate-chat-fade-out" : "animate-fade-in",
        )}
        onClick={onClose}
      />

      {/* Окно: мобильные — под шапкой во весь экран; десктоп — панель справа (~25%) */}
      <div
        className={cn(
          "fixed z-[60] flex flex-col overflow-hidden bg-bg shadow-float",
          // Открытие — снизу вверх; закрытие — зеркально вниз (задвигается за нижний край).
          closing ? "animate-chat-slide-down" : "animate-chat-slide-up",
          "inset-x-0 bottom-0",
          "lg:inset-auto lg:bottom-6 lg:right-6 lg:h-[min(700px,85vh)] lg:w-[clamp(360px,26vw,440px)] lg:rounded-2xl lg:border lg:border-hairline",
        )}
        style={{ top: gapTop }}
        data-lenis-prevent
      >
        {/* Фирменный градиентный фон окна */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/15 via-accent/5 to-bg" />

        {/* ── Шапка: аватар + имя сотрудника ── */}
        <div className="relative flex items-center gap-3 border-b border-hairline bg-surface/80 px-4 py-3 backdrop-blur">
          {staff?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={staff.avatar} alt={headerName} className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white">
              <Headset className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-bold text-ink">{headerName}</p>
            <p className={cn("truncate text-xs", online ? "text-muted" : "text-warning")}>{greetingSub}</p>
          </div>
          {tgLink && !tgLinked && exists && (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Продолжить в Telegram — ответы придут в мессенджер"
              className="rounded-full bg-[#229ED9]/10 px-3 py-1.5 text-xs font-semibold text-[#229ED9] active:scale-95"
            >
              В Telegram
            </a>
          )}
          <button
            type="button"
            aria-label="Закрыть чат"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ночью — честный баннер «ответим утром» */}
        {!online && (
          <div className="relative border-b border-warning/20 bg-warning/10 px-4 py-2 text-center text-[13px] font-medium text-warning">
            Сейчас нерабочее время — честно ответим утром ☀️ Мы на связи с 9:00 до 21:00
          </div>
        )}

        {/* Включение браузерных уведомлений (после первого сообщения) */}
        {canAskPush && exists && (
          <button
            type="button"
            onClick={onEnablePush}
            className="relative flex items-center justify-center gap-2 border-b border-hairline bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary active:opacity-70"
          >
            <Bell className="h-4 w-4" /> Включить уведомления об ответе
          </button>
        )}

        {/* ── Лента сообщений ── */}
        <div ref={listRef} onScroll={onListScroll} className="relative flex-1 space-y-2.5 overflow-y-auto px-4 py-4" data-lenis-prevent>
          {feed.map((item) =>
            item.kind === "day" ? (
              <DayDivider key={item.key} label={item.label} />
            ) : (
              <Bubble
                key={item.msg.id}
                msg={item.msg}
                readUpTo={readUpTo}
                tgLinked={tgLinked}
                onPickContact={onPickContact}
              />
            ),
          )}
          {staffTyping && <TypingBubble name={staffTyping.name} />}

          {/* Быстрые вопросы — пока диалог не начат */}
          {!exists && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => quickQuestion(q)}
                  className="rounded-full border border-primary/40 bg-surface px-3.5 py-2 text-left text-sm font-medium text-ink transition-colors active:scale-95 hover:border-primary hover:bg-primary/10"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Первое сообщение: имя (необязательно) + телефон (обязательно) ── */}
        {!exists && (
          <div className={cn("relative border-t border-hairline bg-surface/80 px-4 pb-2 pt-3 backdrop-blur", gateError && !phoneOk && "animate-subtle-shake")}>
            <div className="relative mb-2">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={data.name}
                // Каждое слово имени — с заглавной буквы.
                onChange={(e) => setLeadField("name", capWords(e.target.value))}
                placeholder="Ваше имя"
                className="h-11 w-full rounded-md border border-hairline bg-surface-2 pl-10 pr-24 text-[15px] text-ink shadow-inner outline-none placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
              />
              {/* «НЕ обязательно» — на 20% крупнее базового text-xs (0.75rem × 1.2 = 0.9rem), задача 6 */}
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.9rem] font-medium text-success">
                НЕ обязательно
              </span>
            </div>
            <PhoneInput
              country={country}
              national={national}
              valid={phoneOk}
              onCountryChange={setCountry}
              onNationalChange={setNational}
              // Список стран раскрывается вверх — поле у нижнего края окна чата (задача 7).
              dropUp
            />
            {/* Подпись под телефоном: +20% (0.9rem) и по центру; новый текст успеха (задача 6) */}
            <span className={cn("mt-1 block text-center text-[0.9rem] font-medium", phoneOk ? "text-success" : gateError ? "text-error" : "text-muted")}>
              {phoneOk ? "✓ Номера достаточно — пишите сообщение!" : "Номер телефона — обязательно"}
            </span>
          </div>
        )}

        {/* ── Поле ввода ── */}
        <div className="relative border-t border-hairline bg-surface/90 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur">
          {sendError && <p className="mb-1 text-center text-xs font-medium text-error">{sendError}</p>}

          {/* Строка выбранных фото: миниатюры с крестиком + кнопка «добавить ещё» */}
          {photos.length > 0 && !rec && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <div key={p.url} className="relative h-16 w-16 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <button
                    type="button"
                    aria-label="Убрать фото"
                    onClick={() => removePhoto(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow active:scale-90"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-label="Добавить ещё фото"
                onClick={() => fileRef.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-hairline text-muted active:scale-95"
              >
                <Camera className="h-6 w-6" />
              </button>
            </div>
          )}

          {rec ? (
            // Режим записи голосового
            <div className="flex items-center gap-3 py-1.5">
              <button type="button" aria-label="Отменить" onClick={() => stopRec(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-error active:scale-95">
                <Trash2 className="h-5 w-5" />
              </button>
              <span className="flex flex-1 items-center gap-2 text-[15px] font-medium text-ink">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
                Запись… {String(Math.floor(recTime / 60)).padStart(2, "0")}:{String(recTime % 60).padStart(2, "0")}
              </span>
              <button type="button" aria-label="Отправить голосовое" onClick={() => stopRec(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-white active:scale-95">
                <Square className="h-4 w-4 fill-current" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                aria-label="Прикрепить фото"
                onClick={() => fileRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors active:scale-95 hover:text-ink"
              >
                <Camera className="h-[22px] w-[22px]" />
              </button>
              <div className="relative flex-1">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    fitTextarea(e.target.value);
                    onTyping();
                  }}
                  onKeyDown={(e) => {
                    // Enter отправляет только на десктопе (точный указатель). На телефоне
                    // (сенсор) синяя кнопка-стрелка клавиатуры делает обычный перенос строки.
                    if (e.key === "Enter" && !e.shiftKey) {
                      const coarse =
                        typeof window !== "undefined" &&
                        window.matchMedia?.("(any-pointer: coarse)").matches;
                      if (!coarse) {
                        e.preventDefault();
                        void (photos.length > 0 ? sendPhotos() : sendText());
                      }
                    }
                  }}
                  // В режиме вибро-подсказки нативный плейсхолдер прячем — его рисует overlay ниже.
                  placeholder={phVibrate ? "" : photos.length > 0 ? "Добавьте подпись…" : "Напишите сообщение…"}
                  className="max-h-28 min-h-[44px] w-full resize-none overscroll-contain rounded-2xl border border-hairline bg-surface-2 px-4 py-2.5 text-[15.5px] leading-relaxed text-ink shadow-inner outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {/* Overlay-плейсхолдер: перелив цвета (muted↔зелёный) + сильная вибрация надписи (задача 1).
                    Настоящий ::placeholder нельзя двигать transform-ом, поэтому рисуем отдельным span. */}
                {phVibrate && (
                  <span
                    aria-hidden
                    className="animate-chat-ph-label pointer-events-none absolute left-4 top-2.5 origin-left whitespace-nowrap text-[15.5px] leading-relaxed"
                  >
                    Напишите сообщение…
                  </span>
                )}
              </div>
              {input.trim() || photos.length > 0 ? (
                <button
                  type="button"
                  aria-label="Отправить"
                  disabled={busy}
                  onClick={() => void (photos.length > 0 ? sendPhotos() : sendText())}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-card transition-transform active:scale-90"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Записать голосовое на ходу"
                  onClick={() => void startRec()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors active:scale-90 hover:bg-primary/20"
                >
                  <Mic className="h-[22px] w-[22px]" />
                </button>
              )}
            </div>
          )}
          {/* Акцент на голосовые: подсказка, пока диалог пуст */}
          {!exists && !rec && (
            <p className="mt-1 text-center text-[11px] text-muted">
              🎤 Удобнее говорить? Запишите голосовое на ходу — кнопка с микрофоном
            </p>
          )}
        </div>
      </div>
    </>
  );
}
