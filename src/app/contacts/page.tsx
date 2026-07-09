import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Phone, Clock } from "lucide-react";
import { site } from "@/data/site";
import { PageHeader } from "@/components/page-header";
import { LeadForm } from "@/components/lead-form";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Контакты",
  description: `Свяжитесь с Sochifornia Travel: ${site.phone}, ежедневно с 9:00 до 21:00. Оставьте заявку — менеджер перезвонит.`,
};

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Контакты"
        title="Свяжитесь с нами"
        subtitle="Позвоните, напишите в мессенджер или оставьте заявку — ответим быстро и по делу."
      />

      <section className="container-wide grid gap-12 pb-section-sm pt-6 lg:grid-cols-2 sm:pb-section sm:pt-8">
        <Reveal>
          <div className="space-y-[0.45rem]">
            <ContactItem badge={<PhoneBadge />} title="Телефон" value={site.phone} href={site.phoneHref} />
            <ContactItem badge={<WhatsAppBadge />} title="WhatsApp" value="Написать в WhatsApp" href={site.whatsapp} />
            <ContactItem badge={<TelegramBadge />} title="Telegram" value="@sochiforniatravel" href={site.telegram} />
            <ContactItem badge={<GmailBadge />} title="Email" value={site.email} href={`mailto:${site.email}`} />
            <ContactItem badge={<ClockBadge />} title="Режим работы" value={site.workingHours} />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <h2 className="mb-5 font-display text-2xl font-bold text-ink">Оставьте заявку</h2>
          <LeadForm />
        </Reveal>
      </section>
    </>
  );
}

function ContactItem({
  badge,
  title,
  value,
  href,
}: {
  badge: ReactNode;
  title: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-4 rounded-lg border border-hairline bg-surface px-5 py-4 transition-colors hover:border-primary/40">
      {badge}
      <div>
        <p className="text-sm text-muted">{title}</p>
        <p className="font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
  if (href) {
    const external = href.startsWith("http");
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="block">
        {body}
      </a>
    );
  }
  return body;
}

// Общая обёртка бейджа иконки (48×48, скруглённый квадрат)
const badgeClass = "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl";

// Телефон — жёлтый бейдж, белая трубка
function PhoneBadge() {
  return (
    <span className={`${badgeClass} bg-amber-400 text-white`}>
      <Phone className="h-6 w-6" />
    </span>
  );
}

// WhatsApp — зелёный бейдж, белый фирменный логотип
function WhatsAppBadge() {
  return (
    <span className={`${badgeClass} bg-[#25D366]`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#fff" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411z"/>
      </svg>
    </span>
  );
}

// Telegram — синий бейдж, белый самолётик
function TelegramBadge() {
  return (
    <span className={`${badgeClass} bg-[#229ED9]`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#fff" aria-hidden="true">
        <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931l3.622-16.972.001-.001c.321-1.496-.541-2.081-1.527-1.714L2.334 10.163c-1.453.564-1.431 1.374-.247 1.741l5.443 1.693 12.643-7.911c.595-.394 1.136-.176.691.218z"/>
      </svg>
    </span>
  );
}

// Email — иконка Gmail: белый фон + красная «M» (2 цвета)
function GmailBadge() {
  return (
    <span className={`${badgeClass} bg-white ring-1 ring-hairline`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
        <path
          d="M4 18V8l8 5 8-5v10"
          stroke="#EA4335"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// Режим работы — фиолетовый бейдж (отличается от 4 иконок выше)
function ClockBadge() {
  return (
    <span className={`${badgeClass} bg-violet-500 text-white`}>
      <Clock className="h-6 w-6" />
    </span>
  );
}
