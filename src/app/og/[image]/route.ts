import { ogImagePng } from "@/server/seo/og-image";

/** Share images: /og/<page>-<en|ar>.png (see src/server/seo/og-image.ts). */
export async function GET(_req: Request, { params }: { params: Promise<{ image: string }> }) {
  const { image } = await params;
  const m = /^([a-z-]+)-(en|ar)\.png$/.exec(image);
  const png = m ? ogImagePng(m[1], m[2] as "en" | "ar") : null;
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
