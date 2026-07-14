"use client";

// Админ-чат: слева список диалогов, справа переписка с клиентом.
// История у всех сотрудников общая. Поллинг раз в 3 секунды.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Check, CheckCheck, Eye, Image as ImageIcon, Loader2, MapPin, Palmtree,
  Phone, Send, Settings, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dayLabel, timeOf } from "@/components/chat/chat-bubbles";
import type { ChatMsg } from "@/components/chat/use-chat";

const POLL_MS = 3000;

type ConvRow = {
  id: string;
  clientName: string;
  clientPhone: string;
  currentTour: string;
  tgLinked: boolean;
  online: boolean;
  typing: boolean;
  unread: number;
  promoCode: string;
  updatedAt: string;
  lastPreview: string;
  lastSender: string | null;
};

type ClientInfo = {
  name: string;
  phone: string;
  online: boolean;
  lastSeenAt: string;
  typing: boolean;
  tgLinked: boolean;
  promoCode: string;
  currentTour: { slug: string; title: string } | null;
  viewedTours: { slug: string; title: string }[];
};

type AdminTour = {
  id: string;
  slug: string;
  title: string;
  price: number;
  image: string;
  duration: number;
  meeting: { address: string; lat: number | null; lng: number | null };
};

export function AdminChat() {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "tours" | "location" | "profile">("none");
  const afterRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  // ── Поллинг списка диалогов ──
  const loadConvs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chat");
      if (res.ok) setConvs((await res.json()).conversations as ConvRow[]);
    } catch { /* сеть моргнула */ }
  }, []);

  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 5000);
    return () => clearInterval(t);
  }, [loadConvs]);

  // ── Поллинг активного диалога ──
  const loadDialog = useCallback(async (id: string, reset: boolean) => {
    try {
      const after = reset ? "" : afterRef.current ?? "";
      const res = await fetch(`/api/admin/chat/${id}?open=1&after=${encodeURIComponent(after)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (activeRef.current !== id) return; // уже переключились
      setClient(data.client as ClientInfo);
      const incoming = data.messages as ChatMsg[];
      if (incoming.length > 0) {
        setMessages((prev) => {
          const base = reset ? [] : prev;
          const byId = new Map(base.map((m) => [m.id, m]));
          for (const m of incoming) byId.set(m.id, m);
          return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        const last = incoming[incoming.length - 1];
        if (!afterRef.current || last.createdAt > afterRef.current) afterRef.current = last.createdAt;
      } else if (reset) {
        setMessages([]);
      }
    } catch { /* следующий тик */ }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    afterRef.current = null;
    setMessages([]);
    setClient(null);
    loadDialog(activeId, true);
    const t = setInterval(() => loadDialog(activeId, false), POLL_MS);
    return () => clearInterval(t);
  }, [activeId, loadDialog]);

  // Автопрокрутка вниз.
  useEffect(() => {
    const el = listRef.current;
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight }));
  }, [messages.length, client?.typing]);

  // ── Отправка ──
  const send = useCallback(
    async (payload: { type: string; text?: string; attachmentUrl?: string; meta?: Record<string, unknown> }) => {
      if (!activeId || busy) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/chat/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, data.message as ChatMsg]);
          afterRef.current = (data.message as ChatMsg).createdAt;
        }
      } finally {
        setBusy(false);
      }
    },
    [activeId, busy],
  );

  const sendText = async () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    await send({ type: "TEXT", text: t });
  };

  // «Печатает…» для клиента (не чаще раза в 2с).
  const lastTyping = useRef(0);
  const signalTyping = () => {
    if (!activeId || Date.now() - lastTyping.current < 2000) return;
    lastTyping.current = Date.now();
    fetch(`/api/admin/chat/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typing: true }),
    }).catch(() => {});
  };

  // Фото сотрудника → /api/admin/upload (авторизованный) → IMAGE.
  const attachPhoto = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        await send({ type: "IMAGE", attachmentUrl: url });
      }
    } finally {
      setBusy(false);
    }
  };

  const active = convs.find((c) => c.id === activeId) ?? null;

  return (
    <div className="mx-auto grid h-[calc(100vh-61px)] max-w-6xl grid-cols-1 md:grid-cols-[320px_1fr]">
      {/* ══ Список диалогов ══ */}
      <aside className={cn("min-h-0 border-r border-hairline bg-surface", activeId && "hidden md:flex", "flex-col")}>
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h1 className="font-display font-bold text-ink">Диалоги</h1>
          <button
            type="button"
            onClick={() => setPanel(panel === "profile" ? "none" : "profile")}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-2"
          >
            <Settings className="h-3.5 w-3.5" /> Мой профиль
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {convs.length === 0 && <p className="p-4 text-sm text-muted">Пока нет диалогов.</p>}
          {convs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-hairline px-4 py-3 text-left hover:bg-surface-2",
                activeId === c.id && "bg-primary/10",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", c.online ? "bg-success" : "bg-muted/40")} />
                <span className="flex-1 truncate font-semibold text-ink">{c.clientName}</span>
                {c.tgLinked && <span className="text-[10px] font-bold text-[#229ED9]">TG</span>}
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </span>
              {c.currentTour && (
                <span className="flex items-center gap-1 truncate text-xs text-primary">
                  <Palmtree className="h-3 w-3 shrink-0" /> {c.currentTour}
                </span>
              )}
              <span className="truncate text-xs text-muted">
                {c.typing ? <i className="text-primary">печатает…</i> : c.lastPreview}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ══ Переписка ══ */}
      <section className={cn("min-h-0 flex-col bg-bg", activeId ? "flex" : "hidden md:flex")}>
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-muted">Выберите диалог слева</div>
        ) : (
          <>
            {/* Шапка диалога: клиент + контекст */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline bg-surface px-4 py-2.5">
              <button type="button" className="md:hidden text-sm text-primary" onClick={() => setActiveId(null)}>
                ← Диалоги
              </button>
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {client?.name ?? active?.clientName ?? "Гость"}{" "}
                  <span className={cn("ml-1 inline-block h-2 w-2 rounded-full", client?.online ? "bg-success" : "bg-muted/40")} />
                </p>
                {client?.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-xs text-primary">
                    <Phone className="h-3 w-3" /> {client.phone}
                  </a>
                )}
              </div>
              <div className="min-w-0 flex-1 text-xs text-muted">
                {client?.currentTour && (
                  <p className="truncate">
                    🎯 Сейчас смотрит: <b className="text-ink">{client.currentTour.title}</b>
                  </p>
                )}
                {client && client.viewedTours.length > 0 && (
                  <p className="flex min-w-0 items-center gap-1 truncate">
                    <Eye className="h-3 w-3 shrink-0" />
                    Смотрел: {client.viewedTours.map((v) => v.title).join(" · ")}
                  </p>
                )}
                {client?.promoCode && <p>🎁 Промокод: <b className="text-ink">{client.promoCode}</b></p>}
              </div>
            </div>

            {/* Сообщения */}
            <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {withDays(messages).map((item) =>
                item.kind === "day" ? (
                  <div key={item.key} className="my-2 text-center">
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">{item.label}</span>
                  </div>
                ) : (
                  <AdminBubble key={item.msg.id} msg={item.msg} />
                ),
              )}
              {client?.typing && <p className="text-xs italic text-muted">клиент печатает…</p>}
            </div>

            {/* Панели инструментов: туры / локация */}
            {panel === "tours" && <TourPicker onSend={(slug) => { void send({ type: "TOUR_CARD", meta: { slug } }); setPanel("none"); }} onClose={() => setPanel("none")} />}
            {panel === "location" && (
              <LocationPicker
                onSend={(lat, lng, label) => { void send({ type: "LOCATION", meta: { lat, lng, label } }); setPanel("none"); }}
                onClose={() => setPanel("none")}
              />
            )}

            {/* Поле ввода */}
            <div className="border-t border-hairline bg-surface px-3 py-2">
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void attachPhoto(f);
                    e.target.value = "";
                  }}
                />
                <button type="button" title="Фото" onClick={() => fileRef.current?.click()} className="p-2 text-muted hover:text-ink">
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button type="button" title="Карточка тура" onClick={() => setPanel(panel === "tours" ? "none" : "tours")} className="p-2 text-muted hover:text-ink">
                  <Palmtree className="h-5 w-5" />
                </button>
                <button type="button" title="Локация (место встречи)" onClick={() => setPanel(panel === "location" ? "none" : "location")} className="p-2 text-muted hover:text-ink">
                  <MapPin className="h-5 w-5" />
                </button>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    signalTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                  placeholder="Ответ клиенту…"
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void sendText()}
                  disabled={busy || !input.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-fg disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {panel === "profile" && <ProfileModal onClose={() => setPanel("none")} />}
    </div>
  );
}

