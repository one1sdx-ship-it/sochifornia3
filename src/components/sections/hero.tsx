import { ChevronRight, ShieldCheck, Clock, HeartHandshake } from "lucide-react";
import { site } from "@/data/site";
import { Button } from "@/components/ui/button";

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

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Откройте Сочи
            <br />
            <span className="bg-gradient-to-r from-white to-accent/90 bg-clip-text text-transparent">
              с лучшими гидами
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">
            Авторские морские, горные и городские экскурсии.
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
  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
      <Icon className="h-6 w-6 shrink-0 text-accent" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-white/80">{text}</p>
      </div>
    </li>
  );
}
