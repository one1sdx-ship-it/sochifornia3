// Центральная конфигурация сайта (заглушки — позже заменит админка/CMS)

export const site = {
  name: "Sochifornia Travel",
  shortName: "Sochifornia",
  tagline: "Самая лучшая и надёжная экскурсионная компания Сочи",
  description:
    "Авторские групповые и индивидуальные экскурсии по Сочи. Надёжно, пунктуально, без скрытых доплат. Оставьте заявку — менеджер перезвонит и подберёт маршрут.",
  url: "https://sochifornia.ru",
  phone: "+7-986-222-82-28",
  phoneHref: "tel:+79862228228",
  whatsapp: "https://wa.me/79862228228",
  telegram: "https://t.me/sochiforniatravel",
  max: "https://max.ru/sochiforniatravel", // заглушка — заменить реальной ссылкой MAX
  workingHours: "Ежедневно с 9:00 до 21:00",
  address: "г. Сочи, бул. Морской, 1",
  email: "fe1z@mail.ru",
  social: {
    vk: "https://vk.com/sochiforniatravel",
    telegram: "https://t.me/sochiforniatravel",
    whatsapp: "https://wa.me/79862228228",
  },
  stats: {
    years: "6+",
    clients: "10 000+",
    tours: "20+",
    rating: "4.9",
  },
} as const;

export const nav = [
  { label: "Каталог", href: "/tours" },
  { label: "О компании", href: "/about" },
  { label: "Гиды", href: "/guides" },
  { label: "Отзывы", href: "/reviews" },
  { label: "Блог", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Контакты", href: "/contacts" },
] as const;

// Нижняя мобильная навигация (по ТЗ: Каталог, Отзывы, Гиды, Контакты)
export const mobileNav = [
  { label: "Каталог", href: "/tours", icon: "Compass" },
  { label: "Отзывы", href: "/reviews", icon: "Star" },
  { label: "Гиды", href: "/guides", icon: "Users" },
  { label: "Контакты", href: "/contacts", icon: "Phone" },
] as const;
