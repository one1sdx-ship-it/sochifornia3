"use client";

// Клиентские секции страницы тура с поддержкой быстрой inline-правки (мини-карандаши).
// ВАЖНО: в режиме просмотра разметка и классы 1-в-1 повторяют прежнюю серверную вёрстку
// из src/app/tours/[slug]/page.tsx — дизайн страницы не меняется.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X as XIcon } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { cn, formatPrice } from "@/lib/utils";
import { EditableText, InlineAdd, InlineItemChrome, focusEnd, useInlineEdit } from "./inline-edit";
import type { EditorBlock, EditorListItem, EditorPoint } from "./tour-edit-launcher";

// Обёртка пункта коллекции: чипы «карандаш/готово + удалить» справа сверху,
// все поля пункта редактируются разом (групповой режим EditableText).
function ItemShell({
  as,
  className,
  onDelete,
  children,
}: {
  as?: "div" | "li";
  className?: string;
  onDelete: () => void;
  children: (editing: boolean) => ReactNode;
}) {
  const { active } = useInlineEdit();
  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Тег из переменной; каст к "div" только ради типов — рендерится реальный тег.
  const Tag = (as ?? "div") as "div";

  useEffect(() => {
    if (!active) setEditing(false);
  }, [active]);

  // Вошли в правку пункта — фокус в первое редактируемое поле.
  useEffect(() => {
    if (!editing) return;
    const el = rootRef.current?.querySelector<HTMLElement>("[contenteditable]");
    if (el) focusEnd(el);
  }, [editing]);

  return (
    <Tag ref={rootRef} className={cn(className, active && "relative")}>
      {children(active && editing)}
      <InlineItemChrome editing={editing} onToggle={() => setEditing((v) => !v)} onDelete={onDelete} />
    </Tag>
  );
}

// ── 4 блока под каруселью (иконка + заголовок) ────────────────────────
export function TourBlocksGrid({ blocks: fallback }: { blocks: EditorBlock[] }) {
  const ctx = useInlineEdit();
  const blocks = ctx.tour?.blocks ?? fallback;
  const set = (i: number, patch: Partial<EditorBlock>) =>
    ctx.setBlocks(blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {blocks.map((b, i) => (
        <ItemShell
          key={i}
          className="rounded-lg border border-hairline bg-surface p-4"
          onDelete={() => ctx.setBlocks(blocks.filter((_, k) => k !== i))}
        >
          {(editing) => (
            <>
              <DynamicIcon name={b.icon} iconType={b.iconType} className="h-5 w-5 text-primary" />
              <EditableText
                as="p"
                className="mt-2 text-sm font-medium text-ink"
                value={b.title}
                editing={editing}
                onCommit={(v) => set(i, { title: v })}
                placeholder="Заголовок блока"
              />
            </>
          )}
        </ItemShell>
      ))}
      <InlineAdd
        label="Добавить блок"
        className="min-h-[88px]"
        onClick={() => ctx.setBlocks([...blocks, { icon: "Star", iconType: "LUCIDE", title: "" }])}
      />
    </div>
  );
}

