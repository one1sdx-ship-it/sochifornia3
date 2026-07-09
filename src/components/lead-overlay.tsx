"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { stopScroll, startScroll, scrollToY } from "@/components/smooth-scroll";

// Событие открытия полноэкранной панели заявки. Шлётся кнопкой «Оставить заявку» из бара цен.
export const OPEN_LEAD_EVENT = "app:open-lead";

// Верх бара цен во вьюпорте с поправкой на его собственный transform.
// Бар прячется классом translate-y-full (виден лишь при scrollY > 500). При приходе по кнопке
// «Выбрать» страница открывается сверху (scrollY≈0) — бар ещё спрятан, и его
// getBoundingClientRect().top сдвинут вниз ровно на высоту бара. Вычитаем этот сдвиг, получая
// позицию ПОКАЗАННОГО бара — тогда «Выбрать» и «Оставить заявку» считают нижнюю границу промежутка
// одинаково. Иначе граница занижается на высоту бара, промежуток «раздувается», и основная форма
// встаёт заметно ниже формы оверлея.
function barTopInViewport(bar: HTMLElement): number {
  const tr = getComputedStyle(bar).transform;
  const shiftY = tr && tr !== "none" ? new DOMMatrixReadOnly(tr).m42 : 0;
  return bar.getBoundingClientRect().top - shiftY;
}

// Нижняя граница ленты фото в её ПРИЛИПШЕМ положении.
// Лента #tour-photostrip — sticky top-24. При приходе по «Выбрать» страница ещё сверху
// (scrollY≈0): лента не прилипла и стоит внизу hero, поэтому её текущий bottom завышен на высоту
// hero. После прокрутки к форме лента прилипнет к своему CSS-top (top-24 → 96px), поэтому берём
// именно прилипшую позицию: computed top + высота ленты. При «Оставить заявку» лента уже прилипла —
// значение то же. Без этого gapTop при «Выбрать» завышался на высоту hero, и форма вставала
// заметно ниже формы оверлея.
function stripStickyBottom(strip: HTMLElement): number {
  const stickyTop = parseFloat(getComputedStyle(strip).top) || 0;
  return stickyTop + strip.getBoundingClientRect().height;
}

