// Общая серверная логика онлайн-чата: рабочие часы, промокод, уведомления сотрудникам,
// доставка ответов клиенту (Telegram + Web Push), лёгкая защита от флуда.
import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { site } from "@/data/site";
import { tgSendMessage, tgSendPhoto, tgSendLocation, tgSendFileOrLink } from "@/lib/telegram";
import type { ChatConversation, ChatMessage, Prisma } from "@prisma/client";

// ── Константы поведения ──────────────────────────────────────
export const WORK_FROM = 9; // рабочие часы по Москве: 9:00–21:00 (site.workingHours)
export const WORK_TO = 21;
export const OFFLINE_AFTER_MS = 5 * 60 * 1000; // клиент «ушёл», если не поллит дольше 5 минут
export const WINDOW_CLOSED_AFTER_MS = 20 * 1000; // окно чата «закрыто», если open-поллинга нет 20с
export const PROMO_AFTER_MS = 10 * 60 * 1000; // промокод через 10 минут после вопроса без брони
export const TYPING_TTL_MS = 4500; // «печатает…» живёт 4.5с после последнего сигнала

// Лимиты защиты от флуда (лёгкая, по ТЗ).
export const MAX_TEXT_LEN = 2000;
export const FLOOD_MAX_PER_MIN = 12; // не больше 12 сообщений клиента в минуту
export const FLOOD_MIN_INTERVAL_MS = 700; // и не чаще ~1.4 сообщения в секунду

// Час в Москве (сервер может быть в любом поясе).
export function moscowHour(): number {
  return Number(
    new Intl.DateTimeFormat("ru-RU", { hour: "numeric", hour12: false, timeZone: "Europe/Moscow" })
      .format(new Date()),
  );
}

export function isWorkingHours(): boolean {
  const h = moscowHour();
  return h >= WORK_FROM && h < WORK_TO;
}

// ── Флуд-контроль ────────────────────────────────────────────
// Считаем по БД (надёжно в serverless): сообщения клиента за последнюю минуту.
export async function checkFlood(conversationId: string): Promise<string | null> {
  const minuteAgo = new Date(Date.now() - 60_000);
  const recent = await prisma.chatMessage.findMany({
    where: { conversationId, sender: "CLIENT", createdAt: { gt: minuteAgo } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    take: FLOOD_MAX_PER_MIN + 1,
  });
  if (recent.length >= FLOOD_MAX_PER_MIN) return "Слишком много сообщений. Подождите минуту.";
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < FLOOD_MIN_INTERVAL_MS)
    return "Слишком быстро. Секундочку…";
  return null;
}

// ── Промокод ─────────────────────────────────────────────────
export function genPromoCode(): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // без похожих символов
  let tail = "";
  for (let i = 0; i < 4; i++) tail += abc[Math.floor(Math.random() * abc.length)];
  return `SOCHI5-${tail}`;
}

// Проверка «пора ли отправить промокод»: клиент задал вопрос ≥10 минут назад, промо ещё не было.
// Вызывается из поллинга (и клиентского, и админского).
export async function maybeSendPromo(conv: ChatConversation): Promise<ChatMessage | null> {
  if (conv.promoSentAt) return null;
  const firstClientMsg = await prisma.chatMessage.findFirst({
    where: { conversationId: conv.id, sender: "CLIENT" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (!firstClientMsg) return null;
  if (Date.now() - firstClientMsg.createdAt.getTime() < PROMO_AFTER_MS) return null;

  const code = genPromoCode();
  const [msg] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        sender: "BOT",
        type: "PROMO",
        text: code,
      },
    }),
    prisma.chatConversation.update({
      where: { id: conv.id },
      data: { promoCode: code, promoSentAt: new Date() },
    }),
  ]);
  // Если клиент подключил Telegram и ушёл — промо тоже доставим туда.
  await deliverToClientIfAway(conv, msg);
  return msg;
}

