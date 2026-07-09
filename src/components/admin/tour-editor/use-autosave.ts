"use client";

// Хук автосохранения с дебаунсом и очередью на случай обрыва связи.
import { useCallback, useRef, useState } from "react";

export type SavePayload =
  | { type: "meta"; title?: string; excerpt?: string; adultPrice?: number; childPrice?: number; priceSuffix?: string }
  | { type: "blocks"; blocks: { icon: string; iconType?: "LUCIDE" | "CUSTOM"; title: string }[] }
  | { type: "program"; program: { time: string; title: string; text: string }[] }
  | { type: "list"; kind: "INCLUDED" | "EXCLUDED" | "BRING"; items: { text: string; icon?: string | null; iconType?: "LUCIDE" | "CUSTOM" }[] }
  | { type: "tariffs"; tariffs: { label: string; price: number }[] }
  | { type: "gallery"; images: { url: string; alt?: string }[] };

// Загрузка одного изображения. Возвращает URL сохранённого файла.
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Не удалось загрузить файл");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const qKey = (id: string) => `sochi_editqueue_${id}`;

function readQueue(tourId: string): Record<string, SavePayload> {
  try {
    return JSON.parse(localStorage.getItem(qKey(tourId)) || "{}");
  } catch {
    return {};
  }
}
function writeQueue(tourId: string, q: Record<string, SavePayload>) {
  try {
    localStorage.setItem(qKey(tourId), JSON.stringify(q));
  } catch {
    /* хранилище недоступно — пропускаем */
  }
}
function enqueue(tourId: string, key: string, payload: SavePayload) {
  const q = readQueue(tourId);
  q[key] = payload;
  writeQueue(tourId, q);
}
function dequeue(tourId: string, key: string) {
  const q = readQueue(tourId);
  delete q[key];
  writeQueue(tourId, q);
}

async function patch(tourId: string, payload: SavePayload) {
  const res = await fetch(`/api/admin/tours/${tourId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String(res.status));
}

// Досохранить всё, что осело в очереди (вызывается при возврате сети).
export async function flushQueue(tourId: string) {
  const q = readQueue(tourId);
  for (const [key, payload] of Object.entries(q)) {
    try {
      await patch(tourId, payload);
      dequeue(tourId, key);
    } catch {
      /* всё ещё оффлайн — оставляем в очереди */
    }
  }
}

// queueKey разделяет разделы: новая правка того же раздела заменяет прежнюю в очереди.
export function useAutosave(tourId: string, queueKey: string) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<SavePayload | null>(null);

  const flush = useCallback(async () => {
    const payload = latest.current;
    if (!payload) return;
    setStatus("saving");
    try {
      await patch(tourId, payload);
      dequeue(tourId, queueKey);
      setStatus("saved");
    } catch {
      enqueue(tourId, queueKey, payload);
      setStatus("error");
    }
  }, [tourId, queueKey]);

  const save = useCallback(
    (payload: SavePayload) => {
      latest.current = payload;
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush],
  );

  return { save, status };
}
