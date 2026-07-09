"use client";

import { useSyncExternalStore } from "react";

// Общее сохраняемое состояние формы заявки (имя / телефон / кол-во человек).
// Единый источник правды для основной панели заявки и полноэкранной панели: обе читают
// и пишут сюда, поэтому их данные всегда синхронны. Значения хранятся в localStorage —
// сохраняются при вводе каждого символа и восстанавливаются после перезагрузки страницы
// или повторного открытия браузера. См. [[lead-form]] и [[lead-overlay]].

// phone хранится в формате E.164 («+79998887766»), country — ISO-код выбранной страны
// («RU»): вместе однозначно описывают номер (нужно, т.к. код +7 общий у РФ и Казахстана).
export type LeadField = "name" | "phone" | "people" | "country";
export type LeadData = Record<LeadField, string>;

const STORAGE_KEY = "sochifornia:lead";
const DEFAULT: LeadData = { name: "", phone: "", people: "2", country: "RU" };

let state: LeadData = DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): LeadData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<LeadData>) };
  } catch {
    /* приватный режим / битый JSON — берём значения по умолчанию */
  }
  return DEFAULT;
}

function emit() {
  for (const l of listeners) l();
}

// Ленивая гидратация из localStorage — только на клиенте и однократно. Выполняется при
// первой подписке (уже после монтирования), поэтому первый клиентский рендер совпадает с
// SSR (нет hydration mismatch), а затем состояние обновляется на сохранённые значения.
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = readStorage();
  emit();
  // Синхронизация между вкладками: правки в другой вкладке подхватываются здесь.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = readStorage();
      emit();
    }
  });
}

// Записать одно поле: обновляем состояние, сохраняем в localStorage и уведомляем подписчиков.
export function setLeadField(field: LeadField, value: string) {
  state = { ...state, [field]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage недоступен — данные просто не сохранятся между сессиями */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  hydrate();
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => DEFAULT;

// Хук: реактивно возвращает общие данные заявки.
export function useLeadData(): LeadData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
