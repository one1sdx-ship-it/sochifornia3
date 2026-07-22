"use client";

// Кнопка «+ Добавить отзыв» + модальная форма ручного заведения отзыва админом.
// Поля: экскурсия, имя, телефон, оценка (звёзды), текст, фото, статус (черновик/опубликован).
// Отправка — через server action createReviewManual (передаётся пропсом).
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Star, X } from "lucide-react";
import { uploadImage } from "@/components/admin/tour-editor/use-autosave";
import { cn } from "@/lib/utils";

type Tour = { id: string; title: string };

export function AddReviewButton({
  tours,
  action,
}: {
  tours: Tour[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRating(5);
    setHover(0);
    setPhotos([]);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) urls.push(await uploadImage(file));
      setPhotos((p) => [...p, ...urls].slice(0, 8));
    } catch {
      /* ошибка загрузки не критична для формы */
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const shown = hover || rating;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Добавить отзыв
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-bg">
          {/* Шапка полноэкранного окна */}
          <div className="flex items-center justify-between border-b border-hairline bg-surface px-4 py-3">
            <h2 className="font-display text-lg font-bold text-ink">Новый отзыв</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted hover:bg-surface-2"
              aria-label="Закрыть"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <form
              action={action}
              onSubmit={() => {
                setOpen(false);
                reset();
              }}
              className="mx-auto w-full max-w-lg space-y-3"
            >
              {/* Экскурсия */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Экскурсия</span>
                <select
                  name="tourId"
                  defaultValue=""
                  className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink outline-none focus:border-primary"
                >
                  <option value="">— без экскурсии —</option>
                  {tours.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </label>

              {/* Имя + телефон */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Имя</span>
                  <input
                    name="name"
                    placeholder="Имя автора"
                    className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink">Телефон</span>
                  <input
                    name="phone"
                    placeholder="+7…"
                    className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink outline-none focus:border-primary"
                  />
                </label>
              </div>

              {/* Оценка */}
              <div>
                <span className="mb-1 block text-sm font-medium text-ink">Оценка</span>
                <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
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
                        <Star className={cn("h-7 w-7 transition-colors", v <= shown ? "fill-gold text-gold" : "text-hairline")} />
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" name="rating" value={rating} />
              </div>

              {/* Текст */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Текст</span>
                <textarea
                  name="text"
                  rows={4}
                  placeholder="Текст отзыва…"
                  className="w-full resize-y rounded-lg border border-hairline bg-surface-2 p-3 text-ink outline-none focus:border-primary"
                />
              </label>

              {/* Фото */}
              <div>
                <span className="mb-1 block text-sm font-medium text-ink">Фото</span>
                <div className="flex flex-wrap gap-2">
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
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline text-muted hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                      <span className="text-[11px]">Фото</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
                </div>
                <input type="hidden" name="photos" value={JSON.stringify(photos)} />
              </div>

              {/* Статус */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Статус</span>
                <select
                  name="status"
                  defaultValue="DRAFT"
                  className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-ink outline-none focus:border-primary"
                >
                  <option value="DRAFT">Черновик</option>
                  <option value="PUBLISHED">Опубликован</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
