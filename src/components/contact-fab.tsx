"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Headset } from "lucide-react";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";
import { BOOKINGBAR_EVENT } from "@/components/sticky-booking-bar";
import { CHAT_UNREAD_EVENT, openChat } from "@/components/chat/chat-store";

// Плавающий кластер способов связи (только мобильные) [[mobile-nav]].
//
// Пилюля «Чат с оператором» видна ВСЕГДА (оранжевая, крайняя справа). По требованию (п.2) тап по
// ней НЕ управляет рядом мессенджеров. Левее неё:
//   • СВЁРНУТО — одна круглая кнопка-циклер: каждые 2с сменяет мессенджер WhatsApp → Telegram →
//     MAX (новая иконка «прилетает», крутясь — cb-fab-swap). Она видна всегда, пока ряд свёрнут.
//   • РАСКРЫТО (только тап по свёрнутому циклеру, п.2) — циклер прячется, а вместо него выезжают
//     ВЛЕВО три отдельные кнопки: WhatsApp, Telegram, MAX.
// Ряд принудительно сворачивается, как только синяя плашка задвигается вниз (п.1).
//
// Пока ряд раскрыт, любая прокрутка страницы заставляет иконки легонько подпрыгивать на месте
// (п.2, анимация cb-fab-bounce со стаггером).

// Фирменные SVG-иконки — те же, что в [[contacts]] (contacts/page.tsx).
const WhatsAppIcon = (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#fff" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411z" />
  </svg>
);

const TelegramIcon = (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#fff" aria-hidden="true" style={{ transform: "translateX(-3px)" }}>
    <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931l3.622-16.972.001-.001c.321-1.496-.541-2.081-1.527-1.714L2.334 10.163c-1.453.564-1.431 1.374-.247 1.741l5.443 1.693 12.643-7.911c.595-.394 1.136-.176.691.218z" />
  </svg>
);

// Официальный логотип мессенджера MAX (фирменная градиентная плитка).
const MaxIcon = (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/max-logo.png" alt="" className="h-8 w-8 rounded-[8px]" />
);

type Channel = { key: string; label: string; href: string; wrap: string; icon: ReactNode };

// Набор для раскрытого ряда. Порядок в массиве + flex-row-reverse дают визуальный порядок
// слева-направо: MAX, Telegram, WhatsApp (WhatsApp — ближе всех к «Чату»).
const CHANNELS: Channel[] = [
  { key: "whatsapp", label: "Написать в WhatsApp", href: site.whatsapp, wrap: "bg-[#25D366] text-white", icon: WhatsAppIcon },
  { key: "telegram", label: "Написать в Telegram", href: site.telegram, wrap: "bg-[#229ED9] text-white", icon: TelegramIcon },
  { key: "max", label: "Написать в MAX", href: site.max, wrap: "bg-white ring-1 ring-hairline", icon: MaxIcon },
];

// В свёрнутом виде по кругу циклятся все мессенджеры: WhatsApp / Telegram / MAX.
const CYCLE = CHANNELS;

// База круглой кнопки-иконки.
const dotClass = "flex h-12 w-12 items-center justify-center rounded-full shadow-float";

