"use client";

// Mobile-first редактор экскурсии: плавающая кнопка → меню разделов → нижние панели.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, Type, LayoutGrid, ListOrdered, Check, X as XIcon, Backpack, Wallet,
  Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, Images, Image as ImageIcon, Loader2,
} from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { cn } from "@/lib/utils";
import { Sheet } from "./sheet";
import { useAutosave, flushQueue, uploadImage, type SavePayload } from "./use-autosave";
import { useInlineEdit } from "./inline-edit";

// ── Типы данных редактора (сериализуемые, приходят с сервера) ──────────
export type EditorBlock = { icon: string; iconType: "LUCIDE" | "CUSTOM"; title: string };
export type EditorPoint = { time: string; title: string; text: string };
export type EditorListItem = { text: string; icon: string | null; iconType: "LUCIDE" | "CUSTOM" };
export type EditorTariff = { label: string; price: number };
export type EditorImage = { url: string; alt: string };

export type EditorTour = {
  id: string;
  title: string;
  excerpt: string;
  adultPrice: number;
  childPrice: number;
  priceSuffix: string;
  gallery: EditorImage[];
  blocks: EditorBlock[];
  program: EditorPoint[];
  included: EditorListItem[];
  excluded: EditorListItem[];
  bring: EditorListItem[];
  tariffs: EditorTariff[];
};

type Section = "hub" | "title" | "photos" | "blocks" | "program" | "included" | "excluded" | "bring" | "price";

// Общие классы (крупные тач-цели, text-base чтобы iOS не зумил при фокусе).
const input = "w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-base text-ink outline-none focus:border-primary";
const iconBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline text-ink disabled:opacity-30 hover:bg-surface-2";
const addBtn = "mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline py-2.5 text-sm font-medium text-primary hover:bg-surface-2";
const smallBtn = "flex h-8 flex-1 items-center justify-center rounded border border-hairline disabled:opacity-30 hover:bg-surface-2";

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

// Кнопка загрузки своей картинки (для иконок блоков и пунктов «что взять»).
function IconUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className={iconBtn} disabled={busy} onClick={() => ref.current?.click()} title="Своя картинка" aria-label="Загрузить свою иконку">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onUploaded(await uploadImage(f));
          } catch (err) {
            alert((err as Error).message);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
    </>
  );
}

