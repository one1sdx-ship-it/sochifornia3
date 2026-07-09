"use client";

// Нижняя панель (bottom-sheet) — мобильный паттерн: выезжает снизу на весь экран,
// на десктопе — по центру. Внутри — поля раздела и индикатор сохранения.
import type { ReactNode } from "react";
import { X, ChevronLeft } from "lucide-react";
import type { SaveStatus } from "./use-autosave";

export function Sheet({
  open,
  onClose,
  onBack,
  title,
  status,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  status?: SaveStatus;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Закрыть" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <div className="flex min-w-0 items-center gap-1">
            {onBack && (
              <button onClick={onBack} className="-ml-1 rounded-full p-1.5 text-muted hover:bg-surface-2" aria-label="Назад">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h3 className="truncate font-display text-base font-bold text-ink">{title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={status} />
            <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-surface-2" aria-label="Закрыть">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: SaveStatus }) {
  if (!status || status === "idle") return null;
  const map: Record<Exclude<SaveStatus, "idle">, [string, string]> = {
    saving: ["Сохраняю…", "text-muted"],
    saved: ["Сохранено", "text-success"],
    error: ["Оффлайн — сохраню позже", "text-error"],
  };
  const [text, cls] = map[status];
  return <span className={`whitespace-nowrap text-xs font-medium ${cls}`}>{text}</span>;
}
