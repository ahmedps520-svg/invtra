export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/marketing/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private areas, personal invitation links (/i/, /Q/) and payment links are never indexed.
        disallow: [
          "/dashboard",
          "/admin",
          "/api/",
          "/i/",
          "/Q/",
          "/preview/",
          "/billing/",
          "/pay/",
          "/receipt/",
          "/dev/",
          "/updating-test",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
