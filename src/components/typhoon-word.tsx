"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Слово-хамелеон в заголовке: «Тайфун» зачёркивается красной линией по горизонтали, затем слово
// с линией исчезает, после по одной букве слева направо собирается «Кайфун», плавно пульсирует
// (показ ~3с), плавно исчезает — и снова появляется «Тайфун» (~2с). Затем цикл повторяется.
// Цвет «Кайфун» = подложка кнопки «Выбрать экскурсию» (variant primary → bg-primary) = text-primary.

type Phase = "T" | "strike" | "erase" | "K" | "Kout" | "Tin";

// [фаза, длительность в мс]
const SEQUENCE: [Phase, number][] = [
  ["T", 2000], // «Тайфун» показан 2с
  ["strike", 700], // красная линия слева направо
  ["erase", 350], // «Тайфун» + линия исчезают
  ["K", 3000], // «Кайфун»: сборка по буквам + плавная пульсация, всего 3с
  ["Kout", 400], // «Кайфун» плавно исчезает
  ["Tin", 350], // «Тайфун» плавно появляется → далее снова «T»
];

const KAIFUN = ["К", "а", "й", "ф", "у", "н"];

export function TyphoonWord() {
  const [idx, setIdx] = useState(0);
  const phase = SEQUENCE[idx][0];

  useEffect(() => {
    // Уважаем prefers-reduced-motion: не крутим цикл, оставляем статичный «Тайфун»
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % SEQUENCE.length), SEQUENCE[idx][1]);
    return () => clearTimeout(t);
  }, [idx]);

  const tOpacity = phase === "T" || phase === "strike" || phase === "Tin" ? 1 : 0;
  const lineWidth = phase === "strike" || phase === "erase" ? "100%" : "0%";
  const kOn = phase === "K"; // буквы собираются / показаны
  const kRendered = phase === "K" || phase === "Kout"; // слой «Кайфун» на экране (при Kout — исчезает)

  return (
    <span className="relative inline-block align-baseline">
      {/* Невидимая распорка держит ширину места под слово, чтобы «эмоций в Сочи» не смещалось */}
      <span className="invisible" aria-hidden="true">
        Тайфун
      </span>

      {/* Слой «Тайфун» + красная линия зачёркивания (плавно исчезает вместе со словом) */}
      <span className="absolute inset-0 transition-opacity duration-300" style={{ opacity: tOpacity }}>
        <span className="relative inline-block">
          Тайфун
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-[0.62em] h-[0.1em] -translate-y-1/2 rounded-full bg-red-500"
            style={{ width: lineWidth, transition: "width 700ms ease" }}
          />
        </span>
      </span>

      {/* Слой «Кайфун» (цвет как подложка кнопки CTA = text-primary); буквы проявляются слева направо */}
      <span
        className={cn("absolute inset-0 text-primary", kOn && "animate-kaifun-pulse")}
        style={{ opacity: kRendered ? 1 : 0 }}
        aria-hidden="true"
      >
        {KAIFUN.map((ch, i) => (
          <span
            key={i}
            style={{
              opacity: kOn ? 1 : 0,
              transition: "opacity 250ms ease",
              transitionDelay: kOn ? `${i * 90}ms` : "0ms",
            }}
          >
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