// ── Сообщения с разделителями дней ──
function withDays(messages: ChatMsg[]) {
  const out: ({ kind: "day"; label: string; key: string } | { kind: "msg"; msg: ChatMsg })[] = [];
  let last = "";
  for (const m of messages) {
    const d = dayLabel(m.createdAt);
    if (d !== last) {
      out.push({ kind: "day", label: d, key: "d" + m.createdAt });
      last = d;
    }
    out.push({ kind: "msg", msg: m });
  }
  return out;
}

// ── Пузырь в админке: клиент слева (оранжевый контур), мы справа (сине-голубой) ──
function AdminBubble({ msg }: { msg: ChatMsg }) {
  const fromClient = msg.sender === "CLIENT";
  const meta = (msg.meta ?? {}) as Record<string, unknown>;
  return (
    <div className={cn("flex", fromClient ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          fromClient
            ? "rounded-bl-md border border-orange-300/60 bg-orange-500/10 text-ink"
            : msg.sender === "STAFF"
              ? "rounded-br-md bg-gradient-to-br from-sky-500 to-cyan-500 text-white"
              : "rounded-br-md border border-hairline bg-surface-2 text-body", // BOT/система
        )}
      >
        {msg.sender === "STAFF" && msg.author && (
          <span className="mb-0.5 block text-[11px] font-semibold text-white/80">{msg.author.name}</span>
        )}
        {msg.type === "IMAGE" && msg.attachmentUrl && (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={msg.attachmentUrl} alt="Фото" className="mb-1 max-h-56 rounded-lg" loading="lazy" />
          </a>
        )}
        {msg.type === "VOICE" && msg.attachmentUrl && (
          <audio controls preload="none" src={msg.attachmentUrl} className="my-1 h-9 w-52" />
        )}
        {msg.type === "TOUR_CARD" && (
          <p className="font-medium">🌴 Карточка: {String(meta.title ?? "")} {meta.price ? `— от ${String(meta.price)} ₽` : ""}</p>
        )}
        {msg.type === "LOCATION" && (
          <p className="font-medium">📍 {(meta.label as string) || "Локация"} ({String(meta.lat)}, {String(meta.lng)})</p>
        )}
        {msg.type === "PROMO" && <p className="font-medium">🎁 Промокод: {msg.text}</p>}
        {msg.type !== "PROMO" && msg.text && <span className="whitespace-pre-wrap break-words">{msg.text}</span>}
        <span className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", fromClient ? "text-muted" : "text-white/70")}>
          {(meta as { source?: string }).source === "telegram" ? "из TG · " : ""}
          {timeOf(msg.createdAt)}
          {!fromClient && (msg.readByClient ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3 opacity-70" />)}
        </span>
      </div>
    </div>
  );
}

// ── Выбор тура для карточки ──
function TourPicker({ onSend, onClose }: { onSend: (slug: string) => void; onClose: () => void }) {
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetch("/api/admin/chat/tours").then(async (r) => r.ok && setTours((await r.json()).tours)).catch(() => {});
  }, []);
  const filtered = useMemo(
    () => tours.filter((t) => t.title.toLowerCase().includes(q.toLowerCase())),
    [tours, q],
  );
  return (
    <div className="max-h-56 overflow-y-auto border-t border-hairline bg-surface-2 p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск тура…"
          className="h-9 flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <button type="button" onClick={onClose} className="p-1.5 text-muted hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSend(t.slug)}
            className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-left text-sm text-ink hover:border-primary"
          >
            <Camera className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="shrink-0 text-xs text-muted">{t.price} ₽</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Отправка локации: из «Места встречи» тура или вручную (с сохранением в тур) ──
function LocationPicker({
  onSend, onClose,
}: {
  onSend: (lat: number, lng: number, label: string) => void;
  onClose: () => void;
}) {
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [tourId, setTourId] = useState("");
  const [label, setLabel] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [save, setSave] = useState(true);

  useEffect(() => {
    fetch("/api/admin/chat/tours").then(async (r) => r.ok && setTours((await r.json()).tours)).catch(() => {});
  }, []);

  // Выбор тура подставляет его сохранённое место встречи.
  useEffect(() => {
    const t = tours.find((x) => x.id === tourId);
    if (!t) return;
    setLabel(t.meeting.address || `Место встречи — ${t.title}`);
    if (t.meeting.lat != null) setLat(String(t.meeting.lat));
    if (t.meeting.lng != null) setLng(String(t.meeting.lng));
  }, [tourId, tours]);

  const la = parseFloat(lat.replace(",", "."));
  const ln = parseFloat(lng.replace(",", "."));
  const valid = isFinite(la) && isFinite(ln);

  const submit = async () => {
    if (!valid) return;
    // Заодно сохраняем как «Место встречи» тура (появится на странице экскурсии).
    if (save && tourId) {
      await fetch("/api/admin/chat/tours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourId, address: label, lat: la, lng: ln }),
      }).catch(() => {});
    }
    onSend(la, ln, label);
  };

  return (
    <div className="border-t border-hairline bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">📍 Отправить точку сбора</p>
        <button type="button" onClick={onClose} className="p-1.5 text-muted hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={tourId}
          onChange={(e) => setTourId(e.target.value)}
          className="h-9 rounded-lg border border-hairline bg-surface px-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Тур (не обязательно)</option>
          {tours.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Подпись (адрес)" className="h-9 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-primary" />
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Широта, напр. 43.5855" className="h-9 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-primary" />
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Долгота, напр. 39.7231" className="h-9 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-primary" />
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-body">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} disabled={!tourId} />
        Сохранить как «Место встречи» выбранного тура (покажется на странице экскурсии)
      </label>
      <p className="mt-1 text-[11px] text-muted">Координаты: Яндекс.Карты → правый клик по точке → «Что здесь?».</p>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!valid}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-40"
      >
        Отправить в чат
      </button>
    </div>
  );
}

