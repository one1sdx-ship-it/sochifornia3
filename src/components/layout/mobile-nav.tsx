"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Compass, CornerDownLeft, Images, Phone, PhoneCall, Star } from "lucide-react";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";
import { smoothScrollToAnchor, smoothScrollToTop } from "@/components/smooth-scroll";
import {
  CallbackModal,
  CALLBACK_CLOSE_EVENT,
  CALLBACK_NAME_CONFIRM_EVENT,
  CALLBACK_NAME_SUBMIT_EVENT,
} from "@/components/callback-modal";
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
  const router = useRouter();
  const [showTop, setShowTop] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false); // открыта ли панель «Перезвоните мне»
  const [pinned, setPinned] = useState(false); // тап по свёрнутому кластеру навсегда выдвигает синюю подложку (п.2)
  // Показывать ли вместо навигации кнопку «Подтвердить» из панели «Перезвоните мне» (задача 3).
  const [nameConfirm, setNameConfirm] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setNameConfirm(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(CALLBACK_NAME_CONFIRM_EVENT, on);
    return () => window.removeEventListener(CALLBACK_NAME_CONFIRM_EVENT, on);
  }, []);
  const lastY = useRef(0);
  const zoneRef = useRef<HTMLDivElement>(null); // контекстная зона (кнопка + номер) над навигацией
  const btnRef = useRef<HTMLButtonElement>(null); // белая кнопка «Перезвоните мне»
  const [shift, setShift] = useState(0); // на сколько px сдвинуть кнопку вправо, когда подложка скрыта
  const [clusterBottom, setClusterBottom] = useState(80); // нижнее положение кластера: центр по кнопке «Перезвоните мне»
  // Нижнее положение кнопки «Наверх»: обычно 147px, но когда панель с копирайтом (#footer-legal)
  // доезжает до кнопки, та «выталкивается» вверх, оставляя зазор TOP_GAP между собой и панелью.
  const TOP_BASE = 147;
  const TOP_GAP = 12;
  const [topBtnBottom, setTopBtnBottom] = useState(TOP_BASE);
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
      // «Выталкивание» кнопки «Наверх» панелью с копирайтом: как только верх панели поднимается
      // выше исходного низа кнопки (147px от низа экрана), кнопка едет вверх вместе с панелью,
      // сохраняя зазор TOP_GAP. Панель ушла из виду — кнопка возвращается на 147px.
      const legal = document.getElementById("footer-legal");
      if (legal) {
        const fromBottom = window.innerHeight - legal.getBoundingClientRect().top; // верх панели, px от низа экрана
        setTopBtnBottom(Math.max(TOP_BASE, fromBottom + TOP_GAP));
      }
    };
    onScroll(); // первичный расчёт (страница могла открыться уже прокрученной)
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
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

  // Переход по пункту нижней навигации. «Галерея» — якорь на главной: уже на главной скроллим
  // САМИ через Lenis (нативный прыжок по hash во время его инерции перебивается кадровым
  // scrollTo и «не срабатывает», а повторный клик по тому же «/#gallery» Next вообще не
  // прокручивает заново); с других страниц — обычный переход, Next сам прокрутит к якорю.
  const go = (href: string) => {
    setCallbackOpen(false);
    if (href === "/#gallery" && pathname === "/") {
      smoothScrollToAnchor("gallery");
      return;
    }
    router.push(href);
  };

  // Тап должен срабатывать и во время инерции прокрутки, когда браузер «съедает» click, —
  // та же болезнь, что у кнопок «Наверх» и «Фильтры» (см. их pointerdown-обход). Здесь
  // реагируем на pointerup: палец опустили и подняли на пункте почти без смещения — это
  // осознанный тап, переходим сами; заметный увод пальца или pointercancel — это жест
  // прокрутки, ничего не делаем. Последующий click того же тапа гасим флагом; click без
  // pointerup (клавиатура, скринридеры) работает как раньше.
  const tapRef = useRef<{ href: string; y: number } | null>(null);
  const tapFiredRef = useRef(false);
  const onItemPointerDown = (href: string, y: number) => {
    tapRef.current = { href, y };
  };
  const onItemPointerUp = (href: string, y: number) => {
    const tap = tapRef.current;
    tapRef.current = null;
    if (!tap || tap.href !== href) return;
    if (Math.abs(y - tap.y) > 18) return; // палец повело — это прокрутка, не тап (18: тот же
    // допуск на «дрожание» пальца при тапе на фоне инерции, что и TAP_SLOP_PX в [[tap-rescue]])
    tapFiredRef.current = true;
    // Страховка: если браузер click так и не пришлёт, флаг не должен погасить следующий
    // клавиатурный Enter.
    setTimeout(() => (tapFiredRef.current = false), 600);
    go(href);
  };
  const onItemClick = (href: string, e: React.MouseEvent) => {
    if (tapFiredRef.current) {
      tapFiredRef.current = false;
      e.preventDefault(); // переход уже выполнен по pointerup
      return;
    }
    if (href === "/#gallery" && pathname === "/") {
      e.preventDefault(); // клавиатура: якорь на главной тоже ведём через Lenis
      go(href);
      return;
    }
    // Открытая панель «Перезвоните мне» закрывается сразу при переходе по навигации.
    setCallbackOpen(false);
  };

  return (
    <>
      {/* Плавающие кнопки над нижней навигацией */}
      {/* Кнопка «Наверх»: как закладка «Фильтры» — торчит из-за левого края экрана (скругление только
          справа, без левой рамки). Приподнята (132 → 147) и увеличена на 20% (h-10 → h-12).
          В скрытом виде уезжает за левый край. */}
      {/* bottom задаётся инлайном: базовые 147px либо выше — когда панель с копирайтом
          «выталкивает» кнопку. Переход по bottom с лёгкой задержкой: кнопка не дёргается
          синхронно с прокруткой, а мягко «догоняет» панель — и вверх, и вниз. */}
      <div
        style={{ bottom: topBtnBottom }}
        className="fixed left-0 z-40 transition-[bottom] delay-[40ms] duration-500 ease-out lg:hidden"
      >
        <button
          type="button"
          aria-label="Наверх"
          onClick={smoothScrollToTop}
          // Срабатываем и на pointerdown: во время инерции прокрутки (Lenis) обычный click
          // «съедается» остановкой инерции — а по нажатию возврат наверх происходит сразу.
          onPointerDown={smoothScrollToTop}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-r-md border border-l-0 border-hairline bg-surface text-ink shadow-card transition-all duration-300",
            showTop && !callbackOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-full opacity-0"
          )}
        >
          <ArrowUp className="animate-arrow-hint relative top-0.5 h-6 w-6" />
        </button>
      </div>

      {/* Плавающий кластер способов связи (WhatsApp/Telegram/Почта/Телефон + «Чат с оператором»).
          Свёрнут в одну круглую кнопку; по тапу раскрывается влево [[contact-fab]]. */}
      <ContactFab
        phoneVisible={phoneVisible}
        callbackOpen={callbackOpen}
        collapsedBottom={clusterBottom}
        onExpand={() => setPinned(true)}
        // В разделах без синей плашки («Контакты», «Отзывы» и пр.) циклер раскрывается сразу,
        // без ожидания выезда подложки.
        contextAvailable={showContext}
      />

      {/* Нижний блок: контекстная кнопка телефона (только каталог) + навигация.
          pointer-events-none и здесь: прозрачный контейнер сам ловит тапы по всей своей области
          (даже когда дочерняя зона уже pointer-events-none, хит-тест «проваливается» в родителя) —
          и не пускал их к свёрнутому циклеру [[contact-fab]], опущенному на уровень зоны.
          Кликабельность возвращаем навигации (ниже) и точечно кнопке/номеру в зоне. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
        {/* Контекстная зона над навигацией (только каталог). Белая кнопка «Перезвоните мне»
            остаётся на своём месте ВСЕГДА; синяя подложка и номер телефона появляются
            (при листании вверх) и исчезают вокруг неё, не сдвигая саму кнопку. */}
        {showContext && (
          <div
            ref={zoneRef}
            className={cn(
              // py-3.5 — подложка выше, чтобы «Перезвоните мне» и номер были центрированы по
              // вертикали раскрытой синей подложки (а не прижаты к краям).
              // pointer-events-none ВСЕГДА: зона растянута на всю ширину и лежит в DOM позже
              // кластера [[contact-fab]] (тот же z-40) — прозрачный div перехватывал тапы по
              // свёрнутому циклеру, опущенному на её уровень. Кликабельность возвращаем точечно
              // кнопке и номеру ниже (pointer-events-auto).
              "pointer-events-none relative flex items-center justify-between gap-3 px-4 py-3.5 transition-opacity duration-300",
              callbackOpen ? "opacity-0" : "opacity-100" // прячем, пока открыта панель
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
                // whitespace-nowrap — надпись не переносится на 2 строки; text-[clamp(...)] —
                // на широком мобильном держит максимум 0.875rem (как раньше text-sm), а при
                // нехватке ширины (узкие экраны) плавно ужимается до 0.75rem.
                // pointer-events-auto — возвращаем тапы, отключённые на всей зоне (см. выше);
                // пока открыта панель обратного звонка, кнопка скрыта — тапы не нужны.
                "relative flex items-center gap-2 whitespace-nowrap rounded-full border bg-gradient-to-r from-fuchsia-600 to-pink-500 px-4 py-2 text-[clamp(0.75rem,3.4vw,0.875rem)] font-semibold text-white shadow-card",
                !callbackOpen && "pointer-events-auto",
                // В правом (сдвинутом) положении — обводка того же фиолетово-розового цвета,
                // пульсирует расходящимся кольцом (п.1).
                phoneVisible ? "border-transparent" : "border-fuchsia-500 animate-cb-outline-pulse-magenta"
              )}
            >
              {/* Иконка трубки вибрирует ВСЕГДА — и при скрытой, и при выдвинутой синей подложке (п.2). */}
              <PhoneCall className="animate-cb-phone-vibrate h-4 w-4" />
              Перезвоните мне
            </button>
            {/* Номер телефона — уходит ВНИЗ вместе с синей подложкой (те же 300ms/ease-out). */}
            <a
              href={site.phoneHref}
              className={cn(
                // whitespace-nowrap — номер не переносится; text-[clamp(...)] — на широком мобильном
                // максимум 1rem (как раньше text-base), при нехватке ширины ужимается до 0.8125rem.
                // top-[3px] — номер опущен на 3px ниже (п.1); иконку телефона убрали (top не зависит
                // от translate-y, поэтому анимация выезда/ухода вниз сохраняется).
                "relative top-[3px] flex items-center whitespace-nowrap text-[clamp(0.8125rem,3.9vw,1rem)] font-semibold text-primary-fg transition-all duration-300 ease-out",
                // pointer-events-auto только у видимого номера (зона целиком pointer-events-none, см. выше).
                phoneVisible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
              )}
            >
              {site.phone}
            </a>
          </div>
        )}

        {/* Нижняя навигация (только мобильные). id — для замера её высоты панелью обратного звонка. */}
        <div className="relative">
        {/* Кнопка «Подтвердить» из панели «Перезвоните мне» (задача 3): пока введено имя и форма
            не раскрыта, она появляется НАД нижней навигацией, слева, с отступом от левого края
            (pl-8) и зазором до верхнего края панели (pb-6). Появляется плавно (300мс), исчезает
            почти мгновенно (100мс). Сама навигация при этом остаётся на месте. */}
        <div
          aria-hidden={!nameConfirm}
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-full z-10 flex justify-start pb-6 pl-8 transition-opacity ease-out",
            nameConfirm ? "opacity-100 duration-300" : "opacity-0 duration-100"
          )}
        >
          <button
            type="button"
            tabIndex={nameConfirm ? 0 : -1}
            onClick={() => window.dispatchEvent(new Event(CALLBACK_NAME_SUBMIT_EVENT))}
            aria-label="Продолжить"
            // Прежний вид «клавиши» (как когда кнопка стояла в поле имени), увеличенный вдвое:
            // высота 8→16, контур 2→4, скругление 5→10px, нижняя грань-«ступенька» 2→4px,
            // иконка и подпись — тоже вдвое. При нажатии клавиша «проседает».
            className={cn(
              "animate-cb-enter flex h-16 items-center gap-2 rounded-[10px] border-4 border-primary/70 bg-primary/15 px-4 text-primary shadow-[0_4px_0_rgb(var(--primary)/0.45)] active:translate-y-px active:shadow-none",
              nameConfirm && "pointer-events-auto"
            )}
          >
            <CornerDownLeft className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
            <span className="text-[20px] font-extrabold leading-none">Подтвердить</span>
          </button>
        </div>
        <nav
          id="mobile-bottom-nav"
          // pointer-events-auto — возвращаем тапы, отключённые на внешнем контейнере (см. выше).
          className="pointer-events-auto border-t border-hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-lg"
        >
          <div className="grid grid-cols-4">
            {items.map(({ label, href, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onPointerDown={(e) => onItemPointerDown(href, e.clientY)}
                  onPointerUp={(e) => onItemPointerUp(href, e.clientY)}
                  onPointerCancel={() => (tapRef.current = null)}
                  onClick={(e) => onItemClick(href, e)}
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
      </div>

      {/* Полноэкранная панель «Перезвоните мне» (между шапкой и нижней навигацией) */}
      <CallbackModal open={callbackOpen} onClose={() => setCallbackOpen(false)} />
    </>
  );
}
