"use client";

// Пузыри сообщений чата: iMessage-стиль с «хвостиком», spring-появление.
// Клиент — фирменный оранжевый, сотрудник — сине-голубой, бот — нейтральный.
import { useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, Clock3, Copy, MapPin, Phone, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMsg } from "@/components/chat/use-chat";

// ── Время и группировка по дням ──────────────────────────────
export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Сегодня";
  if (same(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// Разделитель дня («Сегодня» / «Вчера» / «5 июля»).
export function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-surface-2/80 px-3 py-1 text-xs font-medium text-muted">{label}</span>
    </div>
  );
}

// Галочки статуса для сообщений клиента: часики → ✓ доставлено → ✓✓ прочитано.
function Ticks({ msg, readUpTo }: { msg: ChatMsg; readUpTo: string | null }) {
  if (msg.pending) return <Clock3 className="h-3.5 w-3.5 opacity-70" />;
  if (msg.failed) return <span className="text-[10px] font-semibold">не отправлено</span>;
  const read = readUpTo !== null && msg.createdAt <= readUpTo;
  return read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 opacity-70" />;
}

// ── Один пузырь ──────────────────────────────────────────────
export function Bubble({
  msg,
  readUpTo,
  tgLinked,
}: {
  msg: ChatMsg;
  readUpTo: string | null;
  tgLinked: boolean;
}) {
  const mine = msg.sender === "CLIENT";
  const staffish = msg.sender === "STAFF";

  // Служебные типы рендерятся отдельными карточками по центру/слева.
  if (msg.type === "SYSTEM") {
    return <AbsenceCard msg={msg} tgLinked={tgLinked} />;
  }
  if (msg.type === "PROMO") return <PromoCard msg={msg} />;
  if (msg.type === "TOUR_CARD") return <TourCard msg={msg} />;

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          // drop-shadow вместо shadow-sm: тень по силуэту вместе с хвостиком, а не по прямоугольнику.
          "chat-pop relative max-w-[82%] px-4 py-2.5 text-[15.5px] leading-relaxed drop-shadow-sm",
          // «Капли» iMessage: скругление умеренное, «хвостик» — острый нижний угол со своей стороны.
          mine
            ? "chat-tail-right rounded-2xl rounded-br-[6px] bg-gradient-to-br from-orange-500 to-amber-500 text-white"
            : staffish
              ? "chat-tail-left rounded-2xl rounded-bl-[6px] bg-gradient-to-br from-sky-500 to-cyan-500 text-white"
              : "chat-tail-left chat-tail-bordered rounded-2xl rounded-bl-[6px] border border-hairline bg-surface-2 text-ink",
          msg.failed && "opacity-60",
        )}
      >
        {/* Имя сотрудника над его пузырём (аватар показан в шапке) */}
        {staffish && msg.author && (
          <span className="mb-0.5 block text-xs font-semibold text-white/85">{msg.author.name}</span>
        )}

        {msg.type === "IMAGE" && msg.attachmentUrl && (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.attachmentUrl}
              alt="Фото"
              className="mb-1 max-h-64 w-full rounded-lg object-cover"
              loading="lazy"
            />
          </a>
        )}

        {msg.type === "VOICE" && msg.attachmentUrl && (
          <audio controls preload="none" src={msg.attachmentUrl} className="my-1 h-10 w-56 max-w-full" />
        )}

        {msg.type === "LOCATION" && <LocationBody msg={msg} mine={mine} />}

        {msg.text && <span className="whitespace-pre-wrap break-words">{msg.text}</span>}

        {/* Время + статус в правом нижнем углу пузыря */}
        <span
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[10.5px]",
            mine || staffish ? "text-white/75" : "text-muted",
          )}
        >
          {timeOf(msg.createdAt)}
          {mine && <Ticks msg={msg} readUpTo={readUpTo} />}
        </span>
      </div>
    </div>
  );
}