export function ContactFab({
  phoneVisible,
  callbackOpen,
  collapsedBottom = 80,
  onExpand,
  contextAvailable = true,
}: {
  phoneVisible: boolean;
  callbackOpen: boolean;
  collapsedBottom?: number; // нижнее положение кластера (px от низа): центр по кнопке «Перезвоните мне»
  onExpand?: () => void; // вызывается при раскрытии — родитель выдвигает синюю подложку (п.2)
  contextAvailable?: boolean; // есть ли на странице синяя плашка (главная/каталог); в «Контактах» и пр. — нет
}) {
  const [expanded, setExpanded] = useState(false);
  const [i, setI] = useState(0); // индекс текущего мессенджера в свёрнутой циклер-кнопке
  const [chatUnread, setChatUnread] = useState(0); // бейдж непрочитанных на кнопке «Чат»

  // Бейдж с числом непрочитанных сообщений чата (шлёт [[chat-widget]]).
  useEffect(() => {
    const onUnread = (e: Event) => setChatUnread((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener(CHAT_UNREAD_EVENT, onUnread);
    return () => window.removeEventListener(CHAT_UNREAD_EVENT, onUnread);
  }, []);
  const [bounceTick, setBounceTick] = useState(0); // счётчик прыжков — растёт при прокрутке (п.2)
  // Нижнее положение (px), когда снизу показан бар бронирования [[sticky-booking-bar]]: кластер
  // поднимается над ним. null — бар скрыт, используем обычное положение. (п.1)
  const [barBottom, setBarBottom] = useState<number | null>(null);

  // Слушаем показ/скрытие бара бронирования на странице тура. Целевую высоту считаем от самого бара:
  // его computed `bottom` (63px + safe-area, не зависит от transform) + высота + зазор 12px.
  useEffect(() => {
    const onBar = (e: Event) => {
      const visible = (e as CustomEvent<boolean>).detail;
      const bar = document.getElementById("tour-bookingbar");
      if (!visible || !bar) {
        setBarBottom(null);
        return;
      }
      const base = parseFloat(getComputedStyle(bar).bottom) || 0;
      setBarBottom(base + bar.offsetHeight + 12);
    };
    window.addEventListener(BOOKINGBAR_EVENT, onBar);
    return () => window.removeEventListener(BOOKINGBAR_EVENT, onBar);
  }, []);

  // Циклическая смена иконки каждые 2с — только пока ряд свёрнут и панель обратного звонка закрыта.
  useEffect(() => {
    if (expanded || callbackOpen) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % CYCLE.length), 2000);
    return () => window.clearInterval(t);
  }, [expanded, callbackOpen]);

  // Отложенное раскрытие: тап по циклеру при СКРЫТОЙ подложке сначала выдвигает её, и только
  // после выезда циклер раскрывается сам (см. эффект ниже).
  const [pendingExpand, setPendingExpand] = useState(false);

  // Раскрытие ряда мессенджеров — ТОЛЬКО по тапу на свёрнутый циклер (п.2). Кнопка «Чат» больше
  // не переключает ряд. В разделах БЕЗ синей плашки (contextAvailable=false, например «Контакты»)
  // раскрываемся сразу — ждать выезда нечего. Иначе: подложка уже выдвинута — раскрываемся сразу;
  // ещё нет — просим родителя выдвинуть её (onExpand → pinned), а раскрытие откладываем до конца
  // её выезда (п.3): подложка выезжает, затем циклер разворачивается автоматически.
  const expand = () => {
    if (!contextAvailable) {
      setExpanded(true);
      return;
    }
    onExpand?.();
    if (phoneVisible) setExpanded(true);
    else setPendingExpand(true);
  };

  // Ждём, пока подложка реально выдвинется (phoneVisible → true), затем даём её анимации выезда
  // (300ms) завершиться — и раскрываем ряд мессенджеров.
  useEffect(() => {
    if (!pendingExpand || !phoneVisible) return;
    const t = setTimeout(() => {
      setExpanded(true);
      setPendingExpand(false);
    }, 300);
    return () => clearTimeout(t);
  }, [pendingExpand, phoneVisible]);

  // Строгое правило (п.1): как только синяя плашка задвигается вниз (phoneVisible === false),
  // ряд мессенджеров обязательно сворачивается, а отложенное раскрытие отменяется.
  useEffect(() => {
    if (!phoneVisible) {
      setExpanded(false);
      setPendingExpand(false);
    }
  }, [phoneVisible]);

  // Смена типа раздела (синяя плашка появилась/пропала, например «Контакты» ↔ главная) — начинаем
  // со свёрнутого состояния, как и родитель, сбрасывающий pinned при смене пути. Иначе ряд,
  // раскрытый в «Контактах», оставался бы раскрытым на главной при задвинутой плашке.
  useEffect(() => {
    setExpanded(false);
    setPendingExpand(false);
  }, [contextAvailable]);

  // Пока ряд раскрыт — прокрутка страницы вызывает «подпрыгивание» иконок, но НЕ сразу, а спустя
  // случайные 2–4с (п.2): то 2, то 4, то 3 — каждый раз по-разному. Пока прыжок запланирован,
  // новые прокрутки его не плодят; после срабатывания следующая прокрутка планирует новый.
  useEffect(() => {
    if (!expanded) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) return;
      const delay = 2000 + Math.random() * 2000; // 2000..4000 мс
      timer = setTimeout(() => {
        setBounceTick((t) => t + 1);
        timer = null;
      }, delay);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [expanded]);

  const cur = CYCLE[i];

  return (
    <>
      {/* Кластер прижат к правому краю; пилюля «Чат» всегда справа, слева — циклер (свёрнуто)
          либо ряд мессенджеров (раскрыто). id — чтобы [[mobile-nav]] замерил его и выровнял
          «Перезвоните мне» по одной вертикали и с равным зазором (п.1/п.3). */}
      <div
        id="contact-fab-cluster"
        // Нижнее положение (подложка скрыта) — collapsedBottom: замеряется в [[mobile-nav]] так,
        // чтобы центр кластера совпал с центром кнопки «Перезвоните мне». При видимой подложке
        // уезжает выше (140px), чтобы её не перекрывать. На desktop — lg:!bottom-6 (перебивает inline).
        style={{ bottom: barBottom ?? (phoneVisible ? 140 : collapsedBottom) }}
        className={cn(
          "fixed right-4 z-40 transition-all duration-300 lg:!bottom-6",
          callbackOpen && "pointer-events-none opacity-0"
        )}
      >
        <div className="flex flex-row-reverse items-center">
          {/* «Чат с оператором» — всегда видна, крайняя справа. Непрозрачный оранжево-коралловый
              цвет — единственный тёплый акцент среди холодных мессенджеров. По требованию (п.2)
              тап по ней НЕ разворачивает и НЕ сворачивает ряд мессенджеров. */}
          <button
            type="button"
            aria-label="Чат с оператором"
            onClick={openChat}
            // Привлечение внимания: лёгкое покачивание раз в 13с, затем лёгкий пульс — циклом.
            className="animate-chat-attn relative flex h-12 items-center gap-1.5 rounded-2xl bg-orange-500 px-3.5 text-white shadow-float ring-2 ring-white/50 active:scale-95"
          >
            <Headset className="h-5 w-5" />
            <span className="text-sm font-semibold">Чат</span>
            {/* Бейдж непрочитанных ответов */}
            {chatUnread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-white ring-2 ring-white">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </button>

          {/* Раскрытый ряд из трёх кнопок. Свёрнут — схлопывается вправо под пилюлю «Чат»
              (max-w-0), раскрыт — выезжает влево. pr-3 даёт зазор между рядом и пилюлей
              (обрезается при сворачивании через overflow-hidden). */}
          <div
            className={cn(
              "flex flex-row-reverse items-center gap-3 overflow-hidden transition-all duration-300 ease-out",
              expanded ? "max-w-[280px] pr-3 opacity-100" : "pointer-events-none max-w-0 pr-0 opacity-0"
            )}
          >
            {CHANNELS.map((c, idx) => {
              const ext = c.href.startsWith("http");
              return (
                <a
                  key={c.key}
                  href={c.href}
                  target={ext ? "_blank" : undefined}
                  rel={ext ? "noopener noreferrer" : undefined}
                  aria-label={c.label}
                  className={cn(dotClass, c.wrap, "shrink-0 active:scale-95")}
                >
                  {/* Внутренний span перерисовывается по key={bounceTick}: каждая прокрутка
                      заново проигрывает «подпрыгивание» со стаггером по idx (п.2). */}
                  <span
                    key={bounceTick}
                    className={cn("flex items-center justify-center", bounceTick > 0 && "animate-cb-fab-bounce")}
                    style={{ animationDelay: `${idx * 70}ms` }}
                  >
                    {c.icon}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Свёрнутая циклер-кнопка — видна всегда, пока ряд не раскрыт (п.1). Иконка внутри
              перерисовывается по key={i} → каждая смена заново проигрывает cb-fab-swap. При
              раскрытии схлопывается (max-w-0), уступая место ряду из трёх кнопок. */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out",
              expanded ? "pointer-events-none max-w-0 pr-0 opacity-0" : "max-w-[64px] pr-3 opacity-100"
            )}
          >
            <button
              type="button"
              onClick={expand}
              aria-label="Способы связи"
              className={cn(dotClass, cur.wrap, "shrink-0 active:scale-95")}
            >
              <span key={i} className="animate-cb-fab-swap flex items-center justify-center">
                {cur.icon}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
