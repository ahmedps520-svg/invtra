import { THEME_KEYS } from "@/lib/themes/types";
import { SAMPLE_LANGS, SAMPLE_QR_TOKENS, parseSampleFile, sampleFileName } from "@/lib/marketing/samples";
import { qrSvg } from "@/lib/qr";
import { sampleCardWebp } from "@/server/seo/sample-card";

const CACHE = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000";

/** Every design in every language (and the sample QR codes) is rendered at build time; occasion variants on first request. */
export function generateStaticParams() {
  return [
    ...THEME_KEYS.flatMap((theme) => SAMPLE_LANGS.map((lang) => ({ file: sampleFileName(theme, lang) }))),
    ...SAMPLE_QR_TOKENS.map((t) => ({ file: `qr-${t}.svg` })),
  ];
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const file = (await params).file;
  const qr = /^qr-([A-Z0-9]{10})\.svg$/.exec(file);
  if (qr && (SAMPLE_QR_TOKENS as readonly string[]).includes(qr[1])) {
    const svg = qrSvg({ text: `HTTPS://INVTRA.STORE/Q/${qr[1]}`, size: 240, style: "rounded", logo: true, fg: "#1e1a16", bg: "#fffdfa" });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE } });
  }
  const spec = parseSampleFile(file);
  if (!spec) return new Response("Not found", { status: 404 });
  const webp = await sampleCardWebp(spec.theme, spec.lang, spec.occasion);
  // Addresses carry ?v=SAMPLE_VERSION, so a design change is a new address.
  return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } });
}
