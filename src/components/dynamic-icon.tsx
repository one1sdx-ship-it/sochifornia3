// Иконка lucide по имени (для 4 блоков и списка «что взять»).
// Если задан свой файл (iconType CUSTOM) — рисуем картинку.
import * as Lucide from "lucide-react";
import type { ComponentType } from "react";

export function DynamicIcon({
  name,
  iconType,
  className,
  fallback = "Check",
}: {
  name: string;
  iconType?: "LUCIDE" | "CUSTOM";
  className?: string;
  fallback?: string;
}) {
  if (iconType === "CUSTOM" && name) {
    // Свой загруженный файл (url). Загрузка появится на этапе фото.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={name} alt="" className={className} />;
  }
  const icons = Lucide as unknown as Record<string, ComponentType<{ className?: string }>>;
  const Cmp = icons[name] ?? icons[fallback] ?? Lucide.Check;
  return <Cmp className={className} />;
}
