"use client";

// Иконка часов внутри блока отзыва + полноэкранное окно истории правок.
// Показывает хронологию снимков (оценка, текст, фото) с отметками времени
// и указанием, что именно изменилось между версиями.
import { useState } from "react";
import { History, Star, X } from "lucide-react";

type Revision = {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  photos: string[];
  createdAt: string | Date;
};

const fmt = (d: string | Date) =>
  new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(d));

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={i < n ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4 text-hairline"} />
      ))}
    </span>
  );
}

export function ReviewHistory({ revisions, author }: { revisions: Revision[]; author: string }) {
  const [open, setOpen] = useState(false);
  const edits = revisions.length - 1; // первая ревизия — создание, дальше правки

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`История правок: ${edits} ${edits === 1 ? "изменение" : "изменений"}`}
        className="inline-flex items-center gap-1 rounded-md border border-hairline px-1.5 py-0.5 text-xs text-muted hover:border-primary hover:text-primary"
      >
        <History className="h-4 w-4" />
        <span>{edits}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-bg">
          {/* Шапка окна */}
          <div className="flex items-center justify-between border-b border-hairline bg-surface px-4 py-3">
            <h2 className="font-display text-lg font-bold text-ink">
              История правок · {author}
              <span className="ml-2 text-sm font-normal text-muted">
                {revisions.length} {revisions.length === 1 ? "версия" : "версий"}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted hover:bg-surface-2"
              aria-label="Закрыть"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Хронология (от новых к старым) */}
          <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
            <ol className="space-y-4">
              {revisions.map((rev, idx) => {
                const num = idx + 1;
                const prev = idx > 0 ? revisions[idx - 1] : null;
                const isFirst = idx === 0;
                // Что изменилось относительно предыдущей версии.
                const ratingChanged = prev && prev.rating !== rev.rating;
                const textChanged = prev && prev.text !== rev.text;
                const added = prev ? rev.photos.filter((u) => !prev.photos.includes(u)).length : 0;
                const removed = prev ? prev.photos.filter((u) => !rev.photos.includes(u)).length : 0;

                return (
                  <li key={rev.id} className="rounded-xl border border-hairline bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {isFirst ? "Создан" : `Правка ${num - 1}`}
                      </span>
                      <span className="text-xs text-muted">{fmt(rev.createdAt)}</span>
                    </div>

                    {/* Что изменилось */}
                    {prev && (ratingChanged || textChanged || added || removed) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {ratingChanged && (
                          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-600">
                            оценка: {prev!.rating}★ → {rev.rating}★
                          </span>
                        )}
                        {textChanged && (
                          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-600">текст изменён</span>
                        )}
                        {added > 0 && (
                          <span className="rounded bg-success/10 px-2 py-0.5 text-success">+{added} фото</span>
                        )}
                        {removed > 0 && (
                          <span className="rounded bg-error/10 px-2 py-0.5 text-error">−{removed} фото</span>
                        )}
                      </div>
                    )}

                    {/* Снимок состояния */}
                    <div className="mt-3">
                      <Stars n={rev.rating} />
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[15px] text-body">{rev.text}</p>

                    {rev.photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {rev.photos.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block aspect-square w-full overflow-hidden rounded-md border border-hairline"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
