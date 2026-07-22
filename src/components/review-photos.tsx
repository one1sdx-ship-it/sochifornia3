"use client";

import { useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";

// Сетка миниатюр фотографий отзыва. Клик по фото открывает полноэкранный просмотрщик
// [[photo-lightbox]] с зумом, свайпом и лентой-превью — ровно так же, как при обычном
// просмотре фотографий на странице экскурсии (а не открытием файла в новой вкладке).
export function ReviewPhotos({ photos, title }: { photos: string[]; title?: string }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (photos.length === 0) return null;

  return (
    <>
      {/* Фото — по 3 в ряд во всю ширину блока */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`Открыть фото ${i + 1}`}
            className="block aspect-square w-full overflow-hidden rounded-md border border-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {openAt !== null && (
        <PhotoLightbox images={photos} title={title} startIndex={openAt} onClose={() => setOpenAt(null)} />
      )}
    </>
  );
}
