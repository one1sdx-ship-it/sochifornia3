"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Phone, ShieldCheck, X } from "lucide-react";
import { PhoneInput, isPhoneValid, toE164 } from "@/components/phone-input";
import { type CountryCode } from "libphonenumber-js";
import { cn } from "@/lib/utils";
import type { ClientCustomer } from "./customer-auth";

// Модалка упрощённого входа по номеру телефона.
// Шаг 1 — телефон (тот же PhoneInput, что в «Перезвоните мне»), шаг 2 — 4-значный код.
// Пока код фиксированный «7777» (см. /api/customer/auth/*). Отдельного окна регистрации нет:
// новый клиент создаётся автоматически при первом входе.

// z-индекс: карточку держим ниже выпадашки стран из PhoneInput (та рисуется порталом на z-80/81),
// но выше шапки (z-61) и мобильного меню (z-70) — иначе список стран уйдёт под окно.
const Z_BACKDROP = "z-[74]";
const Z_CARD = "z-[75]";

export function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (customer: ClientCustomer) => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [country, setCountry] = useState<CountryCode>("RU");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  const phoneOk = isPhoneValid(country, national);
  const e164 = toE164(country, national);

  // Сброс состояния при каждом открытии.
  useEffect(() => {
    if (!open) return;
    setStep("phone");
    setCode("");
    setStatus("idle");
    setError("");
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Автофокус в поле кода при переходе на шаг 2.
  useEffect(() => {
    if (step === "code") setTimeout(() => codeRef.current?.focus(), 50);
  }, [step]);

  // Шаг 1 → запрос кода.
  async function requestCode() {
    if (!phoneOk || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/customer/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Не удалось отправить код");
        return;
      }
      setStep("code");
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setStatus("idle");
    }
  }

  // Шаг 2 → проверка кода и вход.
  async function verifyCode(value: string) {
    if (value.length !== 4 || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/customer/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Неверный код");
        setCode("");
        codeRef.current?.focus();
        return;
      }
      onSuccess(data.customer as ClientCustomer);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setStatus("idle");
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4">
      {/* Затемнение */}
      <div className={cn("fixed inset-0 bg-black/50 animate-fade-in", Z_BACKDROP)} onClick={onClose} />

      {/* Карточка */}
      <div
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-bg p-6 shadow-float",
          Z_CARD
        )}
      >
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Иконка + заголовок */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            {step === "phone" ? <Phone className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <h3 className="font-display text-xl font-bold text-ink">
            {step === "phone" ? "Вход по телефону" : "Введите код"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {step === "phone"
              ? "Укажите номер — вышлем код для входа"
              : `Код отправлен на ${e164}`}
          </p>
        </div>

        {step === "phone" ? (
          <div className="space-y-3">
            <PhoneInput
              country={country}
              national={national}
              valid={phoneOk}
              onCountryChange={setCountry}
              onNationalChange={setNational}
            />
            {error && <p className="text-center text-sm font-medium text-error">{error}</p>}
            <button
              type="button"
              onClick={requestCode}
              disabled={!phoneOk || status === "loading"}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Получить код"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setCode(v);
                setError("");
                if (v.length === 4) verifyCode(v); // авто-вход при 4 цифрах
              }}
              placeholder="••••"
              className={cn(
                "h-14 w-full rounded-xl border bg-surface-2 text-center text-2xl font-bold tracking-[0.5em] text-ink shadow-inner outline-none transition-colors placeholder:tracking-[0.5em] placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-primary/20",
                error ? "border-error" : "border-hairline focus:border-primary"
              )}
            />
            {error && <p className="text-center text-sm font-medium text-error">{error}</p>}
            {/* Временная подсказка на период тестирования (код пока фиксированный). */}
            <p className="text-center text-xs text-muted">Тестовый код: 7777</p>
            <button
              type="button"
              onClick={() => verifyCode(code)}
              disabled={code.length !== 4 || status === "loading"}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Войти"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
              }}
              className="w-full text-center text-sm font-medium text-muted hover:text-ink"
            >
              Изменить номер
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
