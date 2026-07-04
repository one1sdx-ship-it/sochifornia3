import { ChevronRight, ShieldCheck, Clock, HeartHandshake } from "lucide-react";
import { site } from "@/data/site";
import { Button } from "@/components/ui/button";
import { TyphoonWord } from "@/components/typhoon-word";

export function Hero() {
  return (
    <section className="relative">
      <div className="absolute inset-0 bg-ink">
        {/* Главное фото: на мобильных помещается целиком по вертикали (auto 100%),
            по горизонтали смещено к 85% (немного отодвинуто от правого края);
            на десктопе — целиком по горизонтали (100% auto). */}
        <div
          className="h-full w-full bg-[position:85%_50%] bg-no-repeat bg-[length:auto_100%] md:bg-bottom md:bg-[length:100%_auto]"
          style={{ backgroundImage: 'url("/glavnaya.jpg")' }}
          role="img"
          aria-label="Сочи"
        />
        {/* затемнение для читабельности текста поверх */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/40" />
      </div>

      <div className="container-wide relative flex min-h-[92vh] flex-col justify-start pb-16 pt-8 text-white sm:min-h-[88vh] sm:pt-10">
        <div className="max-w-3xl animate-fade-up">
          <span className="flex w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm sm:inline-flex sm:w-auto sm:justify-start">
            <span className="h-2 w-2 rounded-full bg-success" />
            {site.stats.years} лет · {site.stats.clients} счастливых туристов
          </span>

          {/* Заголовок выровнен по ширине (justify + text-align-last: justify — тянется на всю
              ширину контейнера). Размер увеличен через clamp. Между словами — двойной пробел
              (word-spacing ≈ ширина второго пробела). Первое слово анимируется (см. TyphoonWord). */}
          <h1 className="mt-6 whitespace-nowrap font-display text-[clamp(1.8rem,8vw,4.5rem)] font-bold leading-[1.1] tracking-tight text-justify [text-align-last:justify] [word-spacing:0.25em]">
            <TyphoonWord /> эмоций в Сочи
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">
            Накроет волной{" "}
            <span className="animate-subtle-shake font-medium text-[#5CC6E4]">твоих лучших впечатлений</span>
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="/tours" size="lg" className="group">
              Выбрать экскурсию
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

          <ul className="mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            <Trust icon={ShieldCheck} title="Незабываемо" text="Наша ответственность – ваши эмоции" />
            <Trust icon={Clock} title="Пунктуально" text="Забираем точно в срок от отеля" />
            <Trust icon={HeartHandshake} title="Честно" text="Никаких скрытых доплат" />
          </ul>
        </div>
      </div>
    </section>
  );
}

function Trust({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  // Полупрозрачная подложка бейджа: на мобильных заметно выше по вертикали (~+20%) — py-3.5; на sm+ py-4
  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm sm:py-4">
      <Icon className="h-6 w-6 shrink-0 text-accent" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-white/80">{text}</p>
      </div>
    </li>
  );
}
