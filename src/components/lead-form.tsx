"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLeadData, setLeadField } from "@/components/lead-store";

// Форма заявки. Поля: имя, телефон, кол-во человек + скрытое название экскурсии.
// Значения берутся из общего хранилища [[lead-store]] — основная и полноэкранная панели
// заявки [[lead-overlay]] всегда синхронны, а введённое сохраняется в localStorage при каждом
// символе. compact — одна колонка (узкая колонка / оверлей).
export function LeadForm({
  tourTitle,
  className,
  compact = false,
}: {
  tourTitle?: string;
  className?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const data = useLeadData();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    // Заглушка отправки — позже подключим API/CRM
    await new Promise((r) => setTimeout(r, 900));
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className={cn("rounded-lg border border-hairline bg-surface p-8 text-center", className)}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="font-display text-xl font-semibold text-ink">Заявка принята!</h3>
        <p className="mt-2 text-body">
          Менеджер перезвонит вам в ближайшее время, уточнит детали и подберёт удобную дату.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("rounded-lg border border-hairline bg-surface p-6 shadow-card sm:p-8", className)}
    >
      {tourTitle && (
        <div className="mb-5 rounded-md bg-primary/10 px-4 py-3 text-sm text-ink">
          Заявка на экскурсию: <span className="font-semibold">{tourTitle}</span>
        </div>
      )}
      <input type="hidden" name="tour" value={tourTitle ?? "Общая заявка"} />
      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <Field
          label="Ваше имя"
          name="name"
          placeholder="Как к вам обращаться"
          required
          value={data.name}
          onChange={(v) => setLeadField("name", v)}
        />
        <Field
          label="Телефон"
          name="phone"
          type="tel"
          placeholder="+7 (___) ___-__-__"
          required
          value={data.phone}
          onChange={(v) => setLeadField("phone", v)}
        />
      </div>
      <div className="mt-4">
        <Field
          label="Количество человек"
          name="people"
          type="number"
          placeholder="2"
          min={1}
          value={data.people}
          onChange={(v) => setLeadField("people", v)}
        />
      </div>
      <Button type="submit" size="lg" className="mt-6 w-full">
        {status === "loading" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Отправляем…
          </>
        ) : (
          "Оставить заявку"
        )}
      </Button>
      <p className="mt-3 text-center text-xs text-muted">
        Нажимая кнопку, вы соглашаетесь с обработкой персональных данных. Дату уточнит менеджер.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-md border border-hairline bg-bg px-4 text-ink outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