export function TourEditLauncher({ tour }: { tour: EditorTour }) {
  const [open, setOpen] = useState<Section | null>(null);
  const router = useRouter();
  const inline = useInlineEdit();

  // Долгое удержание карандаша (0.5с, только палец/стилус — мобильный сценарий)
  // включает/выключает режим мини-карандашей (inline-правка текста на странице).
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  function pressStart(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse") return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      inline.toggle();
    }, 500);
  }
  function pressCancel() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  // При возврате сети — досохраняем очередь.
  useEffect(() => {
    const onOnline = () => flushQueue(tour.id);
    window.addEventListener("online", onOnline);
    onOnline();
    return () => window.removeEventListener("online", onOnline);
  }, [tour.id]);

  // Закрытие всего редактора — обновим страницу, чтобы показать сохранённое.
  function closeAll() {
    setOpen(null);
    router.refresh();
  }

  const hubItems: { key: Section; label: string; icon: typeof Type }[] = [
    { key: "title", label: "Заголовок и описание", icon: Type },
    { key: "photos", label: "Фотографии (карусель)", icon: Images },
    { key: "blocks", label: "4 блока (иконки + текст)", icon: LayoutGrid },
    { key: "program", label: "Программа экскурсии", icon: ListOrdered },
    { key: "included", label: "Что входит", icon: Check },
    { key: "excluded", label: "Не входит", icon: XIcon },
    { key: "bring", label: "Что взять с собой", icon: Backpack },
    { key: "price", label: "Стоимость", icon: Wallet },
  ];

  return (
    <>
      {/* Компактная кнопка редактирования: как кнопка «Наверх» — торчит из-за левого края экрана
          (скругление только справа, без левой рамки), только иконка-карандаш, без подписи.
          Стоит выше кнопки «Наверх» (bottom 147 → 212) [[mobile-nav]].
          Короткий тап — меню разделов; удержание 0.5с (палец) — режим мини-карандашей. */}
      <button
        onClick={() => {
          // После долгого удержания click всё равно прилетает — глотаем его.
          if (longFired.current) {
            longFired.current = false;
            return;
          }
          setOpen("hub");
        }}
        onPointerDown={pressStart}
        onPointerUp={pressCancel}
        onPointerLeave={pressCancel}
        onPointerCancel={pressCancel}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Редактировать"
        className={cn(
          "fixed bottom-[212px] left-0 z-[90] flex h-12 w-12 touch-none select-none items-center justify-center rounded-r-md border border-l-0 border-hairline shadow-card active:scale-95 [-webkit-touch-callout:none]",
          inline.active ? "bg-primary text-white" : "bg-surface text-primary",
        )}
      >
        <Pencil className="h-5 w-5" />
      </button>

      {/* Плашка статуса режима мини-карандашей — над кнопкой, у того же края */}
      {inline.active && (
        <div
          className={cn(
            "fixed bottom-[266px] left-0 z-[90] rounded-r-md border border-l-0 border-hairline bg-surface px-2.5 py-1.5 text-[11px] font-medium shadow-card",
            inline.status === "error"
              ? "text-error"
              : inline.status === "saving"
                ? "text-muted"
                : inline.status === "saved"
                  ? "text-success"
                  : "text-primary",
          )}
        >
          {inline.status === "saving"
            ? "Сохраняется…"
            : inline.status === "error"
              ? "Ошибка — сохраним при сети"
              : inline.status === "saved"
                ? "Сохранено ✓"
                : "Правка текста"}
        </div>
      )}

      {/* Меню разделов */}
      <Sheet open={open === "hub"} onClose={closeAll} title="Что редактируем?">
        <ul className="space-y-1.5">
          {hubItems.map((it) => (
            <li key={it.key}>
              <button
                onClick={() => setOpen(it.key)}
                className="flex w-full items-center gap-3 rounded-lg border border-hairline px-3 py-3 text-left hover:bg-surface-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <it.icon className="h-5 w-5" />
                </span>
                <span className="flex-1 font-medium text-ink">{it.label}</span>
                <ChevronRight className="h-5 w-5 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {open === "title" && <TitleEditor tour={tour} onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "photos" && <GalleryEditor tour={tour} onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "blocks" && <BlocksEditor tour={tour} onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "program" && <ProgramEditor tour={tour} onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "included" && <ListEditor tour={tour} kind="INCLUDED" title="Что входит" onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "excluded" && <ListEditor tour={tour} kind="EXCLUDED" title="Не входит" onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "bring" && <ListEditor tour={tour} kind="BRING" title="Что взять с собой" withIcon onClose={closeAll} onBack={() => setOpen("hub")} />}
      {open === "price" && <PriceEditor tour={tour} onClose={closeAll} onBack={() => setOpen("hub")} />}
    </>
  );
}

// ── Заголовок и описание ──────────────────────────────────────────────
function TitleEditor({ tour, onClose, onBack }: { tour: EditorTour; onClose: () => void; onBack: () => void }) {
  const { save, status } = useAutosave(tour.id, "meta-title");
  const [title, setTitle] = useState(tour.title);
  const [excerpt, setExcerpt] = useState(tour.excerpt);

  function push(next: Partial<{ title: string; excerpt: string }>) {
    const payload: SavePayload = { type: "meta", title: next.title ?? title, excerpt: next.excerpt ?? excerpt };
    save(payload);
  }

  return (
    <Sheet open onClose={onClose} onBack={onBack} title="Заголовок и описание" status={status}>
      <label className="mb-1 block text-sm font-medium text-ink">Название</label>
      <input className={input} value={title} onChange={(e) => { setTitle(e.target.value); push({ title: e.target.value }); }} />
      <label className="mb-1 mt-4 block text-sm font-medium text-ink">Короткое описание</label>
      <textarea className={`${input} min-h-24`} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); push({ excerpt: e.target.value }); }} />
    </Sheet>
  );
}

