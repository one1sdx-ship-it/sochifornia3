import { partners } from "@/data/content";
import { Reveal } from "@/components/reveal";

// Блок «Нам доверяют отели и курорты Сочи» временно скрыт по просьбе клиента (задача 1).
// Разметка сохранена — чтобы вернуть блок, поставьте SHOW_PARTNERS = true.
const SHOW_PARTNERS = false;

export function PartnersSection() {
  if (!SHOW_PARTNERS) return null;
  return (
    <section className="border-y border-hairline bg-surface py-12">
      <div className="container-wide">
        <Reveal>
          <p className="text-center text-sm font-medium uppercase tracking-wide text-muted">
            Нам доверяют отели и курорты Сочи
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {partners.map((p) => (
              <span key={p} className="font-display text-lg font-semibold text-ink/40 transition-colors hover:text-ink/70">
                {p}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