// ── Локация: мини-карта OpenStreetMap + ссылка на Яндекс.Карты ──
function LocationBody({ msg, mine }: { msg: ChatMsg; mine: boolean }) {
  const m = (msg.meta ?? {}) as { lat?: number; lng?: number; label?: string };
  if (typeof m.lat !== "number" || typeof m.lng !== "number") return null;
  const d = 0.004; // размер видимой области
  const bbox = `${m.lng - d},${m.lat - d},${m.lng + d},${m.lat + d}`;
  return (
    <div className="mb-1 w-64 max-w-full">
      {m.label && (
        <span className={cn("mb-1 flex items-center gap-1 text-sm font-semibold", mine ? "text-white" : "")}>
          <MapPin className="h-4 w-4 shrink-0" /> {m.label}
        </span>
      )}
      <iframe
        title="Место встречи"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${m.lat},${m.lng}`}
        className="h-36 w-full rounded-lg border-0"
        loading="lazy"
      />
      <a
        href={`https://yandex.ru/maps/?pt=${m.lng},${m.lat}&z=16&l=map`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("mt-1 inline-block text-xs font-medium underline", mine ? "text-white/90" : "text-primary")}
      >
        Открыть в Яндекс.Картах
      </a>
    </div>
  );
}

// ── Карточка экскурсии с кнопкой «Забронировать» ──
function TourCard({ msg }: { msg: ChatMsg }) {
  const m = (msg.meta ?? {}) as { slug?: string; title?: string; price?: number; image?: string; duration?: number };
  const img = m.image && (m.image.startsWith("http") || m.image.startsWith("/")) ? m.image : null;
  return (
    <div className="flex w-full justify-start">
      <div className="chat-pop w-72 max-w-[86%] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={m.title ?? ""} className="h-32 w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-24 w-full bg-gradient-to-br from-sky-400 via-cyan-400 to-teal-400" />
        )}
        <div className="p-3">
          <p className="font-display text-[15px] font-bold leading-snug text-ink">{m.title}</p>
          <p className="mt-1 text-sm text-muted">
            {m.price ? <>от <span className="font-semibold text-ink">{m.price.toLocaleString("ru-RU")} ₽</span>/чел</> : null}
            {m.duration ? <> · {m.duration} ч</> : null}
          </p>
          <Link
            href={`/tours/${m.slug}#tour-lead-form`}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-fg active:scale-95"
          >
            Забронировать <Send className="h-3.5 w-3.5" />
          </Link>
          <span className="mt-1.5 block text-right text-[10.5px] text-muted">{timeOf(msg.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Промокод −5% ──
function PromoCard({ msg }: { msg: ChatMsg }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="flex w-full justify-start">
      <div className="chat-pop w-72 max-w-[86%] rounded-2xl border-2 border-dashed border-gold/70 bg-gold/10 p-3.5">
        <p className="text-sm font-semibold text-ink">🎁 Вам скидка 5% на первую экскурсию!</p>
        <button
          type="button"
          onClick={copy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-surface py-2.5 font-mono text-lg font-bold tracking-wider text-ink active:scale-95"
        >
          {msg.text} <Copy className="h-4 w-4 text-muted" />
        </button>
        <p className="mt-2 text-xs leading-relaxed text-body">
          {copied ? "Скопировано! " : ""}Назовите код менеджеру при бронировании. Действует 24 часа.
        </p>
        <span className="mt-1 block text-right text-[10.5px] text-muted">{timeOf(msg.createdAt)}</span>
      </div>
    </div>
  );
}

// ── Иконки мессенджеров (только логотипы, фирменные цвета) ──
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 012.89 6.99c0 5.45-4.43 9.89-9.88 9.89" />
    </svg>
  );
}
function MaxIcon({ className }: { className?: string }) {
  // Официальный логотип мессенджера MAX (фирменная градиентная плитка).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/max-logo.png" alt="" className={cn(className, "rounded-[7px]")} />;
}

// Каналы связи: только иконки, разноцветные (телефон — оранжевый).
const CONTACT_CHANNELS = [
  { key: "phone", label: "По телефону", color: "#F97316", Icon: Phone },
  { key: "tg", label: "Telegram", color: "#229ED9", Icon: TelegramIcon },
  { key: "wa", label: "WhatsApp", color: "#25D366", Icon: WhatsAppIcon },
  { key: "max", label: "Max", color: "#5B6BF5", Icon: MaxIcon },
] as const;

