"use client";

// Быстрая inline-правка текста прямо на странице тура (мобильный сценарий):
// долгое удержание (0.5с) кнопки-карандаша включает режим — у редактируемых надписей
// появляются мини-карандаши, тап по ним позволяет править текст на месте.
// ВАЖНО: при просмотре (режим выключен) компоненты рендерят ровно ту же разметку и классы,
// что и раньше, — дизайн страницы не меняется ни на пиксель.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutosave, type SaveStatus } from "./use-autosave";
import type { EditorBlock, EditorListItem, EditorPoint, EditorTour } from "./tour-edit-launcher";

export type InlineListKind = "INCLUDED" | "EXCLUDED" | "BRING";

type MetaPatch = Partial<Pick<EditorTour, "title" | "excerpt" | "adultPrice" | "childPrice" | "priceSuffix">>;

type InlineEditValue = {
  /** Режим мини-карандашей включён */
  active: boolean;
  /** Сводный статус автосохранения inline-правок */
  status: SaveStatus;
  /** Живая копия данных тура (null у посетителей без прав на правку) */
  tour: EditorTour | null;
  toggle: () => void;
  setMeta: (patch: MetaPatch) => void;
  setBlocks: (next: EditorBlock[]) => void;
  setProgram: (next: EditorPoint[]) => void;
  setList: (kind: InlineListKind, next: EditorListItem[]) => void;
};

const INERT: InlineEditValue = {
  active: false,
  status: "idle",
  tour: null,
  toggle: () => {},
  setMeta: () => {},
  setBlocks: () => {},
  setProgram: () => {},
  setList: () => {},
};

const Ctx = createContext<InlineEditValue>(INERT);

export function useInlineEdit() {
  return useContext(Ctx);
}

// Провайдер оборачивает всю страницу тура. Без прав (tour === null) отдаёт «пустой»
// контекст — все Editable-компоненты рендерят обычный статичный текст.
export function InlineEditProvider({ tour, children }: { tour: EditorTour | null; children: ReactNode }) {
  if (!tour) return <Ctx.Provider value={INERT}>{children}</Ctx.Provider>;
  return <ActiveProvider tour={tour}>{children}</ActiveProvider>;
}

function ActiveProvider({ tour: initial, children }: { tour: EditorTour; children: ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [tour, setTour] = useState(initial);
  const tourRef = useRef(initial);

  // Автосейв по разделам — те же payload'ы и очередь, что у панели-редактора.
  const meta = useAutosave(initial.id, "meta-inline");
  const blocks = useAutosave(initial.id, "blocks");
  const program = useAutosave(initial.id, "program");
  const included = useAutosave(initial.id, "list-INCLUDED");
  const excluded = useAutosave(initial.id, "list-EXCLUDED");
  const bring = useAutosave(initial.id, "list-BRING");

  const statuses = [meta.status, blocks.status, program.status, included.status, excluded.status, bring.status];
  const status: SaveStatus = statuses.includes("saving")
    ? "saving"
    : statuses.includes("error")
      ? "error"
      : statuses.includes("saved")
        ? "saved"
        : "idle";

  // После router.refresh сервер пришлёт новый объект tour — подхватываем его только
  // вне режима правки и не во время сохранения (иначе перетрём свежую правку).
  const lastAdopted = useRef(initial);
  useEffect(() => {
    if (lastAdopted.current !== initial && !active && status !== "saving") {
      lastAdopted.current = initial;
      tourRef.current = initial;
      setTour(initial);
    }
  }, [initial, active, status]);

  const toggle = useCallback(() => {
    try {
      navigator.vibrate?.(30); // тактильный отклик на телефоне
    } catch {
      /* не поддерживается — не страшно */
    }
    setActive((v) => !v);
  }, []);

  // Выключили режим — обновляем серверный рендер сохранёнными данными.
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !active) router.refresh();
    wasActive.current = active;
  }, [active, router]);

  // Последний автосейв завершился уже после выключения режима — подтянем свежий рендер ещё раз.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (!active && prevStatus.current === "saving" && status === "saved") router.refresh();
    prevStatus.current = status;
  }, [status, active, router]);

  const update = useCallback((patch: Partial<EditorTour>) => {
    const next = { ...tourRef.current, ...patch };
    tourRef.current = next;
    setTour(next);
    return next;
  }, []);

  const { save: saveMeta } = meta;
  const setMeta = useCallback(
    (patch: MetaPatch) => {
      const next = update(patch);
      saveMeta({
        type: "meta",
        title: next.title,
        excerpt: next.excerpt,
        adultPrice: next.adultPrice,
        childPrice: next.childPrice,
        priceSuffix: next.priceSuffix,
      });
    },
    [update, saveMeta],
  );

  const { save: saveBlocks } = blocks;
  const setBlocks = useCallback(
    (next: EditorBlock[]) => {
      update({ blocks: next });
      saveBlocks({ type: "blocks", blocks: next });
    },
    [update, saveBlocks],
  );

  const { save: saveProgram } = program;
  const setProgram = useCallback(
    (next: EditorPoint[]) => {
      update({ program: next });
      saveProgram({ type: "program", program: next });
    },
    [update, saveProgram],
  );

  const { save: saveIncluded } = included;
  const { save: saveExcluded } = excluded;
  const { save: saveBring } = bring;
  const setList = useCallback(
    (kind: InlineListKind, next: EditorListItem[]) => {
      update(kind === "INCLUDED" ? { included: next } : kind === "EXCLUDED" ? { excluded: next } : { bring: next });
      const save = kind === "INCLUDED" ? saveIncluded : kind === "EXCLUDED" ? saveExcluded : saveBring;
      save({ type: "list", kind, items: next });
    },
    [update, saveIncluded, saveExcluded, saveBring],
  );

  return (
    <Ctx.Provider value={{ active, status, tour, toggle, setMeta, setBlocks, setProgram, setList }}>
      {children}
    </Ctx.Provider>
  );
}

