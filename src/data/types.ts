export type TourCategory =
  | "mountains"
  | "sea"
  | "city"
  | "nature"
  | "kids"
  | "vip";

export interface Tour {
  id: string; // id записи в БД (нужен для избранного и др. связей)
  slug: string;
  title: string;
  excerpt: string;
  category: TourCategory;
  format: "group" | "individual";
  price: number; // ₽/чел
  durationHours: number;
  startTime: string; // ориентир, точное уточняет менеджер
  rating: number;
  reviewsCount: number;
  seasonal: boolean; // отваливается зимой
  vip: boolean;
  image: string; // заглушка-градиент (id для генерации)
  gallery: string[];
  highlights: string[];
  program: { time: string; title: string; text: string }[];
  included: string[];
  excluded: string[];
  bring: string[];
}

export const categories: {
  id: TourCategory;
  label: string;
  icon: string;
  blurb: string;
}[] = [
  { id: "mountains", label: "Горные", icon: "Mountain", blurb: "Красная Поляна, водопады, каньоны" },
  { id: "sea", label: "Морские", icon: "Sailboat", blurb: "Прогулки на яхте, рыбалка, дельфины" },
  { id: "city", label: "Городские", icon: "Building2", blurb: "Сочи, Адлер, Олимпийский парк" },
  { id: "nature", label: "Природа", icon: "Trees", blurb: "Парки, дендрарий, чайные плантации" },
  { id: "kids", label: "Для детей", icon: "Baby", blurb: "Семейные маршруты и парки развлечений" },
  { id: "vip", label: "VIP", icon: "Crown", blurb: "Индивидуально, с личным гидом и авто" },
];
