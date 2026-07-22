"use client";

import { Heart } from "lucide-react";
import { useCustomerAuth } from "@/components/auth/customer-auth";
import { useFavorite } from "@/lib/customer-favorites";
import { cn } from "@/lib/utils";

// Кнопка «в избранное». Гость → открывает окно входа; вошедший → переключает избранное.
// Ставится поверх фото карточки/страницы тура (поэтому гасит всплытие клика на ссылку карточки).
export function FavoriteButton({ tourId, className }: { tourId: string; className?: string }) {
  const { customer, openLogin } = useCustomerAuth();
  const enabled = Boolean(customer);
  const { favorited, toggle } = useFavorite(tourId, enabled);

  return (
    <button
      type="button"
      aria-label={favorited ? "Убрать из избранного" : "В избранное"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (customer) toggle();
        else openLogin();
      }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-transform active:scale-90",
        className
      )}
    >
      <Heart className={cn("h-5 w-5 transition-colors", favorited && "fill-error text-error")} />
    </button>
  );
}
