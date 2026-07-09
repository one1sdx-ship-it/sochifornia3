import { Hero } from "@/components/sections/hero";
import { PartnersSection } from "@/components/sections/partners-section";
import { PopularToursSection } from "@/components/sections/popular-tours-section";
import { CategoriesSection } from "@/components/sections/categories-section";
import { WhyUsSection } from "@/components/sections/why-us-section";
import { GallerySection } from "@/components/sections/gallery-section";
import { GuidesSection } from "@/components/sections/guides-section";
import { ReviewsSection } from "@/components/sections/reviews-section";
import { FaqSection } from "@/components/sections/faq-section";
import { LeadSection } from "@/components/sections/lead-section";

// Обновляем данные из БД не чаще раза в минуту (ISR).
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      <PartnersSection />
      {/* Якорь для единой плавающей кнопки «Фильтры» (filter-tab.tsx): она видна на главной,
          пока этот блок с экскурсиями в зоне видимости. */}
      <div id="home-tours-anchor">
        <PopularToursSection />
      </div>
      <CategoriesSection />
      <WhyUsSection />
      <GallerySection />
      <GuidesSection />
      <ReviewsSection />
      <FaqSection />
      <LeadSection />
    </>
  );
}