// Поставить курсор в конец редактируемого элемента.
export function focusEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// Круглая мини-кнопка (карандаш / готово / удалить). Позиционирование задаёт вызывающий.
export function ChipButton({
  kind,
  onClick,
  className,
}: {
  kind: "edit" | "done" | "delete";
  onClick: () => void;
  className?: string;
}) {
  const Icon = kind === "edit" ? Pencil : kind === "done" ? Check : Trash2;
  return (
    <button
      type="button"
      aria-label={kind === "edit" ? "Редактировать текст" : kind === "done" ? "Готово" : "Удалить"}
      // preventDefault на pointerdown: не перехватываем фокус (иначе blur поля сработает раньше клика)
      onPointerDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto z-20 flex h-7 w-7 items-center justify-center rounded-full border shadow-card",
        kind === "done"
          ? "border-primary bg-primary text-white"
          : kind === "delete"
            ? "border-hairline bg-surface text-error"
            : "border-hairline bg-surface text-primary",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// Ряд чипов пункта (карандаш/готово + удалить) — справа сверху над пунктом.
export function InlineItemChrome({
  editing,
  onToggle,
  onDelete,
}: {
  editing: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { active } = useInlineEdit();
  if (!active) return null;
  return (
    <span className="pointer-events-auto absolute -top-3 right-0 z-20 flex gap-1.5">
      <ChipButton kind={editing ? "done" : "edit"} onClick={onToggle} />
      <ChipButton
        kind="delete"
        onClick={() => {
          if (window.confirm("Удалить пункт?")) onDelete();
        }}
      />
    </span>
  );
}

// Пунктирная кнопка «Добавить …» — видна только в режиме правки.
export function InlineAdd({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  const { active } = useInlineEdit();
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline py-2.5 text-sm font-medium text-primary",
        className,
      )}
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

// Редактируемая на месте надпись. Вне режима — обычный тег с теми же классами (дизайн 1-в-1).
// В режиме правки текст становится contentEditable: блок растёт с текстом ровно так же,
// как вырос бы от более длинного текста из БД.
export function EditableText({
  as,
  className,
  value,
  editValue,
  onCommit,
  multiline,
  numeric,
  placeholder = "Текст…",
  editing: forced,
}: {
  as?: "span" | "p" | "h1" | "h2" | "h3";
  className?: string;
  value: string;
  /** Текст для правки, если отличается от отображаемого (например «сырая» цена без форматирования) */
  editValue?: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  numeric?: boolean;
  placeholder?: string;
  /** Групповой режим: правкой управляет чип пункта (InlineItemChrome), свой карандаш не рисуем */
  editing?: boolean;
}) {
  const { active } = useInlineEdit();
  const grouped = forced !== undefined;
  const [selfEditing, setSelfEditing] = useState(false);
  const editing = active && (grouped ? !!forced : selfEditing);
  const ref = useRef<HTMLSpanElement>(null);

  // На время правки «замораживаем» children: React не трогает DOM-текст, курсор не прыгает.
  const frozen = useRef(value);
  const wasEditing = useRef(false);
  if (editing && !wasEditing.current) frozen.current = editValue ?? value;
  wasEditing.current = editing;

  // Тег из переменной; каст к "span" только ради типов — рендерится реальный тег.
  const Tag = (as ?? "span") as "span";

  useEffect(() => {
    if (!active) setSelfEditing(false);
  }, [active]);

  if (!active) return <Tag className={className}>{value}</Tag>;

  const readText = () => {
    const raw = (ref.current?.innerText ?? "").replace(/ /g, " "); // NBSP -> обычный пробел
    return (multiline ? raw : raw.replace(/\n+/g, " ")).replace(/\n+$/, "");
  };

  return (
    <Tag className={cn(className, "pointer-events-auto relative")}>
      <span
        ref={ref}
        contentEditable={editing ? "plaintext-only" : undefined}
        suppressContentEditableWarning
        inputMode={numeric ? "numeric" : undefined}
        data-ph={placeholder}
        className={cn(
          "empty:before:opacity-40 empty:before:content-[attr(data-ph)]",
          editing && "rounded-sm outline-none ring-2 ring-primary/50",
        )}
        onInput={() => onCommit(readText())}
        onBlur={grouped ? undefined : () => setSelfEditing(false)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" && !multiline) || e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onClick={(e) => {
          if (editing) e.stopPropagation();
        }}
      >
        {editing ? frozen.current : value}
      </span>
      {!grouped && (
        <ChipButton
          kind={selfEditing ? "done" : "edit"}
          className="absolute -right-1 -top-3"
          onClick={() => {
            if (selfEditing) {
              ref.current?.blur();
              setSelfEditing(false);
            } else {
              setSelfEditing(true);
              requestAnimationFrame(() => ref.current && focusEnd(ref.current));
            }
          }}
        />
      )}
    </Tag>
  );
}