// ── Программа экскурсии (таймлайн) ────────────────────────────────────
export function TourProgram({ program: fallback }: { program: EditorPoint[] }) {
  const ctx = useInlineEdit();
  const program = ctx.tour?.program ?? fallback;
  const set = (i: number, patch: Partial<EditorPoint>) =>
    ctx.setProgram(program.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  return (
    <>
      <ol className="relative mt-6 space-y-6 pl-[26px] before:absolute before:left-[4px] before:top-0 before:bottom-0 before:w-0.5 before:bg-hairline before:content-['']">
        {program.map((step, i) => (
          <ItemShell
            as="li"
            key={i}
            className="relative"
            onDelete={() => ctx.setProgram(program.filter((_, k) => k !== i))}
          >
            {(editing) => (
              <>
                <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-bg">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <EditableText
                  as="p"
                  className="text-sm font-semibold text-primary"
                  value={step.time}
                  editing={editing}
                  onCommit={(v) => set(i, { time: v })}
                  placeholder="09:00"
                />
                <EditableText
                  as="h3"
                  className="mt-0.5 font-display text-lg font-semibold text-ink"
                  value={step.title}
                  editing={editing}
                  onCommit={(v) => set(i, { title: v })}
                  placeholder="Заголовок пункта"
                />
                <EditableText
                  as="p"
                  className="mt-1 text-body"
                  value={step.text}
                  multiline
                  editing={editing}
                  onCommit={(v) => set(i, { text: v })}
                  placeholder="Описание пункта"
                />
              </>
            )}
          </ItemShell>
        ))}
      </ol>
      <InlineAdd
        label="Добавить точку"
        className="mt-4"
        onClick={() => ctx.setProgram([...program, { time: "", title: "", text: "" }])}
      />
    </>
  );
}

// ── Карточка «Что входит» / «Не входит» ───────────────────────────────
export function TourChecklistCard({
  kind,
  title,
  items: fallback,
}: {
  kind: "INCLUDED" | "EXCLUDED";
  title: string;
  items: EditorListItem[];
}) {
  const ctx = useInlineEdit();
  const items = ctx.tour ? (kind === "INCLUDED" ? ctx.tour.included : ctx.tour.excluded) : fallback;
  const Icon = kind === "INCLUDED" ? Check : XIcon;
  const iconCls = kind === "INCLUDED" ? "text-success" : "text-error";
  const setText = (i: number, v: string) =>
    ctx.setList(kind, items.map((it, k) => (k === i ? { ...it, text: v } : it)));

  return (
    <div className="rounded-lg border border-hairline bg-surface p-6">
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <ItemShell
            as="li"
            key={i}
            className="flex items-start gap-2.5 text-sm text-body"
            onDelete={() => ctx.setList(kind, items.filter((_, k) => k !== i))}
          >
            {(editing) => (
              <>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} />
                <EditableText
                  as="span"
                  className="min-w-0 flex-1"
                  value={item.text}
                  editing={editing}
                  onCommit={(v) => setText(i, v)}
                  placeholder="Текст пункта"
                />
              </>
            )}
          </ItemShell>
        ))}
      </ul>
      <InlineAdd
        label="Добавить пункт"
        className="mt-3"
        onClick={() => ctx.setList(kind, [...items, { text: "", icon: null, iconType: "LUCIDE" }])}
      />
    </div>
  );
}

// ── «Что взять с собой» (плитки с иконками) ───────────────────────────
export function TourBringList({ items: fallback }: { items: EditorListItem[] }) {
  const ctx = useInlineEdit();
  const items = ctx.tour?.bring ?? fallback;
  const setText = (i: number, v: string) =>
    ctx.setList("BRING", items.map((it, k) => (k === i ? { ...it, text: v } : it)));

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {items.map((it, i) => (
        <ItemShell
          as="li"
          key={i}
          className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-body"
          onDelete={() => ctx.setList("BRING", items.filter((_, k) => k !== i))}
        >
          {(editing) => (
            <>
              <DynamicIcon
                name={it.icon ?? "Check"}
                iconType={it.iconType}
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              />
              <EditableText
                as="span"
                className="min-w-0 flex-1"
                value={it.text}
                editing={editing}
                onCommit={(v) => setText(i, v)}
                placeholder="Текст пункта"
              />
            </>
          )}
        </ItemShell>
      ))}
      {ctx.active && (
        <li>
          <InlineAdd
            label="Добавить пункт"
            className="h-full min-h-[46px]"
            onClick={() => ctx.setList("BRING", [...items, { text: "", icon: null, iconType: "LUCIDE" }])}
          />
        </li>
      )}
    </ul>
  );
}

// ── Заголовок и описание в hero (правятся по одному, со своим карандашом) ──
export function EditableMetaText({
  field,
  value,
  as,
  className,
  multiline,
  placeholder,
}: {
  field: "title" | "excerpt";
  value: string;
  as?: "h1" | "p";
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ctx = useInlineEdit();
  return (
    <EditableText
      as={as ?? "p"}
      className={className}
      multiline={multiline}
      placeholder={placeholder}
      value={ctx.tour ? ctx.tour[field] : value}
      onCommit={(v) => ctx.setMeta(field === "title" ? { title: v } : { excerpt: v })}
    />
  );
}

// ── Цена «от» в карточке стоимости: показываем форматированную, правим «сырое» число ──
export function EditablePrice({ value, className }: { value: number; className?: string }) {
  const ctx = useInlineEdit();
  const price = ctx.tour ? ctx.tour.adultPrice : value;
  return (
    <EditableText
      as="p"
      className={className}
      value={formatPrice(price)}
      editValue={String(price)}
      numeric
      placeholder="0"
      onCommit={(v) => ctx.setMeta({ adultPrice: Math.max(0, Math.round(Number(v.replace(/[^\d]/g, "")) || 0)) })}
    />
  );
}
