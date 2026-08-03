import type { MetadataRoute } from "next";

const siteUrl = "https://cognitwistai.duckdns.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
