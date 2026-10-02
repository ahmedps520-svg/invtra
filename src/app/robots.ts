export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/marketing/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private areas and personal invitation links (/i/, /Q/) are never indexed.
        disallow: ["/dashboard", "/admin", "/api/", "/i/", "/Q/", "/preview/", "/billing/", "/dev/"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
