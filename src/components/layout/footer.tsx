import Link from "next/link";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { nav, site } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container-wide grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="font-display text-xl font-bold text-ink">Sochifornia Travel</span>
          <p className="mt-3 max-w-xs text-sm text-body">{site.tagline}</p>
          <div className="mt-5 flex gap-3">
            <SocialLink href={site.social.telegram} label="Telegram">
              <Send className="h-4 w-4" />
            </SocialLink>
            <SocialLink href={site.social.whatsapp} label="WhatsApp">
              <Phone className="h-4 w-4" />
            </SocialLink>
            <SocialLink href={site.social.vk} label="ВКонтакте">
              <span className="text-xs font-bold">VK</span>
            </SocialLink>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Разделы</h4>
          <ul className="mt-4 space-y-2.5">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-body transition-colors hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Контакты</h4>
          <ul className="mt-4 space-y-3 text-sm text-body">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <a href={site.phoneHref} className="hover:text-primary">{site.phone}</a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <a href={`mailto:${site.email}`} className="hover:text-primary">{site.email}</a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              {site.address}
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {site.workingHours}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">О нас в цифрах</h4>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat value={site.stats.years} label="лет на рынке" />
            <Stat value={site.stats.clients} label="туристов" />
            <Stat value={site.stats.tours} label="маршрутов" />
            <Stat value={site.stats.rating} label="рейтинг" />
          </div>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="container-wide flex flex-col items-center justify-between gap-2 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] text-xs text-muted sm:flex-row lg:pb-5">
          <p>© {new Date().getFullYear()} Sochifornia Travel. Все права защищены.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-primary">Политика конфиденциальности</Link>
            <Link href="/offer" className="hover:text-primary">Договор-оферта</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </a>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  // Стиль как в разделе «О компании»: крупное число цветом primary, подпись — body, по центру
  return (
    <div className="text-center">
      <p className="font-display text-4xl font-bold text-primary">{value}</p>
      <p className="mt-2 text-sm text-body">{label}</p>
    </div>
  );
}
