"use client";

// Кнопка отправки формы с подтверждением (для необратимых действий).
import type { ReactNode } from "react";

export function DangerButton({
  children,
  confirmText,
  className,
}: {
  children: ReactNode;
  confirmText: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