// ── 4 блока (иконка + заголовок) ──────────────────────────────────────
function BlocksEditor({ tour, onClose, onBack }: { tour: EditorTour; onClose: () => void; onBack: () => void }) {
  const { save, status } = useAutosave(tour.id, "blocks");
  const [blocks, setBlocks] = useState<EditorBlock[]>(tour.blocks);

  function apply(next: EditorBlock[]) {
    setBlocks(next);
    save({ type: "blocks", blocks: next });
  }
  const set = (i: number, patch: Partial<EditorBlock>) => apply(blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  return (
    <Sheet open onClose={onClose} onBack={onBack} title="Блоки под каруселью" status={status}>
      <p className="mb-3 text-xs text-muted">Иконка — имя из набора lucide (например Mountain, Star, Clock). Загрузка своего файла появится на этапе фото.</p>
      <ul className="space-y-3">
        {blocks.map((b, i) => (
          <li key={i} className="rounded-lg border border-hairline p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <DynamicIcon name={b.icon} iconType={b.iconType} className="h-5 w-5" />
              </span>
              <input className={input} placeholder="Заголовок блока" value={b.title} onChange={(e) => set(i, { title: e.target.value })} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input className={input} placeholder="Иконка (имя lucide)" value={b.iconType === "LUCIDE" ? b.icon : ""} onChange={(e) => set(i, { icon: e.target.value, iconType: "LUCIDE" })} />
              <IconUpload onUploaded={(url) => set(i, { icon: url, iconType: "CUSTOM" })} />
              <button className={iconBtn} disabled={i === 0} onClick={() => apply(move(blocks, i, -1))} aria-label="Вверх"><ArrowUp className="h-4 w-4" /></button>
              <button className={iconBtn} disabled={i === blocks.length - 1} onClick={() => apply(move(blocks, i, 1))} aria-label="Вниз"><ArrowDown className="h-4 w-4" /></button>
              <button className={`${iconBtn} text-error`} onClick={() => apply(blocks.filter((_, k) => k !== i))} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>
      <button className={addBtn} onClick={() => apply([...blocks, { icon: "Star", iconType: "LUCIDE", title: "" }])}>
        <Plus className="h-4 w-4" /> Добавить блок
      </button>
    </Sheet>
  );
}

// ── Программа экскурсии ───────────────────────────────────────────────
function ProgramEditor({ tour, onClose, onBack }: { tour: EditorTour; onClose: () => void; onBack: () => void }) {
  const { save, status } = useAutosave(tour.id, "program");
  const [points, setPoints] = useState<EditorPoint[]>(tour.program);

  function apply(next: EditorPoint[]) {
    setPoints(next);
    save({ type: "program", program: next });
  }
  const set = (i: number, patch: Partial<EditorPoint>) => apply(points.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  return (
    <Sheet open onClose={onClose} onBack={onBack} title="Программа экскурсии" status={status}>
      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={i} className="rounded-lg border border-hairline p-3">
            <div className="flex items-center gap-2">
              <input className={`${input} w-28`} placeholder="09:00" value={p.time} onChange={(e) => set(i, { time: e.target.value })} />
              <span className="text-xs text-muted">точка {i + 1}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button className={iconBtn} disabled={i === 0} onClick={() => apply(move(points, i, -1))} aria-label="Вверх"><ArrowUp className="h-4 w-4" /></button>
                <button className={iconBtn} disabled={i === points.length - 1} onClick={() => apply(move(points, i, 1))} aria-label="Вниз"><ArrowDown className="h-4 w-4" /></button>
                <button className={`${iconBtn} text-error`} onClick={() => apply(points.filter((_, k) => k !== i))} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <input className={`${input} mt-2`} placeholder="Заголовок пункта" value={p.title} onChange={(e) => set(i, { title: e.target.value })} />
            <textarea className={`${input} mt-2 min-h-20`} placeholder="Описание пункта" value={p.text} onChange={(e) => set(i, { text: e.target.value })} />
          </li>
        ))}
      </ul>
      <button className={addBtn} onClick={() => apply([...points, { time: "", title: "", text: "" }])}>
        <Plus className="h-4 w-4" /> Добавить точку
      </button>
    </Sheet>
  );
}

// ── Списки: что входит / не входит / что взять ────────────────────────
function ListEditor({
  tour, kind, title, withIcon, onClose, onBack,
}: {
  tour: EditorTour;
  kind: "INCLUDED" | "EXCLUDED" | "BRING";
  title: string;
  withIcon?: boolean;
  onClose: () => void;
  onBack: () => void;
}) {
  const { save, status } = useAutosave(tour.id, `list-${kind}`);
  const initial = kind === "INCLUDED" ? tour.included : kind === "EXCLUDED" ? tour.excluded : tour.bring;
  const [items, setItems] = useState<EditorListItem[]>(initial);

  function apply(next: EditorListItem[]) {
    setItems(next);
    save({ type: "list", kind, items: next });
  }
  const set = (i: number, patch: Partial<EditorListItem>) => apply(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  return (
    <Sheet open onClose={onClose} onBack={onBack} title={title} status={status}>
      {withIcon && <p className="mb-3 text-xs text-muted">Можно задать свою иконку слева (имя lucide). Пусто — будет галочка по умолчанию.</p>}
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="rounded-lg border border-hairline p-2.5">
            <div className="flex items-center gap-2">
              {withIcon && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <DynamicIcon name={it.icon ?? "Check"} iconType={it.iconType} className="h-5 w-5" />
                </span>
              )}
              <input className={input} placeholder="Текст пункта" value={it.text} onChange={(e) => set(i, { text: e.target.value })} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              {withIcon && (
                <input className={input} placeholder="Иконка (имя lucide, необяз.)" value={it.iconType === "LUCIDE" && it.icon ? it.icon : ""} onChange={(e) => set(i, { icon: e.target.value || null, iconType: "LUCIDE" })} />
              )}
              {withIcon && <IconUpload onUploaded={(url) => set(i, { icon: url, iconType: "CUSTOM" })} />}
              <button className={iconBtn} disabled={i === 0} onClick={() => apply(move(items, i, -1))} aria-label="Вверх"><ArrowUp className="h-4 w-4" /></button>
              <button className={iconBtn} disabled={i === items.length - 1} onClick={() => apply(move(items, i, 1))} aria-label="Вниз"><ArrowDown className="h-4 w-4" /></button>
              <button className={`${iconBtn} text-error`} onClick={() => apply(items.filter((_, k) => k !== i))} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>
      <button className={addBtn} onClick={() => apply([...items, { text: "", icon: null, iconType: "LUCIDE" }])}>
        <Plus className="h-4 w-4" /> Добавить пункт
      </button>
    </Sheet>
  );
}

// ── Стоимость ─────────────────────────────────────────────────────────
function PriceEditor({ tour, onClose, onBack }: { tour: EditorTour; onClose: () => void; onBack: () => void }) {
  const { save: saveMeta, status: statusMeta } = useAutosave(tour.id, "meta-price");
  const { save: saveTariffs, status: statusTariffs } = useAutosave(tour.id, "tariffs");
  const [adult, setAdult] = useState(tour.adultPrice);
  const [child, setChild] = useState(tour.childPrice);
  const [suffix, setSuffix] = useState(tour.priceSuffix);
  const [tariffs, setTariffs] = useState<EditorTariff[]>(tour.tariffs);

  function pushMeta(next: Partial<{ adult: number; child: number; suffix: string }>) {
    saveMeta({
      type: "meta",
      adultPrice: next.adult ?? adult,
      childPrice: next.child ?? child,
      priceSuffix: next.suffix ?? suffix,
    });
  }
  function applyTariffs(next: EditorTariff[]) {
    setTariffs(next);
    saveTariffs({ type: "tariffs", tariffs: next });
  }
  const setT = (i: number, patch: Partial<EditorTariff>) => applyTariffs(tariffs.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const status = statusMeta === "saving" || statusTariffs === "saving" ? "saving" : statusMeta === "error" || statusTariffs === "error" ? "error" : statusMeta === "saved" || statusTariffs === "saved" ? "saved" : "idle";

  return (
    <Sheet open onClose={onClose} onBack={onBack} title="Стоимость" status={status}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Взрослый</label>
          <input className={input} inputMode="numeric" value={adult} onChange={(e) => { const v = num(e.target.value); setAdult(v); pushMeta({ adult: v }); }} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Детский</label>
          <input className={input} inputMode="numeric" value={child} onChange={(e) => { const v = num(e.target.value); setChild(v); pushMeta({ child: v }); }} />
        </div>
      </div>
      <label className="mb-1 mt-4 block text-sm font-medium text-ink">Приписка / валюта</label>
      <input className={input} value={suffix} onChange={(e) => { setSuffix(e.target.value); pushMeta({ suffix: e.target.value }); }} />

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-ink">Доп. тарифы (пенсионеры, группа и т.п.)</p>
        <ul className="space-y-2">
          {tariffs.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <input className={input} placeholder="Название" value={t.label} onChange={(e) => setT(i, { label: e.target.value })} />
              <input className={`${input} w-28`} inputMode="numeric" placeholder="Цена" value={t.price} onChange={(e) => setT(i, { price: num(e.target.value) })} />
              <button className={`${iconBtn} text-error`} onClick={() => applyTariffs(tariffs.filter((_, k) => k !== i))} aria-label="Удалить"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <button className={addBtn} onClick={() => applyTariffs([...tariffs, { label: "", price: 0 }])}>
          <Plus className="h-4 w-4" /> Добавить тариф
        </button>
      </div>
    </Sheet>
  );
}

// ── Фотографии (карусель) ─────────────────────────────────────────────
function GalleryEditor({ tour, onClose, onBack }: { tour: EditorTour; onClose: () => void; onBack: () => void }) {
  const { save, status } = useAutosave(tour.id, "gallery");
  const [images, setImages] = useState<EditorImage[]>(tour.gallery);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function apply(next: EditorImage[]) {
    setImages(next);
    save({ type: "gallery", images: next.map((im) => ({ url: im.url, alt: im.alt })) });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: EditorImage[] = [];
      for (const f of Array.from(files)) {
        uploaded.push({ url: await uploadImage(f), alt: "" });
      }
      apply([...images, ...uploaded].slice(0, 100));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Sheet open onClose={onClose} onBack={onBack} title="Фотографии (карусель)" status={status}>
      <p className="mb-3 text-xs text-muted">До 100 фото. Первое фото — обложка. Карусель на странице и в карточке берётся отсюда.</p>
      <button className={addBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Загрузить фото
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {images.map((im, i) => (
            <li key={im.url + i} className="overflow-hidden rounded-lg border border-hairline">
              <div className="relative aspect-square w-full bg-cover bg-center" style={{ backgroundImage: `url("${im.url}")` }}>
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-black/80">обложка</span>}
              </div>
              <div className="flex items-center gap-1 p-1">
                <button className={smallBtn} disabled={i === 0} onClick={() => apply(move(images, i, -1))} aria-label="Раньше"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button className={smallBtn} disabled={i === images.length - 1} onClick={() => apply(move(images, i, 1))} aria-label="Позже"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button className={`${smallBtn} text-error`} onClick={() => apply(images.filter((_, k) => k !== i))} aria-label="Удалить"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
