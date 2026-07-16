import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Семантические токены завязаны на CSS-переменные (см. globals.css)
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        hairline: "rgb(var(--hairline) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        body: "rgb(var(--body) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        // Бренд
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-fg": "rgb(var(--primary-fg) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        // Дополнительные акценты
        violet: "rgb(var(--violet) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        // Статусы
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
        "2xl": "36px",
      },
      maxWidth: {
        content: "1280px",
        wide: "1440px",
      },
      spacing: {
        section: "96px",
        "section-sm": "64px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(0 0 0 / 0.10)",
        float: "0 8px 40px -12px rgb(0 0 0 / 0.22)",
        nav: "0 -1px 0 rgb(var(--hairline) / 1), 0 -8px 24px -12px rgb(0 0 0 / 0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "slide-in-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-out-down": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "kaifun-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        // Карандаш у кнопки «Изменить»: мягко «пишет» — лёгкое покачивание с наклоном,
        // намекая, что имя можно поправить в любой момент.
        "pencil-wiggle": {
          "0%, 100%": { transform: "rotate(0deg) translateY(0)" },
          "25%": { transform: "rotate(-14deg) translateY(-1px)" },
          "50%": { transform: "rotate(0deg) translateY(0)" },
          "75%": { transform: "rotate(14deg) translateY(-1px)" },
        },
        // Стрелка кнопки «Наверх»: циклично «подпрыгивает» вверх и мягко возвращается,
        // подсказывая, что нажатие вернёт страницу наверх.
        "arrow-hint": {
          "0%, 70%, 100%": { transform: "translateY(0)", opacity: "1" },
          "35%": { transform: "translateY(-4px)", opacity: "0.7" },
        },
        // Звёзды рейтинга в карточке: мягкое мерцание с едва заметным золотым свечением
        // (фаза блеска, волна создаётся каскадом animation-delay на самих звёздах).
        "star-twinkle": {
          "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": {
            transform: "scale(1.18)",
            filter: "brightness(1.15) drop-shadow(0 0 2px rgb(var(--gold) / 0.3))",
          },
        },
        // «Танец» звезды после схлопывания пятёрки: подрастает и, как танцор, поворачивается
        // к зрителю левым, затем правым боком (rotateY с perspective), после — обратно.
        "star-dance": {
          "0%, 100%": { transform: "perspective(120px) scale(1) rotateY(0deg)" },
          "20%": { transform: "perspective(120px) scale(1.3) rotateY(0deg)" },
          "40%": { transform: "perspective(120px) scale(1.34) rotateY(-42deg)" },
          "65%": { transform: "perspective(120px) scale(1.34) rotateY(42deg)" },
          "85%": { transform: "perspective(120px) scale(1.26) rotateY(0deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-right": "slide-in-right 0.3s ease both",
        "slide-out-right": "slide-out-right 0.3s ease forwards",
        "slide-in-left": "slide-in-left 0.3s ease both",
        "slide-out-left": "slide-out-left 0.3s ease forwards",
        marquee: "marquee 14s linear infinite",
        "slide-in-up": "slide-in-up 0.32s cubic-bezier(0.16,1,0.3,1) both",
        "slide-out-down": "slide-out-down 0.32s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.25s ease both",
        "kaifun-pulse": "kaifun-pulse 1.2s ease-in-out infinite",
        "pencil-wiggle": "pencil-wiggle 1.6s ease-in-out infinite",
        "arrow-hint": "arrow-hint 1.5s ease-in-out infinite",
        "star-twinkle": "star-twinkle 1s ease-in-out infinite",
        "star-dance": "star-dance 1.1s ease-in-out both",
      },
    },
  },
  plugins: [],
};

export default config;