// Полноэкранная панель заявки. Появляется строго в промежутке между лентой фото (сверху) и
// баром цен (снизу), поэтому одновременно остаются видны: шапка с названием компании, лента
// фото (едет справа налево), бар цен с кнопкой и нижняя навигация из 4 кнопок. Внутри — та же
// карточка [[lead-form]] с теми же пропами и в том же контейнере, что и основная панель, поэтому
// по ширине/высоте/формату это ощущается как одна и та же панель. Данные общие ([[lead-store]]).
// Пока панель открыта, прокрутка страницы заблокирована.
export function LeadOverlay({ tourTitle }: { tourTitle: string }) {
  const [open, setOpen] = useState(false);
  // Границы промежутка «лента фото ↔ бар цен» в пикселях от верхнего/нижнего края вьюпорта.
  const [gap, setGap] = useState({ top: 190, bottom: 150 });
  // Держим замок прокрутки ровно один раз (в smooth-scroll замки́ считаются): повторное открытие
  // не наращивает счётчик, а закрытие панели гарантированно снимает именно свой замок.
  const lockedRef = useRef(false);

  const lockScroll = () => {
    if (!lockedRef.current) {
      stopScroll();
      lockedRef.current = true;
    }
  };
  const unlockScroll = () => {
    if (lockedRef.current) {
      startScroll();
      lockedRef.current = false;
    }
  };

  // Замер видимого промежутка между лентой фото и баром цен — туда встаёт панель.
  const measure = () => {
    const strip = document.getElementById("tour-photostrip");
    const bar = document.getElementById("tour-bookingbar");
    const top = strip ? stripStickyBottom(strip) : 190;
    const barTop = bar ? barTopInViewport(bar) : null;
    const bottom =
      barTop != null && barTop > 0 && barTop < window.innerHeight
        ? Math.round(window.innerHeight - barTop)
        : 150;
    setGap({ top: Math.round(top), bottom });
  };

  const close = () => {
    setOpen(false);
    unlockScroll();
  };

  useEffect(() => {
    const onOpen = () => {
      // 1) Прокрутка к основной панели так, чтобы её форма встала ТОЧНО под формой в оверлее.
      //    Обе — одинаковый LeadForm той же ширины, поэтому совпадают попиксельно. Вычисляем,
      //    где окажется верх формы внутри оверлея, и подводим туда верх основной формы.
      //    Прокрутка мгновенная: под открывающейся панелью её всё равно не видно.
      const strip = document.getElementById("tour-photostrip");
      const bar = document.getElementById("tour-bookingbar");
      const form = document.getElementById("tour-lead-form");
      if (form) {
        // Промежуток «лента фото ↔ бар цен» в его УСТОЯВШЕМСЯ виде (куда всё встанет после
        // прокрутки), чтобы «Выбрать» (замер при scrollY≈0) и «Оставить заявку» считали одинаково:
        //  • верх — прилипшая позиция ленты (stripStickyBottom): иначе при «Выбрать» лента ещё не
        //    прилипла и стоит внизу hero, завышая границу на высоту hero;
        //  • низ — верх бара с поправкой на transform (barTopInViewport): при «Выбрать» бар ещё
        //    спрятан (translate-y-full), компенсация даёт его показанную позицию.
        const gapTop = strip ? stripStickyBottom(strip) : 190;
        const barTop = bar ? barTopInViewport(bar) : null;
        const gapBottom =
          barTop != null && barTop > 0 && barTop < window.innerHeight
            ? window.innerHeight - barTop
            : 150;
        const containerH = window.innerHeight - gapTop - gapBottom;
        const formH = form.getBoundingClientRect().height;
        // Верх формы в оверлее: по центру промежутка, но не выше внутреннего отступа py-3 (12px) —
        // если форма выше промежутка, она прижата к верху и прокручивается внутри оверлея.
        const formTop = gapTop + Math.max(12, (containerH - formH) / 2);
        // +1: останавливаем прокрутку на 2px ниже, чем раньше (основная форма встаёт на 1px выше
        // формы оверлея). Общий путь для обеих кнопок — «Оставить заявку» и «Выбрать».
        const y = window.scrollY + form.getBoundingClientRect().top - formTop - 0;
        scrollToY(Math.max(0, y), true);
      }
      // 2) Замер, блокировка прокрутки страницы, показ панели.
      measure();
      lockScroll();
      setOpen(true);
      // Бар цен выезжает снизу с анимацией ~300 мс — уточняем нижнюю границу после раскладки
      // и после завершения его появления, чтобы панель встала ровно над баром.
      requestAnimationFrame(() => requestAnimationFrame(measure));
      setTimeout(measure, 360);
    };
    window.addEventListener(OPEN_LEAD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_LEAD_EVENT, onOpen);
  }, []);

  // Автозапуск: пользователь пришёл по кнопке «Выбрать» с карточки экскурсии. Флаг ставит
  // [[tour-card]] прямо перед переходом. Открываем панель тем же путём, что и кнопка
  // «Оставить заявку», — поэтому ощущается так же быстро.
  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem("sf:open-lead") === "1";
    } catch {}
    if (!flagged) return;
    // Открываем на следующем кадре: страница успевает разложиться (замеры в onOpen корректны).
    // Флаг снимаем ТОЛЬКО здесь, при реальном открытии, — это устойчиво к двойному монтированию
    // в dev (React StrictMode: setup → cleanup → setup), где первый кадр отменяется, а флаг
    // должен дожить до второго монтирования.
    const id = requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem("sf:open-lead") !== "1") return;
        sessionStorage.removeItem("sf:open-lead");
      } catch {}
      window.dispatchEvent(new Event(OPEN_LEAD_EVENT));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Пока панель открыта: пересчёт границ при resize/повороте и закрытие по Esc.
  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Системная кнопка «Назад» (Android) / жест «назад»: пока панель открыта, держим в истории
  // «фиктивную» запись. Тогда «Назад» снимает именно её — панель закрывается (как по крестику),
  // а пользователь остаётся на странице экскурсии, а не уходит в каталог.
  useEffect(() => {
    if (!open) return;
    // Сохраняем текущий state роутера Next.js, добавляя свою метку.
    window.history.pushState({ ...window.history.state, leadOverlay: true }, "");
    const onPop = () => close(); // «Назад» → закрыть панель (запись уже снята браузером)
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Закрыли крестиком/фоном/Esc — сами снимаем свою запись, чтобы следующий «Назад»
      // не срабатывал вхолостую.
      if (window.history.state?.leadOverlay) window.history.back();
    };
  }, [open]);

  // Подстраховка: снять замок прокрутки, если компонент размонтируется открытым.
  useEffect(() => () => unlockScroll(), []);

  if (!open) return null;

  return (
    <div className="lg:hidden">
      {/* Затемнение промежутка. Шапка/лента/бар/навигация выше по z-index — не затемняются. */}
      <div className="fixed inset-0 z-20 bg-black/50 animate-fade-in" onClick={close} />
      {/* Прокручиваемая область строго между лентой фото и баром цен */}
      <div
        className="fixed left-0 right-0 z-20 overflow-y-auto"
        style={{ top: gap.top, bottom: gap.bottom }}
      >
        {/* Тот же контейнер, что у основной панели → та же ширина. Карточка — та же LeadForm
            с теми же пропами, поэтому это ощущается как одна и та же панель. */}
        <div className="container-wide flex min-h-full items-center py-3">
          <div className="relative w-full">
            <button
              type="button"
              aria-label="Закрыть"
              onClick={close}
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2/90 text-ink backdrop-blur active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
            <LeadForm tourTitle={tourTitle} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
