import type { Metadata } from "next";
import { ShieldCheck, Clock, Wallet, Smile, Award, Heart } from "lucide-react";
import { site } from "@/data/site";
import { PageHeader } from "@/components/page-header";
import { GradientImage } from "@/components/gradient-image";
import { LeadSection } from "@/components/sections/lead-section";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "О компании",
  description: "Sochifornia Travel — более 5 лет организуем экскурсии в Сочи. Более 10 000 довольных туристов. Надёжность, пунктуальность и честные цены.",
};

const values = [
  { icon: ShieldCheck, title: "Надёжность", text: "Проверенный транспорт и опытные водители." },
  { icon: Clock, title: "Пунктуальность", text: "Мы приезжаем вовремя и ценим каждую минуту вашего отпуска." },
  { icon: Wallet, title: "Честные цены", text: "Никаких скрытых доплат. Цена, которую назвали, — окончательная." },
  { icon: Smile, title: "Человечность", text: "Адекватные гиды без хамства и навязчивых продаж. Только забота." },
];

const stats = [
  { value: site.stats.years, label: "лет на рынке Сочи" },
  { value: site.stats.clients, label: "счастливых туристов" },
  { value: site.stats.tours, label: "уникальных маршрутов" },
  { value: site.stats.rating, label: "средний рейтинг" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="О компании"
        title="Мы делаем отдых в Сочи безупречным"
        subtitle={site.tagline}
      />

      <section className="container-wide grid items-center gap-12 py-section-sm lg:grid-cols-2 sm:py-section">
        <Reveal>
          <GradientImage id="grad-sea-2" className="aspect-[4/3] w-full rounded-2xl" label="Команда Sochifornia Travel" />
        </Reveal>
        <Reveal delay={120}>
          <h2 className="font-display text-3xl font-bold text-ink">Наша история</h2>
          <div className="mt-5 space-y-4 text-body">
            <p>
              Более 5 лет назад мы начинали с одной простой идеи: показать гостям Сочи настоящий
              юг — без суеты, обмана и разочарований. С тех пор более 10 000 туристов доверили
              нам свой отдых, и мы благодарны за каждое тёплое слово.
            </p>
            <p>
              Мы знаем Сочи и окрестности как свои пять пальцев: от вершин Красной Поляны до
              тихих бухт и чайных плантаций. И главное — мы любим то, что делаем.
            </p>
            <p>
              Каждый наш маршрут построен вокруг вашего комфорта и впечатлений. Мы убрали всё,
              что обычно портит экскурсии: непунктуальность, скрытые доплаты и равнодушие.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="bg-surface py-section-sm sm:py-section">
        <div className="container-wide">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 60} className="text-center">
                <p className="font-display text-4xl font-bold text-primary sm:text-5xl">{s.value}</p>
                <p className="mt-2 text-sm text-body">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-wide py-section-sm sm:py-section">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink sm:text-4xl">Наши принципы</h2>
          <p className="mt-4 text-lg text-body">То, во что мы верим и что чувствует каждый наш турист.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 60}>
              <div className="h-full rounded-lg border border-hairline bg-surface p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-fg">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink">{v.title}</h3>
                <p className="mt-2 text-sm text-body">{v.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <LeadSection />
    </>
  );
}