// ── Профиль сотрудника: имя + аватар (видит клиент) + привязка Telegram ──
function ProfileModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [tgLinked, setTgLinked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/chat/profile")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        setName(d.displayName);
        setAvatar(d.avatarUrl);
        setTgLink(d.tgLink);
        setTgLinked(d.tgLinked);
      })
      .catch(() => {});
  }, []);

  const uploadAvatar = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) setAvatar((await res.json()).url);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/chat/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, avatarUrl: avatar }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-bold text-ink">Мой профиль в чате</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-muted hover:text-ink"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-3 flex items-center gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="Аватар" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-muted">
              <Camera className="h-6 w-6" />
            </span>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2">
              {busy ? "Загрузка…" : "Загрузить аватар"}
            </button>
            <p className="mt-1 text-xs text-muted">Клиент видит его в шапке чата</p>
          </div>
        </div>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-ink">Ваше имя для клиентов</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Алексей" className="h-10 w-full rounded-lg border border-hairline bg-surface-2 px-3 text-ink outline-none focus:border-primary" />
        </label>

        <div className="mb-4 rounded-lg border border-hairline bg-surface-2 p-3 text-sm">
          {tgLinked ? (
            <p className="font-medium text-success">✅ Telegram подключён — уведомления приходят</p>
          ) : tgLink ? (
            <>
              <p className="mb-1.5 text-body">Уведомления о новых сообщениях — в Telegram:</p>
              <a href={tgLink} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full bg-[#229ED9] px-4 py-1.5 font-semibold text-white">
                Подключить Telegram
              </a>
            </>
          ) : (
            <p className="text-muted">Бот не настроен (нет NEXT_PUBLIC_TG_BOT_USERNAME)</p>
          )}
        </div>

        <button type="button" onClick={() => void saveProfile()} disabled={busy} className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-fg disabled:opacity-50">
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
