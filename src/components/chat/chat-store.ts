"use client";

// Локальное состояние чата: анонимный ID клиента, просмотренные экскурсии,
// флаги «диалог создан» / «робот уже предлагал помощь». Всё в localStorage —
// история привязана к браузеру (по ТЗ этого достаточно).

export const CHAT_OPEN_EVENT = "app:chat-open"; // открыть окно чата (detail: true/false)
export const CHAT_UNREAD_EVENT = "app:chat-unread"; // изменился бейдж (detail: число)

const ID_KEY = "sochifornia:chat-id";
const HAS_CONV_KEY = "sochifornia:chat-has-conv";
const VIEWS_KEY = "sochifornia:chat-views";
const NUDGE_KEY = "sochifornia:chat-nudged";
const SITE_ENTER_KEY = "sochifornia:chat-entered-at";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replaceAll("-", "");
  return Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
}

// Анонимный ID клиента (создаётся при первом обращении).
export function getClientId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "fallback-" + uuid().slice(0, 16); // приватный режим — ID на одну сессию
  }
}

export function hasConversation(): boolean {
  try {
    return localStorage.getItem(HAS_CONV_KEY) === "1";
  } catch {
    return false;
  }
}
export function markConversation() {
  try {
    localStorage.setItem(HAS_CONV_KEY, "1");
  } catch { /* ignore */ }
}

export type ViewedTour = { slug: string; title: string };

// Записать просмотр экскурсии (для контекста сотрудника + триггера робота).
export function recordTourView(slug: string, title: string) {
  try {
    const list = getViews().filter((v) => v.slug !== slug);
    list.unshift({ slug, title });
    localStorage.setItem(VIEWS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* ignore */ }
}

export function getViews(): ViewedTour[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    return raw ? (JSON.parse(raw) as ViewedTour[]) : [];
  } catch {
    return [];
  }
}

// Робот-инициатор: предлагаем помощь один раз (3 просмотренных тура ИЛИ 2 минуты на сайте).
export function wasNudged(): boolean {
  try {
    return localStorage.getItem(NUDGE_KEY) === "1";
  } catch {
    return false;
  }
}
export function markNudged() {
  try {
    localStorage.setItem(NUDGE_KEY, "1");
  } catch { /* ignore */ }
}

// Время входа на сайт (sessionStorage — на вкладку/сессию) для правила «2 минуты на сайте».
export function siteEnteredAt(): number {
  try {
    let at = sessionStorage.getItem(SITE_ENTER_KEY);
    if (!at) {
      at = String(Date.now());
      sessionStorage.setItem(SITE_ENTER_KEY, at);
    }
    return Number(at);
  } catch {
    return Date.now();
  }
}

export function openChat() {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: true }));
}