const PICK_GREEN = "#22E34A"; // ярко-зелёный для обводки и галочки

// ── Системный вопрос «где удобнее связаться?» — иконки каналов связи ──
function AbsenceCard({
  msg, tgLinked,
}: {
  msg: ChatMsg;
  tgLinked: boolean;
}) {
  // Выбрать можно только один канал (телефон уже указан заранее — нужно лишь выбрать иконку).
  // Если Telegram уже подключён — считаем его выбранным сразу.
  const [picked, setPicked] = useState<string | null>(tgLinked ? "tg" : null);

  function choose(ch: (typeof CONTACT_CHANNELS)[number]) {
    setPicked(ch.key); // выбор не снимается повторным нажатием
  }

  return (
    <div className="flex w-full justify-start">
      <div className="chat-pop max-w-[86%] rounded-2xl border border-hairline bg-surface-2 p-3.5">
        <p className="text-sm leading-relaxed text-body">{msg.text}</p>

        {/* Иконки каналов — в одну строку на всю ширину пузыря (от края до края) */}
        <div className="mt-3 flex items-center justify-between">
          {CONTACT_CHANNELS.map((ch) => {
            const { key, label, color, Icon } = ch;
            const on = picked === key;
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={on}
                onClick={() => choose(ch)}
                // Пока ничего не выбрано — обычный размер; после выбора выбранная
                // плавно растёт на 10%, остальные плавно уменьшаются на 10%.
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900",
                  "transition-transform duration-300 ease-out active:scale-95",
                  picked !== null && (on ? "scale-110" : "scale-90"),
                )}
              >
                {/* Иконка (при выборе затемняется на 50%).
                   Telegram и WhatsApp крупнее на 35% (26px → 35px). */}
                <span
                  className={cn("transition-opacity", on && "opacity-50")}
                  style={{
                    color,
                    transform:
                      key === "tg"
                        ? "translate(-1px, 1px)"
                        : key === "wa"
                          ? "translate(-0.6px, 0.6px)"
                          : undefined,
                  }}
                >
                  <Icon
                    className={cn(
                      key === "tg" || key === "wa" ? "h-[35px] w-[35px]" : "h-[26px] w-[26px]",
                    )}
                  />
                </span>

                {/* Зелёная обводка: моргает, пока не выбрана; сплошная — когда выбрана */}
                <span
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-full",
                    on ? "opacity-100" : "absence-blink",
                  )}
                  style={{ boxShadow: `0 0 0 3px ${PICK_GREEN}` }}
                />

                {/* Выбор: крупная жирная зелёная галка с тёмным контуром —
                   заметна поверх иконки без белой подложки. */}
                {on && (
                  <Check
                    className="pointer-events-none absolute h-9 w-9"
                    strokeWidth={4}
                    style={{
                      color: PICK_GREEN,
                      filter:
                        "drop-shadow(0 0 1px rgba(0,0,0,0.95)) drop-shadow(0 0 1px rgba(0,0,0,0.95)) drop-shadow(0 1px 2px rgba(0,0,0,0.55))",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <span className="mt-2 block text-right text-[10.5px] text-muted">{timeOf(msg.createdAt)}</span>
      </div>
    </div>
  );
}

// ── «Печатает…» — три прыгающие точки в пузыре ──
export function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex w-full justify-start">
      <div className="chat-pop chat-tail-left rounded-2xl rounded-bl-[6px] bg-gradient-to-br from-sky-500 to-cyan-500 px-4 py-3 drop-shadow-sm">
        <span className="sr-only">{name} печатает…</span>
        <span className="flex items-center gap-1">
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" style={{ animationDelay: "0.15s" }} />
          <span className="chat-typing-dot" style={{ animationDelay: "0.3s" }} />
        </span>
      </div>
    </div>
  );
}
