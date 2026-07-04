"use client";

import { useSyncExternalStore } from "react";

// На сколько пикселей закладка «Фильтры» опускается во время прокрутки/листания фото
export const FILTER_DODGE_Y = 120;

// Через сколько мс тишины (без прокрутки/листания) закладка возвращается наверх (100%)
const DODGE_DELAY = 3000;

// ── Общий модуль-синглтон опускания ─────────────────────────────────────────
// Единое состояние «опускания» СРАЗУ для обеих кнопок «Фильтры» (главная + каталог):
// один флаг + один таймер возврата на уровне модуля. Благодаря этому положение/видимость
// и все тайминги переживают переход между страницами — при переключении раздела вторая
// кнопка наследует текущее состояние первой, а не сбрасывается в исходное положение.
let dodging = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

// Любая прокрутка/листание → опустить и притушить + перезапустить общий таймер возврата
function bump() {
  if (!dodging) {
    dodging = true;
    emit();
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    dodging = false;
    emit();
  }, DODGE_DELAY); // тишина → поднимаем обратно
}

// Глобальные слушатели ставим один раз и НЕ снимаем — чтобы флаг и таймер жили между
// страницами (в момент навигации одна кнопка размонтируется раньше, чем смонтируется вторая).
function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("scroll", bump, { passive: true }); // прокрутка вверх/вниз
  window.addEventListener("app:carousel", bump); // событие карусели (на будущее; сейчас не диспатчится)
  // Вкладка/окно скрыты → замораживаем возврат кнопки наверх: иначе таймер отработает, пока нас
  // нет (напр. переключились на другую вкладку на 5с), и при возврате кнопка окажется в другом
  // положении — резкий скачок. Вернулись: если кнопка ещё опущена — заново отсчитываем тишину.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    } else if (dodging) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        dodging = false;
        emit();
      }, DODGE_DELAY);
    }
  });
}

function subscribe(cb: () => void) {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Текущее состояние опускания без подписки (для инициализации «ворот» каталога при заходе)
export function getFilterDodge() {
  return dodging;
}

// Пока идёт прокрутка страницы ИЛИ листание фото внутри карточки экскурсии —
// кнопка «Фильтры» плавно, но заметно опускается ниже и притухает до 45%.
// Через DODGE_DELAY мс тишины — плавно возвращается на место (100%).
// Общее состояние для главной и раздела «Каталог» (один источник на обе кнопки).
export function useFilterDodge() {
  return useSyncExternalStore(subscribe, () => dodging, () => false);
}