// ── Уведомление сотрудников в Telegram о новом сообщении клиента ──
export async function notifyStaff(conv: ChatConversation, msg: ChatMessage) {
  const staff = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  if (staff.length === 0) return;

  const tour = conv.currentTourSlug
    ? await prisma.tour.findUnique({ where: { slug: conv.currentTourSlug }, select: { title: true } })
    : null;

  const who = conv.clientName || "Гость";
  const phone = conv.clientPhone ? ` (${conv.clientPhone})` : "";
  const preview =
    msg.type === "TEXT" ? msg.text.slice(0, 200)
    : msg.type === "IMAGE" ? "📷 Фото"
    : msg.type === "VOICE" ? "🎤 Голосовое сообщение"
    : "Сообщение";
  const context = tour ? `\n🎯 Смотрит: «${tour.title}»` : "";
  const text =
    `💬 <b>${esc(who)}</b>${esc(phone)}${context}\n` +
    `${esc(preview)}\n\n` +
    `Ответить: ${site.url}/admin/chats`;

  await Promise.all(staff.map((s) => tgSendMessage(s.telegramChatId as string, text)));
}

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// ── Доставка ответа сотрудника/бота клиенту, когда его нет на сайте ──
// Правило (по ТЗ): ответ ждёт возвращения на сайте; если клиента нет >5 минут и он
// подключил Telegram — дублируем ответ туда. Web Push шлём, когда окно чата закрыто.
export async function deliverToClientIfAway(conv: ChatConversation, msg: ChatMessage) {
  const away = Date.now() - conv.lastClientSeenAt.getTime() > OFFLINE_AFTER_MS;

  // Telegram — только если клиент давно не появлялся и подключил бота.
  if (away && conv.clientTelegramId) {
    const id = conv.clientTelegramId;
    try {
      if (msg.type === "IMAGE" && msg.attachmentUrl) {
        await tgSendPhoto(id, absUrl(msg.attachmentUrl), msg.text || undefined);
      } else if (msg.type === "LOCATION" && msg.meta) {
        const m = msg.meta as { lat?: number; lng?: number; label?: string };
        if (m.label) await tgSendMessage(id, `📍 ${esc(m.label)}`);
        if (typeof m.lat === "number" && typeof m.lng === "number")
          await tgSendLocation(id, m.lat, m.lng);
      } else if (msg.type === "VOICE" && msg.attachmentUrl) {
        await tgSendFileOrLink(id, absUrl(msg.attachmentUrl), "🎤 Голосовое сообщение от Sochifornia");
      } else if (msg.type === "TOUR_CARD" && msg.meta) {
        const m = msg.meta as { slug?: string; title?: string; price?: number };
        await tgSendMessage(
          id,
          `🌴 <b>${esc(m.title || "Экскурсия")}</b>${m.price ? ` — от ${m.price} ₽` : ""}\n${site.url}/tours/${m.slug}`,
        );
      } else if (msg.type === "PROMO") {
        await tgSendMessage(
          id,
          `🎁 Ваш промокод на скидку 5%: <b>${esc(msg.text)}</b>\nНазовите его менеджеру при бронировании. Действует 24 часа.`,
        );
      } else if (msg.text) {
        await tgSendMessage(id, esc(msg.text));
      }
    } catch {
      /* Telegram недоступен — сообщение всё равно ждёт на сайте */
    }
  }

  // Web Push — когда окно чата закрыто (клиент на сайте с закрытым чатом или ушёл).
  const windowClosed =
    !conv.lastOpenAt || Date.now() - conv.lastOpenAt.getTime() > WINDOW_CLOSED_AFTER_MS;
  if (windowClosed) await sendPushToConversation(conv.id, msg);
}

function absUrl(url: string): string {
  return url.startsWith("http") ? url : `${site.url}${url}`;
}

// ── Web Push (VAPID, бесплатно, свой код) ────────────────────
let vapidReady = false;
function initVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(`mailto:${site.email}`, pub, priv);
    vapidReady = true;
  }
  return true;
}

export async function sendPushToConversation(conversationId: string, msg: ChatMessage) {
  if (!initVapid()) return;
  const subs = await prisma.chatPushSub.findMany({ where: { conversationId } });
  if (subs.length === 0) return;

  const body =
    msg.type === "TEXT" || msg.type === "SYSTEM" ? msg.text.slice(0, 120)
    : msg.type === "IMAGE" ? "📷 Фото"
    : msg.type === "VOICE" ? "🎤 Голосовое сообщение"
    : msg.type === "TOUR_CARD" ? "🌴 Подобрали экскурсию для вас"
    : msg.type === "LOCATION" ? "📍 Место встречи"
    : msg.type === "PROMO" ? "🎁 Вам промокод на скидку 5%!"
    : "Новое сообщение";

  const payload = JSON.stringify({
    title: "Sochifornia — новый ответ",
    body,
    url: `${site.url}?chat=open`,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (e) {
        // 404/410 — подписка умерла, чистим.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410)
          await prisma.chatPushSub.delete({ where: { id: s.id } }).catch(() => {});
      }
    }),
  );
}

// ── Утилиты диалога ──────────────────────────────────────────
// Данные сотрудника для показа клиенту (имя/аватар в шапке и у пузыря).
export const staffAuthorSelect = {
  select: { id: true, chatDisplayName: true, chatAvatarUrl: true, name: true },
} satisfies Prisma.ChatMessage$authorArgs;

export type WireMessage = {
  id: string;
  sender: "CLIENT" | "STAFF" | "BOT";
  type: string;
  text: string;
  attachmentUrl: string;
  meta: unknown;
  createdAt: string;
  readByStaff: boolean;
  readByClient: boolean;
  author: { name: string; avatar: string } | null;
};

export function toWire(m: ChatMessage & { author?: { chatDisplayName: string; chatAvatarUrl: string; name: string | null } | null }): WireMessage {
  return {
    id: m.id,
    sender: m.sender,
    type: m.type,
    text: m.text,
    attachmentUrl: m.attachmentUrl,
    meta: m.meta ?? null,
    createdAt: m.createdAt.toISOString(),
    readByStaff: m.readByStaff,
    readByClient: m.readByClient,
    author: m.author
      ? { name: m.author.chatDisplayName || m.author.name || "Sochifornia", avatar: m.author.chatAvatarUrl }
      : null,
  };
}

// Валидация анонимного ID клиента из localStorage.
export function validClientId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}
