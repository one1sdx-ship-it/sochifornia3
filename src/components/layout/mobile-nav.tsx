"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Compass, Images, Phone, PhoneCall, Star } from "lucide-react";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";
import { smoothScrollToTop } from "@/components/smooth-scroll";
import { CallbackModal, CALLBACK_CLOSE_EVENT } from "@/components/callback-modal";
import { ContactFab } from "@/components/contact-fab";

const items = [
  { label: "Каталог", href: "/tours", Icon: Compass },
  // «Галерея» и «Отзывы» поменяны местами
  { label: "Галерея", href: "/#gallery", Icon: Images },
  { label: "Отзывы", href: "/reviews", Icon: Star },
  { label: "Контакты", href: "/contacts", Icon: Phone },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showTop, setShowTop] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false); // открыта ли панель «Перезвоните мне»
  const [pinned, setPinned] = useState(false); // тап по свёрнутому кластеру навсегда выдвигает синюю подложку (п.2)
  const lastY = useRef(0);
  const zoneRef = useRef<HTMLDivElement>(null); // контекстная зона (кнопка + номер) над навигацией
  const btnRef = useRef<HTMLButtonElement>(null); // белая кнопка «Перезвоните мне»
  const [shift, setShift] = useState(0); // на сколько px сдвинуть кнопку вправо, когда подложка скрыта
  const [clusterBottom, setClusterBottom] = useState(80); // нижнее положение кластера: центр по кнопке «Перезвоните мне»
  const [ready, setReady] = useState(false); // анимируем сдвиг только после первого замера (без «прыжка» на загрузке)

  const onCatalog = pathname === "/tours";
  // Контекстную зону (синяя подложка + «Перезвоните мне» + номер) и весь функционал показываем
  // и в каталоге, и на главной — одинаковая логика (п.6).
  const showContext = onCatalog || pathname === "/";

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setShowTop(y > 600);
      if (y < lastY.current - 4) setShowPhone(true); // листают вверх → показать
      else if (y > lastY.current + 4) setShowPhone(false); // листают вниз → скрыть
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // взаимодействие с каруселью фото → показать кнопку телефона
  useEffect(() => {
    const onCarousel = () => setShowPhone(true);
    window.addEventListener("app:carousel", onCarousel);
    return () => window.removeEventListener("app:carousel", onCarousel);
  }, []);

  // При переходе на другой раздел закреплённая синяя подложка задвигается обратно (п.3):
  // сбрасываем pinned, дальше её показ снова определяет только листание вверх (showPhone).
  useEffect(() => {
    setPinned(false);
  }, [pathname]);

  // Закрываем панель «Перезвоните мне» по запросу из шапки (клик по логотипу/названию).
  useEffect(() => {
    const close = () => setCallbackOpen(false);
    window.addEventListener(CALLBACK_CLOSE_EVENT, close);
    return () => window.removeEventListener(CALLBACK_CLOSE_EVENT, close);
  }, []);

  // Синяя плашка: обычно показывается при листании вверх (showPhone); после тапа по свёрнутому
  // кластеру закрепляется навсегда (pinned, п.2) — скролл вниз её больше не прячет. Прячется
  // только пока открыта панель «Перезвоните мне» (она её и порождает).
  const phoneVisible = showContext && (showPhone || pinned) && !callbackOpen;

  // Замеряем положение кнопки «Перезвоните мне» и плавающего кластера [[contact-fab]]:
  //  • shift — правый край кнопки в 12px слева от кластера (тот же зазор, что циклер↔«Чат», п.1);
  //  • clusterBottom — нижнее положение кластера опускаем так, чтобы его центр по вертикали совпал
  //    с центром кнопки (кнопку саму не двигаем — она всегда на нижнем уровне).
  // Замер берём только при свёрнутом кластере (подложка скрыта) и в покое; на resize пересчёт.
  // GAP — зазор между кнопкой и кластером, равный зазору циклер↔«Чат» (pr-3 = 12px).
  const GAP = 12;
  useEffect(() => {
    if (!showContext) {
      setReady(false);
      return;
    }
    const measure = () => {
      const zone = zoneRef.current;
      const btn = btnRef.current;
      const cluster = document.getElementById("contact-fab-cluster");
      if (!zone || !btn || !cluster || phoneVisible) return; // мерим только при свёрнутом кластере
      const zr = zone.getBoundingClientRect();
      const cr = cluster.getBoundingClientRect();
      // Исходные (без transform) координаты кнопки: offsetLeft/offsetTop относительно зоны.
      const btnRight = zr.left + btn.offsetLeft + btn.offsetWidth;
      const btnCenterY = zr.top + btn.offsetTop + btn.offsetHeight / 2;
      setShift(cr.left - GAP - btnRight); // вправо, чтобы встать в 12px слева от кластера (п.1)
      // bottom кластера (от низа экрана), при котором его центр совпадёт с центром кнопки.
      setClusterBottom(window.innerHeight - btnCenterY - cr.height / 2);
    };
    measure();
    const raf = requestAnimationFrame(() => setReady(true)); // первая расстановка — без анимации
    window.addEventListener("resize", measure);
    // Строгое правило: пока подложка скрыта, следим за шириной кластера [[contact-fab]]. Когда
    // циклер сворачивается (например, синяя плашка ушла вниз, п.1), его левый край уезжает вправо
    // — на каждый такой шаг пересчитываем shift, чтобы кнопка «Перезвоните мне» подъехала обратно
    // вплотную к циклеру (12px), а не осталась слева, как будто циклер ещё раскрыт.
    const cluster = document.getElementById("contact-fab-cluster");
    const ro = typeof ResizeObserver !== "undefined" && cluster ? new ResizeObserver(measure) : null;
    ro?.observe(cluster as Element);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [showContext, phoneVisible]);

  return (
    <>
      {/* Плавающие кнопки над нижней навигацией */}
      {/* Кнопка «Наверх»: как закладка «Фильтры» — торчит из-за левого края экрана (скругление только
          справа, без левой рамки), опущена ниже (исходно 164 → 132). В скрытом виде уезжает за левый край. */}
      <div className="fixed bottom-[132px] left-0 z-40 lg:hidden">
        <button
          type="button"
          aria-label="Наверх"
          onClick={smoothScrollToTop}
          // Срабатываем и на pointerdown: во время инерции прокрутки (Lenis) обычный click
          // «съедается» остановкой инерции — а по нажатию возврат наверх происходит сразу.
          onPointerDown={smoothScrollToTop}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-r-md border border-l-0 border-hairline bg-surface text-ink shadow-card transition-all duration-300",
            showTop && !callbackOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-full opacity-0"
          )}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>

      {/* Плавающий кластер способов связи (WhatsApp/Telegram/Почта/Телефон + «Чат с оператором»).
          Свёрнут в одну круглую кнопку; по тапу раскрывается влево [[contact-fab]]. */}
      <ContactFab phoneVisible={phoneVisible} callbackOpen={callbackOpen} collapsedBottom={clusterBottom} onExpand={() => setPinned(true)} />

      {/* Нижний блок: контекстная кнопка телефона (только каталог) + навигация */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        {/* Контекстная зона над навигацией (только каталог). Белая кнопка «Перезвоните мне»
            остаётся на своём месте ВСЕГДА; синяя подложка и номер телефона появляются
            (при листании вверх) и исчезают вокруг неё, не сдвигая саму кнопку. */}
        {showContext && (
          <div
            ref={zoneRef}
            className={cn(
              // py-3.5 — подложка выше, чтобы «Перезвоните мне» и номер были центрированы по
              // вертикали раскрытой синей подложки (а не прижаты к краям).
              "relative flex items-center justify-between gap-3 px-4 py-3.5 transition-opacity duration-300",
              callbackOpen ? "pointer-events-none opacity-0" : "opacity-100" // прячем, пока открыта панель
            )}
          >
            {/* Синяя подложка — отдельный слой под кнопкой: выезжает снизу и исчезает.
                Обычной высоты (inset-0): кнопка стоит внизу, по её центру. */}
            <div
              className={cn(
                "absolute inset-0 border-t border-hairline bg-primary transition-all duration-300 ease-out",
                phoneVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
              )}
            />
            {/* Белая кнопка «Перезвоните мне» — всегда на месте (shadow-card, чтобы читалась
                и на светлом фоне, когда синяя подложка скрыта). */}
            <button
              ref={btnRef}
              type="button"
              onClick={() => setCallbackOpen(true)}
              // Кнопка двигается ТОЛЬКО по горизонтали. По вертикали никогда не смещается — всегда
              // на нижнем уровне, там же, где в раскрытой синей плашке. Сдвиг вправо (shift) — только
              // при скрытой подложке (встаёт справа, в 12px слева от кластера); при раскрытой — 0
              // (кнопка слева, номер справа). transform анимируем после первого замера.
              style={{
                transform: `translateX(${phoneVisible ? 0 : shift}px)`,
                transition: ready
                  ? "transform 500ms ease-out, border-color 500ms ease-out"
                  : "border-color 500ms ease-out",
              }}
              className={cn(
                // Фиолетово-розовая кнопка с белым текстом (п.1).
                "relative flex items-center gap-2 rounded-full border bg-gradient-to-r from-fuchsia-600 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-card",
                // В правом (сдвинутом) положении — обводка того же фиолетово-розового цвета,
                // пульсирует расходящимся кольцом (п.1).
                phoneVisible ? "border-transparent" : "border-fuchsia-500 animate-cb-outline-pulse-magenta"
              )}
            >
              {/* Иконка трубки вибрирует синхронно с пульсацией кнопки — только когда кнопка
                  пульсирует (в правом сдвинутом положении, т.е. при скрытой синей подложке) (п.4). */}
              <PhoneCall className={cn("h-4 w-4", !phoneVisible && "animate-cb-phone-vibrate")} />
              Перезвоните мне
            </button>
            {/* Номер телефона — уходит ВНИЗ вместе с синей подложкой (те же 300ms/ease-out). */}
            <a
              href={site.phoneHref}
              className={cn(
                "relative flex items-center gap-2 text-base font-semibold text-primary-fg transition-all duration-300 ease-out",
                phoneVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
              )}
            >
              <Phone className="h-5 w-5" /> {site.phone}
            </a>
          </div>
        )}

        {/* Нижняя навигация (только мобильные). id — для замера её высоты панелью обратного звонка. */}
        <nav
          id="mobile-bottom-nav"
          className="border-t border-hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-lg"
        >
          <div className="grid grid-cols-4">
            {items.map(({ label, href, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  // Открытая панель «Перезвоните мне» закрывается сразу при переходе по навигации.
                  onClick={() => setCallbackOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                    active ? "text-primary" : "text-muted"
                  )}
                >
                  <Icon className={cn("h-[22px] w-[22px]", active && "scale-110")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Полноэкранная панель «Перезвоните мне» (между шапкой и нижней навигацией) */}
      <CallbackModal open={callbackOpen} onClose={() => setCallbackOpen(false)} />
    </>
  );
}
