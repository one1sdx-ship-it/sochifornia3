"use client";

import { useEffect, useState } from "react";

// Клиентский стор избранного: один раз подгружает список id с сервера и держит его
// в памяти модуля, чтобы все сердечки на странице делили одно состояние без лишних запросов.

let ids: Set<string> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function ensureLoaded() {
  if (ids || loading) return loading ?? Promise.resolve();
  loading = (async () => {
    try {
      const res = await fetch("/api/customer/favorites");
      const data = (await res.json()) as { tourIds?: string[] };
      ids = new Set(data.tourIds ?? []);
    } catch {
      ids = new Set();
    } finally {
      loading = null;
      emit();
    }
  })();
  return loading;
}

// Сброс кеша (например, после выхода) — при следующем обращении список перезагрузится.
export function resetFavorites() {
  ids = null;
  emit();
}

// Хук для одной кнопки-сердечка.
export function useFavorite(tourId: string, enabled: boolean) {
  const [, force] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    ensureLoaded();
    return () => {
      listeners.delete(rerender);
    };
  }, [enabled]);

  const ready = ids !== null;
  const favorited = ids?.has(tourId) ?? false;

  // Переключение с оптимистичным обновлением и откатом при ошибке.
  async function toggle() {
    if (!ids) ids = new Set();
    const was = ids.has(tourId);
    if (was) ids.delete(tourId);
    else ids.add(tourId);
    emit();
    try {
      const res = await fetch("/api/customer/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { favorited: boolean };
      if (data.favorited) ids.add(tourId);
      else ids.delete(tourId);
      emit();
    } catch {
      // откат
      if (was) ids.add(tourId);
      else ids.delete(tourId);
      emit();
    }
  }

  return { ready, favorited, toggle };
}
