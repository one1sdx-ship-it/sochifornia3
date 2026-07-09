import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { getPublishedSlugs } from "@/data/tours-db";
import { blogPosts } from "@/data/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const tourSlugs = await getPublishedSlugs();

  const staticRoutes = [
    "", "/tours", "/about", "/guides", "/reviews", "/faq", "/contacts", "/blog",
  ].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const tourRoutes = tourSlugs.map((slug) => ({
    url: `${site.url}/tours/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const blogRoutes = blogPosts.map((p) => ({
    url: `${site.url}/blog/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...tourRoutes, ...blogRoutes];
}
