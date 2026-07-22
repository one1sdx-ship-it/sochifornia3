"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, LogIn, Star, X } from "lucide-react";
import { useCustomerAuth } from "@/components/auth/customer-auth";
import { uploadReviewImage } from "@/lib/customer-upload";
import { cn } from "@/lib/utils";

// Форма «Оставить отзыв» на странице экскурсии.
// Гость видит приглашение войти; вошедший клиент — форму (оценка, текст, имя, фото).
// Новый/изменённый отзыв уходит на модерацию (DRAFT) и появляется после «Опубликовать».

type ExistingStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;

export function ReviewForm({ tourId }: { tourId: string }) {
  const { customer, openLogin } = useCustomerAuth();

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [existing, setExisting] = useState<ExistingStatus>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Префилл: подтягиваем текущий отзыв клиента об этой экскурсии (если есть).
  useEffect(() => {
    if (!customer) return;
    setName(customer.name || "");
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/reviews?tourId=${tourId}`);
        const data = await res.json();
        if (cancelled || !data.review) return;
        setRating(data.review.rating);
        setText(data.review.text);
        setName(data.review.name || customer.name || "");
        setPhotos(data.review.photos || []);
        setExisting(data.review.status as ExistingStatus);
      } catch {
        /* префилл не критичен */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer, tourId]);

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        urls.push(await uploadReviewImage(file));
      }
      setPhotos((p) => [...p, ...urls].slice(0, 8));
    } catch (e) {
      setError((e as Error).message || "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (status === "loading") return;
    if (rating < 1) return setError("Поставьте оценку");
    if (text.trim().length < 5) return setError("Напишите чуть подробнее");
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/customer/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourId, rating, text: text.trim(), name: name.trim(), photos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить отзыв");
        setStatus("idle");
        return;
      }
      setExisting("DRAFT");
      setStatus("done");
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
      setStatus("idle");
    }
  }

  // ── Гость: приглашение войти ───────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-hairline bg-surface-2 p-8 text-center">
        <h3 className="font-display text-xl font-bold text-ink">Поделитесь впечатлением</h3>
        <p className="mt-2 text-body">Войдите по номеру телефона, чтобы оставить отзыв об этой экскурсии.</p>
        <button
          type="button"
          onClick={openLogin}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white active:scale-95"
        >
          <LogIn className="h-5 w-5" /> Войти, чтобы оставить отзыв
        </button>
      </div>
    );
  }

  // ── Успех: отзыв отправлен на модерацию ────────────────────────────────────
  if (status === "done") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-surface p-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="font-display text-xl font-bold text-ink">Спасибо за отзыв!</h3>
        <p className="mt-2 text-body">
          Он отправлен на модерацию и появится на сайте после проверки администратором.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 rounded-xl border border-hairline bg-surface-2 px-5 py-2.5 text-sm font-semibold text-ink active:scale-95"
        >
          Редактировать
        </button>
      </div>
    );
  }

  // ── Форма ──────────────────────────────────────────────────────────────────
  const shown = hover || rating;
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-surface p-6 sm:p-8">
      <h3 className="font-display text-xl font-bold text-ink">
        {existing ? "Ваш отзыв" : "Оставить отзыв"}
      </h3>
      {existing === "DRAFT" && (
        <p className="mt-1 text-sm text-amber-500">На модерации — виден после проверки.</p>
      )}
      {existing === "PUBLISHED" && (
        <p className="mt-1 text-sm text-success">Опубликован. Изменение снова отправит на модерацию.</p>
      )}

      {/* Оценка звёздами */}
      <div className="mt-4 flex gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 5 }).map((_, i) => {
          const v = i + 1;
          return (
            <button
              key={v}
              type="button"
              aria-label={`Оценка ${v}`}
              onMouseEnter={() => setHover(v)}
              onClick={() => setRating(v)}
              className="p-0.5 active:scale-90"
            >
              <Star className={cn("h-8 w-8 transition-colors", v <= shown ? "fill-gold text-gold" : "text-hairline")} />
            </button>
          );
        })}
      </div>

      {/* Текст */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Расскажите, как прошла экскурсия…"
        className="mt-4 w-full resize-y rounded-xl border border-hairline bg-surface-2 p-3 text-ink shadow-inner outline-none transition-colors placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
      />

      {/* Имя */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Как вас подписать (имя)"
        className="mt-3 w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-ink shadow-inner outline-none transition-colors placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
      />

      {/* Фото */}
      <div className="mt-3 flex flex-wrap gap-2">
        {photos.map((url) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Удалить фото"
              onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
              className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {photos.length < 8 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-[11px]">Фото</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onPickFiles(e.target.files)}
        />
      </div>

      {error && <p className="mt-3 text-sm font-medium text-error">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={status === "loading"}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : existing ? "Обновить отзыв" : "Отправить отзыв"}
      </button>
    </div>
  );
}
