"use client";

// Виджет чата: живёт в layout на всех страницах. Управляет окном, бейджем,
// звуком/вибрацией, push-подписками, роботом-инициатором и контекстом экскурсии.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatWindow } from "@/components/chat/chat-window";
import { useChat, type ChatMsg, type TourCtx } from "@/components/chat/use-chat";
import {
  CHAT_OPEN_EVENT, CHAT_UNREAD_EVENT, getClientId, getViews, hasConversation,
  markNudged, recordTourView, siteEnteredAt, wasNudged,
} from "@/components/chat/chat-store";
import { playPing, unlockAudio, vibrate } from "@/components/chat/chat-sounds";

const NUDGE_VIEWS = 3; // робот предлагает помощь после 3 просмотренных экскурсий…
const NUDGE_TIME_MS = 2 * 60_000; // …или после 2 минут на сайте

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tourCtx, setTourCtx] = useState<TourCtx>(null);
  const [localMsgs, setLocalMsgs] = useState<ChatMsg[]>([]);
  const [localUnread, setLocalUnread] = useState(0);
  const [canAskPush, setCanAskPush] = useState(false);

  const chat = useChat(open, tourCtx);
  const openRef = useRef(open);
  openRef.current = open;

  // ── Контекст страницы тура: приветствие + запись просмотра ──
  useEffect(() => {
    const m = pathname.match(/^\/tours\/([^/]+)$/);
    if (!m) {
      setTourCtx(null);
      return;
    }
    const slug = decodeURIComponent(m[1]);
    // Название берём из document.title («Название — Sochifornia Travel») после отрисовки.
    const t = setTimeout(() => {
      const title = document.title.split(" — ")[0].trim() || slug;
      setTourCtx({ slug, title });
      recordTourView(slug, title);
    }, 600);
    return () => clearTimeout(t);
  }, [pathname]);

  // ── Открытие по событию (кнопка «Чат») и по ?chat=open (из push-уведомления) ──
  useEffect(() => {
    const onOpen = (e: Event) => {
      const want = (e as CustomEvent<boolean>).detail !== false;
      setOpen(want);
      if (want) unlockAudio();
    };
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    if (new URLSearchParams(window.location.search).get("chat") === "open") setOpen(true);
    // Первый клик где угодно «разблокирует» звук для будущих уведомлений.
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  // Окно открылось → локальный бейдж погашен.
  useEffect(() => {
    if (open) setLocalUnread(0);
  }, [open]);

  // ── Приветствие (зависит от страницы) — только пока диалог не создан ──
  useEffect(() => {
    if (chat.exists || hasConversation()) {
      setLocalMsgs((prev) => prev.filter((m) => m.id !== "local-greet"));
      return;
    }
    const text = tourCtx
      ? `Здравствуйте! Интересует «${tourCtx.title}»? Спрашивайте — подскажем по программе, датам и месту встречи 🌴`
      : "Здравствуйте! Мы на связи — подскажем с выбором экскурсии, датами и ценами 🌴";
    setLocalMsgs((prev) => [
      { ...greet(text), createdAt: prev.find((m) => m.id === "local-greet")?.createdAt ?? new Date().toISOString() },
      ...prev.filter((m) => m.id !== "local-greet"),
    ]);
  }, [tourCtx, chat.exists]);

  // ── Робот-инициатор: 3 просмотренных тура ИЛИ 2 минуты на сайте ──
  useEffect(() => {
    if (wasNudged() || hasConversation()) return;
    const check = () => {
      if (wasNudged() || hasConversation() || openRef.current) return;
      const enough = getViews().length >= NUDGE_VIEWS || Date.now() - siteEnteredAt() > NUDGE_TIME_MS;
      if (!enough) return;
      markNudged();
      setLocalMsgs((prev) => [
        ...prev,
        {
          ...greet("Вижу, вы присматриваете экскурсию 😊 Подсказать с выбором? Отвечу на любой вопрос!"),
          id: "local-nudge",
        },
      ]);
      setLocalUnread(1);
      vibrate();
      clearInterval(timer);
    };
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  // ── Входящее сообщение: звук + вибрация (бейдж придёт из sync.unread) ──
  useEffect(() => {
    chat.onIncoming.current = () => {
      playPing();
      vibrate();
    };
  }, [chat.onIncoming]);

  // ── Бейдж на кнопке «Чат» (серверные непрочитанные + локальное приглашение) ──
  const badge = (open ? 0 : chat.unread) + (open ? 0 : localUnread);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CHAT_UNREAD_EVENT, { detail: badge }));
  }, [badge]);

  // ── Web Push: регистрация service worker + подписка по кнопке ──
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    if ("Notification" in window && Notification.permission === "default") setCanAskPush(true);
  }, []);

  const enablePush = useCallback(async () => {
    try {
      const perm = await Notification.requestPermission();
      setCanAskPush(false);
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToU8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      });
      await fetch("/api/chat/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), subscription: sub.toJSON() }),
      });
    } catch { /* пользователь отказал / браузер не умеет — просто без push */ }
  }, []);

  return (
    <ChatWindow
      open={open}
      onClose={() => setOpen(false)}
      messages={chat.messages}
      localMsgs={chat.exists ? [] : localMsgs}
      staffTyping={chat.staffTyping}
      staff={chat.staff}
      online={chat.online}
      exists={chat.exists}
      tgLink={chat.tgLink}
      tgLinked={chat.tgLinked}
      readUpTo={chat.readUpTo}
      tourCtx={tourCtx}
      onSend={chat.send}
      onTyping={chat.sendTyping}
      onUpload={chat.upload}
      canAskPush={canAskPush}
      onEnablePush={() => void enablePush()}
      onPickContact={chat.pickContact}
    />
  );
}

// Заготовка локального (несохраняемого) сообщения бота.
function greet(text: string): ChatMsg {
  return {
    id: "local-greet",
    sender: "BOT",
    type: "TEXT",
    text,
    attachmentUrl: "",
    meta: null,
    createdAt: new Date().toISOString(),
    readByStaff: true,
    readByClient: true,
    author: null,
  };
}

// VAPID public key: base64url → Uint8Array (формат pushManager.subscribe).
function urlB64ToU8(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
