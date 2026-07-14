"use client";

// Сетевое ядро виджета: поллинг раз в 3 секунды, отправка с оптимистичным
// отображением, «печатает…», загрузка вложений.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getClientId, getViews, hasConversation, markConversation,
} from "@/components/chat/chat-store";

export type ChatMsg = {
  id: string;
  sender: "CLIENT" | "STAFF" | "BOT";
  type: "TEXT" | "IMAGE" | "VOICE" | "TOUR_CARD" | "LOCATION" | "PROMO" | "SYSTEM";
  text: string;
  attachmentUrl: string;
  meta: unknown;
  createdAt: string;
  readByStaff: boolean;
  readByClient: boolean;
  author: { name: string; avatar: string } | null;
  pending?: boolean; // оптимистичное, ещё не подтверждено сервером
  failed?: boolean;
};

export type StaffInfo = { name: string; avatar: string } | null;

export type TourCtx = { slug: string; title: string } | null;

const POLL_OPEN_MS = 3000; // окно открыто — раз в 3 секунды (по ТЗ)
const POLL_CLOSED_MS = 8000; // окно закрыто — реже (только бейдж)

export function useChat(open: boolean, tourCtx: TourCtx) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [staffTyping, setStaffTyping] = useState<{ name: string } | null>(null);
  const [staff, setStaff] = useState<StaffInfo>(null);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(true);
  const [tgLinked, setTgLinked] = useState(false);
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [readUpTo, setReadUpTo] = useState<string | null>(null);
  // Колбэк «пришло новое входящее» (звук/вибрация/бейдж) — задаёт виджет.
  const onIncoming = useRef<(msg: ChatMsg) => void>(() => {});

  const afterRef = useRef<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const tourRef = useRef<TourCtx>(tourCtx);
  tourRef.current = tourCtx;
  const initialLoaded = useRef(false);

  const mergeMessages = useCallback((incoming: ChatMsg[], notify: boolean) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      let appended = false;
      for (const m of incoming) {
        if (!byId.has(m.id)) appended = true;
        byId.set(m.id, m);
      }
      const merged = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (notify && appended) {
        const fresh = incoming.filter((m) => m.sender !== "CLIENT" && !prev.some((p) => p.id === m.id));
        if (fresh.length > 0) onIncoming.current(fresh[fresh.length - 1]);
      }
      return merged;
    });
    const last = incoming[incoming.length - 1];
    if (!afterRef.current || last.createdAt > afterRef.current) afterRef.current = last.createdAt;
  }, []);

  const sync = useCallback(async () => {
    if (!hasConversation()) return;
    try {
      const res = await fetch("/api/chat/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: getClientId(),
          after: afterRef.current,
          open: openRef.current,
          tourSlug: tourRef.current?.slug ?? undefined,
          views: getViews(),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.exists) return;
      setExists(true);
      // Уведомляем звуком только после первичной загрузки истории.
      mergeMessages(data.messages as ChatMsg[], initialLoaded.current);
      initialLoaded.current = true;
      setStaffTyping(data.staffTyping ?? null);
      setUnread(data.unread ?? 0);
      setOnline(Boolean(data.online));
      setTgLinked(Boolean(data.tgLinked));
      setStaff(data.staff ?? null);
      setReadUpTo(data.readUpTo ?? null);
      if (data.botUsername && data.tgLinkToken) {
        setTgLink(`https://t.me/${data.botUsername}?start=c_${data.tgLinkToken}`);
      }
    } catch { /* сеть моргнула — попробуем в следующий тик */ }
  }, [mergeMessages]);

  // Цикл поллинга: 3с при открытом окне, реже при закрытом.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await sync();
      if (!stopped) timer = setTimeout(tick, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [open, sync]);

  // Отправка сообщения (оптимистично).
  const send = useCallback(
    async (
      payload: { type: "TEXT" | "IMAGE" | "VOICE"; text?: string; attachmentUrl?: string },
      contact?: { name: string; phone: string },
    ): Promise<{ ok: boolean; error?: string }> => {
      const tempId = "tmp-" + Date.now();
      const optimistic: ChatMsg = {
        id: tempId,
        sender: "CLIENT",
        type: payload.type,
        text: payload.text ?? "",
        attachmentUrl: payload.attachmentUrl ?? "",
        meta: null,
        createdAt: new Date().toISOString(),
        readByStaff: false,
        readByClient: true,
        author: null,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: getClientId(),
            name: contact?.name,
            phone: contact?.phone,
            tourSlug: tourRef.current?.slug ?? "",
            views: getViews(),
            message: payload,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
          return { ok: false, error: data.error ?? "Не отправилось" };
        }
        markConversation();
        setExists(true);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        mergeMessages([data.message as ChatMsg, ...((data.extra ?? []) as ChatMsg[])], false);
        return { ok: true };
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
        return { ok: false, error: "Нет соединения" };
      }
    },
    [mergeMessages],
  );

  // «Клиент печатает…» — не чаще раза в 2 секунды.
  const lastTypingSent = useRef(0);
  const sendTyping = useCallback(() => {
    if (!hasConversation()) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: getClientId(), typing: true }),
    }).catch(() => {});
  }, []);

  // Загрузка вложения (фото/голос). Возвращает URL или null.
  const upload = useCallback(async (file: Blob, filename: string): Promise<string | null> => {
    const fd = new FormData();
    fd.append("clientId", getClientId());
    fd.append("file", file, filename);
    try {
      const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url as string;
    } catch {
      return null;
    }
  }, []);

  return {
    messages, staffTyping, staff, unread, online, tgLinked, tgLink, exists, readUpTo,
    send, sendTyping, upload, sync, onIncoming,
  };
}
