import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "@/styles/globals.css";
import { site } from "@/data/site";
import { ThemeProvider } from "@/components/theme-provider";
import { SmoothScroll } from "@/components/smooth-scroll";
import { SplashScreen } from "@/components/splash-screen";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { FilterTab } from "@/components/filter-tab";
import { ChatWidget } from "@/components/chat/chat-widget";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — экскурсии в Сочи от 1000 ₽`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  keywords: ["экскурсии Сочи", "туры Сочи", "морские прогулки Сочи", "Красная Поляна", "индивидуальные экскурсии"],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — экскурсии в Сочи`,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.description },
  robots: { index: true, follow: true },
  alternates: { canonical: site.url },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafa" },
    { media: "(prefers-color-scheme: dark)", color: "#081113" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: site.name,
  description: site.description,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  address: { "@type": "PostalAddress", addressLocality: "Сочи", addressCountry: "RU" },
  openingHours: "Mo-Su 09:00-21:00",
  aggregateRating: { "@type": "AggregateRating", ratingValue: site.stats.rating, reviewCount: 1200 },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ThemeProvider>
          <SmoothScroll />
          <SplashScreen />
          <Header />
          <main>{children}</main>
          <Footer />
          <MobileNav />
          {/* Единая плавающая кнопка «Фильтры» — одна на весь сайт, здесь (в layout) не пересоздаётся
              при переходах, поэтому её положение не «прыгает» между главной и каталогом. */}
          <FilterTab />
          {/* Онлайн-чат с менеджером: окно + поллинг + бейдж (кнопка «Чат» — в [[contact-fab]]) */}
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
