import { ShieldCheck, Clock, Wallet, Smile, Award, MapPin } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Reveal } from "@/components/reveal";

const reasons = [
  { icon: ShieldCheck, title: "Надёжность", text: "Проверенный транспорт на каждой экскурсии. Вы под защитой." },
  { icon: Clock, title: "Пунктуальность", text: "Забираем точно в оговорённое время. Ценим ваш отдых и не заставляем ждать." },
  { icon: Wallet, title: "Без скрытых доплат", text: "Цена, которую назвали, — финальная. Никаких сюрпризов на маршруте." },
  { icon: Smile, title: "Адекватные гиды", text: "Влюблённые в Сочи профессионалы. Внимательные, без хамства и навязывания." },
  { icon: Award, title: "Опыт 6+ лет", text: "Более 10 000 туристов уже доверили нам свой отдых. Знаем каждый маршрут." },
  { icon: MapPin, title: "Локальная экспертиза", text: "Покажем не только открытки, но и места, которые знают только местные." },
];

export function WhyUsSection() {
  return (
    <section className="bg-surface py-section-sm sm:py-section">
      <div className="container-wide">
        <SectionHeading
          eyebrow="Почему выбирают нас"
          title="Отдых без единого повода для тревоги"
          subtitle="Мы убрали всё, что обычно портит впечатление от экскурсий. Осталось только удовольствие."
          align="center"
        />
        <div className="mx-auto mt-12 grid max-w-5xl gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r, i) => (
            <Reveal key={r.title} delay={i * 50} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-fg">
                <r.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-body">{r.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
