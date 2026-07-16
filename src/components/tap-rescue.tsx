"use client";

import { useEffect } from "react";

// «Спасение тапа» — общий страховочный механизм на весь сайт.
//
// Проблема: на мобильных тап во время инерции прокрутки браузер тратит на ОСТАНОВКУ этой
// инерции и «съедает» click — кнопка не выполняет своё действие с первого раза. Точечные
// обходы уже есть у «Наверх», «Фильтров» и нижней навигации, но кликабельных элементов на
// сайте много, и чинить каждый по отдельности бессмысленно.
//
// Механика:
//  • ловим pointerdown/pointerup на документе (capture-фаза);
//  • если это был осознанный тап (палец почти не сдвинулся, удержание короткое) по
//    интерактивному элементу И он случился на фоне прокрутки (scroll шёл непосредственно
//    перед касанием или во время него), а браузер спустя CLICK_WAIT_MS так и не прислал
//    родной click — диспатчим click сами. Синтетический click запускает и React-обработчики,
//    и активацию ссылок/чекбоксов — так же, как element.click().
//  • при обычных тапах по неподвижной странице не вмешиваемся (родной click приходит сам),
//    поэтому двойных срабатываний нет. Компоненты со своими pointer-обходами гасят
//    последующий click флагами — наш синтетический они гасят точно так же.

const TAP_MAX_MS = 700; // дольше — это удержание/выделение, а не тап
const TAP_SLOP_PX = 12; // больший увод пальца — это жест прокрутки, а не тап
const SCROLL_WINDOW_MS = 200; // «на фоне прокрутки» = scroll был не раньше, чем за это время до касания
const CLICK_WAIT_MS = 120; // сколько ждём родной click после pointerup, прежде чем слать свой
const DUP_CLICK_MS = 350; // опоздавший родной click в это окно после нашего — глотаем (дубль)

// Интерактивен ли элемент или его предок: нативные контролы, role="button" и элементы с
// cursor:pointer (у кастомных кликабельных div'ов Tailwind ставит именно его). Тап по
// неинтерактивному месту — это «остановить прокрутку», в него не вмешиваемся.
function findInteractive(start: Element | null): Element | null {
  let el: Element | null = start;
  while (el && el !== document.body) {
    const tag = el.tagName;
    if (
      tag === "BUTTON" ||
      tag === "A" ||
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA" ||
      tag === "LABEL" ||
      tag === "SUMMARY" ||
      el.getAttribute("role") === "button" ||
      (el instanceof HTMLElement && getComputedStyle(el).cursor === "pointer")
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function TapRescue() {
  useEffect(() => {
    let lastScrollTs = 0; // время последнего scroll (страница или любой внутренний контейнер)
    let down: { x: number; y: number; t: number; scrolled: boolean } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let synthTs = 0; // время нашего синтетического click (для гашения опоздавшего дубля)

    const cancelPending = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    // scroll не всплывает, но capture-фаза на документе ловит прокрутку ЛЮБОГО контейнера
    // (окно, лента чата, панель фильтров, полноэкранный просмотр фото и т.д.).
    const onScroll = () => {
      lastScrollTs = performance.now();
      if (down) down.scrolled = true;
    };

    const onPointerDown = (e: PointerEvent) => {
      cancelPending();
      if (e.pointerType !== "touch" || !e.isPrimary) {
        down = null; // мышь click не теряет; мультитач — не тап
        return;
      }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), scrolled: false };
    };

    // Браузер признал жест прокруткой — это точно не тап
    const onPointerCancel = () => {
      down = null;
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || e.pointerType !== "touch" || !e.isPrimary) return;
      const now = performance.now();
      if (now - d.t > TAP_MAX_MS) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) return;
      // Вмешиваемся ТОЛЬКО если тап пришёлся на фоне прокрутки — именно тогда браузер тратит
      // его на остановку инерции и глотает click. В остальных случаях click придёт сам.
      if (!d.scrolled && d.t - lastScrollTs > SCROLL_WINDOW_MS) return;
      const x = e.clientX;
      const y = e.clientY;
      // elementFromPoint, а не e.target: при setPointerCapture (карусели и т.п.) target
      // указывает на захвативший элемент, а не на то, что под пальцем.
      const target = document.elementFromPoint(x, y) ?? (e.target as Element | null);
      if (!target || !findInteractive(target)) return;
      cancelPending();
      timer = setTimeout(() => {
        timer = null;
        synthTs = performance.now();
        target.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            detail: 1,
          })
        );
      }, CLICK_WAIT_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted) return; // наш собственный синтетический click
      // Родной click всё же пришёл с опозданием после нашего — гасим дубль.
      if (performance.now() - synthTs < DUP_CLICK_MS) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      cancelPending(); // родной click успел раньше страховки — она не нужна
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("click", onClick, true);
    return () => {
      cancelPending();
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
