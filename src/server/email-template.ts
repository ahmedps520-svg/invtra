import { appUrl, env } from "@/server/env";

/**
 * INVTRA's email design: ivory paper, a bronze ornament, the logo, serif titles and a dark pill
 * button — the same look as the site. Table-based and inline-styled so it holds up in Gmail,
 * Outlook and Apple Mail; Arabic emails are right-to-left. Every value is escaped.
 */

export type EmailLang = "en" | "ar";
/** Inline text: plain, bold, or a link. */
export type Seg = string | { b: string } | { a: string; href: string };

export type EmailBlock =
  | { kind: "p"; text: Seg[] | string; muted?: boolean }
  | { kind: "image"; src: string; alt: string; width: number; href?: string; caption?: string }
  | { kind: "details"; rows: { label: string; value: string }[] }
  | { kind: "amount"; label: string; value: string; note?: string }
  | { kind: "button"; label: string; href: string; fallback?: string }
  | { kind: "secondary"; label: string; href: string }
  | { kind: "box"; title: string; text?: Seg[] | string; rows?: { label: string; value: string; ltr?: boolean }[]; footer?: Seg[] | string }
  | { kind: "divider" };

export type EmailContent = {
  lang: EmailLang;
  /** The grey line inboxes show after the subject. */
  preheader: string;
  eyebrow?: string;
  title: string;
  blocks: EmailBlock[];
};

const C = {
  page: "#f3ede4",
  paper: "#fffdfa",
  soft: "#faf6ef",
  line: "#e8dfd2",
  hair: "#efe8dd",
  ink: "#1e1a16",
  text: "#4a433c",
  muted: "#8a8178",
  bronze: "#84664a",
  accent: "#a08060",
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const nl2br = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

function fonts(lang: EmailLang) {
  return lang === "ar"
    ? { display: "'Amiri', 'Times New Roman', serif", body: "'IBM Plex Sans Arabic', Tahoma, 'Segoe UI', Arial, sans-serif" }
    : { display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif", body: "'Jost', 'Helvetica Neue', Helvetica, Arial, sans-serif" };
}

function segs(text: Seg[] | string): string {
  const parts = typeof text === "string" ? [text] : text;
  return parts
    .map((s) =>
      typeof s === "string"
        ? nl2br(s)
        : "b" in s
          ? `<strong style="color:${C.ink};font-weight:600">${nl2br(s.b)}</strong>`
          : `<a href="${escapeHtml(s.href)}" style="color:${C.bronze};text-decoration:underline">${nl2br(s.a)}</a>`,
    )
    .join("");
}

function segsText(text: Seg[] | string): string {
  const parts = typeof text === "string" ? [text] : text;
  return parts.map((s) => (typeof s === "string" ? s : "b" in s ? s.b : `${s.a} (${s.href})`)).join("");
}

function block(b: EmailBlock, lang: EmailLang): string {
  const f = fonts(lang);
  const align = lang === "ar" ? "right" : "left";
  switch (b.kind) {
    case "p":
      return `<p style="margin:0 0 16px;font-family:${f.body};font-size:${b.muted ? 13 : 15}px;line-height:1.7;color:${b.muted ? C.muted : C.text};text-align:${align}">${segs(b.text)}</p>`;
    case "image": {
      const img = `<img src="${escapeHtml(b.src)}" width="${b.width}" alt="${escapeHtml(b.alt)}" style="display:block;width:${b.width}px;max-width:100%;height:auto;border:1px solid ${C.line};border-radius:14px">`;
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td align="center">` +
        (b.href ? `<a href="${escapeHtml(b.href)}" style="text-decoration:none">${img}</a>` : img) +
        (b.caption ? `<p style="margin:10px 0 0;font-family:${f.body};font-size:12px;color:${C.muted}">${nl2br(b.caption)}</p>` : "") +
        `</td></tr></table>`
      );
    }
    case "details":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${C.soft};border:1px solid ${C.line};border-radius:14px">` +
        b.rows
          .map(
            (r, i) =>
              `<tr><td style="padding:12px 18px;${i ? `border-top:1px solid ${C.hair};` : ""}text-align:${align}">` +
              `<div style="font-family:${f.body};font-size:11px;letter-spacing:${lang === "ar" ? 0 : 1.5}px;text-transform:uppercase;color:${C.muted}">${escapeHtml(r.label)}</div>` +
              `<div style="margin-top:3px;font-family:${f.body};font-size:15px;line-height:1.55;color:${C.ink}">${nl2br(r.value)}</div>` +
              `</td></tr>`,
          )
          .join("") +
        `</table>`
      );
    case "amount":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}"><tr>` +
        `<td style="padding:16px 0;text-align:${align}"><div style="font-family:${f.body};font-size:11px;letter-spacing:${lang === "ar" ? 0 : 1.5}px;text-transform:uppercase;color:${C.muted}">${escapeHtml(b.label)}</div>` +
        (b.note ? `<div style="margin-top:2px;font-family:${f.body};font-size:12px;color:${C.muted}">${escapeHtml(b.note)}</div>` : "") +
        `</td><td style="padding:16px 0;text-align:${lang === "ar" ? "left" : "right"};white-space:nowrap;font-family:${f.display};font-size:34px;line-height:1;color:${C.ink}">${escapeHtml(b.value)}</td>` +
        `</tr></table>`
      );
    case "button":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 ${b.fallback ? 8 : 22}px"><tr><td align="center">` +
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${C.ink}" style="border-radius:999px">` +
        `<a href="${escapeHtml(b.href)}" style="display:inline-block;padding:15px 36px;font-family:${f.body};font-size:15px;font-weight:500;letter-spacing:${lang === "ar" ? 0 : 0.4}px;color:#faf7f2;text-decoration:none;border-radius:999px">${escapeHtml(b.label)}</a>` +
        `</td></tr></table></td></tr></table>` +
        (b.fallback
          ? `<p style="margin:0 0 22px;font-family:${f.body};font-size:12px;line-height:1.6;color:${C.muted};text-align:center">${escapeHtml(b.fallback)}<br><a href="${escapeHtml(b.href)}" style="color:${C.bronze};word-break:break-all">${escapeHtml(b.href)}</a></p>`
          : "")
      );
    case "secondary":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr><td align="center">` +
        `<a href="${escapeHtml(b.href)}" style="display:inline-block;padding:11px 26px;border:1px solid ${C.accent};border-radius:999px;font-family:${f.body};font-size:14px;color:${C.bronze};text-decoration:none">${escapeHtml(b.label)}</a>` +
        `</td></tr></table>`
      );
    case "box":
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border:1px solid ${C.line};border-radius:14px"><tr><td style="padding:18px 20px;text-align:${align}">` +
        `<div style="font-family:${f.display};font-size:20px;color:${C.ink}">${escapeHtml(b.title)}</div>` +
        (b.text ? `<p style="margin:6px 0 0;font-family:${f.body};font-size:14px;line-height:1.65;color:${C.text}">${segs(b.text)}</p>` : "") +
        (b.rows?.length
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">` +
            b.rows
              .map(
                (r) =>
                  `<tr><td style="padding:7px 0;border-top:1px solid ${C.hair};font-family:${f.body};font-size:12px;color:${C.muted};width:32%;vertical-align:top;text-align:${align}">${escapeHtml(r.label)}</td>` +
                  // Numbers (IBAN, account) stay on one line so they can be copied as they are.
                  `<td style="padding:7px 0;border-top:1px solid ${C.hair};font-family:${f.body};font-size:14px;color:${C.ink};font-weight:500;text-align:${align}${r.ltr ? ";white-space:nowrap" : ""}"${r.ltr ? ' dir="ltr"' : ""}>${escapeHtml(r.value)}</td></tr>`,
              )
              .join("") +
            `</table>`
          : "") +
        (b.footer ? `<p style="margin:12px 0 0;font-family:${f.body};font-size:13px;line-height:1.6;color:${C.text}">${segs(b.footer)}</p>` : "") +
        `</td></tr></table>`
      );
    case "divider":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td align="center" style="font-size:10px;line-height:1;color:${C.accent};letter-spacing:6px">&#9670;</td></tr></table>`;
  }
}

/** The full HTML email. */
export function renderEmail(c: EmailContent): string {
  const f = fonts(c.lang);
  const ar = c.lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const support = env().SUPPORT_WHATSAPP;
  const wa = support ? `https://wa.me/${support.replace(/\D/g, "")}` : null;
  const footer = ar
    ? `إنفترا · دعوات رقمية للأعراس والمناسبات<br><a href="${appUrl("/ar")}" style="color:${C.muted}">invtra.store</a>${wa ? ` · <a href="${wa}" style="color:${C.muted}">واتساب</a>` : ""} · <a href="mailto:contact@invtra.store" style="color:${C.muted}">contact@invtra.store</a>`
    : `INVTRA · Digital invitations for weddings &amp; events<br><a href="${appUrl("/")}" style="color:${C.muted}">invtra.store</a>${wa ? ` · <a href="${wa}" style="color:${C.muted}">WhatsApp</a>` : ""} · <a href="mailto:contact@invtra.store" style="color:${C.muted}">contact@invtra.store</a>`;
  const fontFaces = ["cormorant-garamond-500", "jost-400", "jost-500", "amiri-400", "ibm-plex-sans-arabic-400", "ibm-plex-sans-arabic-500"]
    .map((n) => {
      const [family, weight] = n.startsWith("cormorant")
        ? ["Cormorant Garamond", 500]
        : n.startsWith("jost")
          ? ["Jost", Number(n.split("-").pop())]
          : n.startsWith("amiri")
            ? ["Amiri", 400]
            : ["IBM Plex Sans Arabic", Number(n.split("-").pop())];
      return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url('${appUrl(`/fonts/${n}.woff2`)}') format('woff2')}`;
    })
    .join("");

  return `<!doctype html>
<html lang="${c.lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.title)}</title>
<style>${fontFaces}
@media (max-width:600px){.card{padding:30px 22px 26px!important}.title{font-size:28px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${escapeHtml(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page}" dir="${dir}">
<tr><td align="center" style="padding:36px 14px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 26px"><a href="${appUrl(ar ? "/ar" : "/")}" style="text-decoration:none"><img src="${appUrl("/brand/email-logo.png")}" width="120" alt="INVTRA" style="display:block;width:120px;height:auto;border:0"></a></td></tr>
<tr><td class="card" bgcolor="${C.paper}" style="background:${C.paper};border:1px solid ${C.line};border-radius:22px;padding:38px 40px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}">
<tr><td align="center" style="padding:0 0 18px;font-size:10px;line-height:1;color:${C.accent};letter-spacing:6px">&#8212;&#8202;&#9670;&#8202;&#8212;</td></tr>
${c.eyebrow ? `<tr><td align="center" style="padding:0 0 10px;font-family:${f.body};font-size:11px;letter-spacing:${ar ? 0 : 3.5}px;text-transform:uppercase;color:${C.accent}">${escapeHtml(c.eyebrow)}</td></tr>` : ""}
<tr><td align="center" class="title" style="padding:0 0 26px;font-family:${f.display};font-size:32px;line-height:1.2;color:${C.ink}">${escapeHtml(c.title)}</td></tr>
<tr><td>${c.blocks.map((b) => block(b, c.lang)).join("\n")}</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:24px 10px 0;font-family:${f.body};font-size:12px;line-height:1.8;color:${C.muted}">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The plain-text twin of an email (shown by clients that don't display HTML). */
export function renderEmailText(c: EmailContent): string {
  const out: string[] = [c.title, ""];
  for (const b of c.blocks) {
    switch (b.kind) {
      case "p":
        out.push(segsText(b.text), "");
        break;
      case "details":
        out.push(...b.rows.map((r) => `${r.label}: ${r.value.replace(/\n/g, ", ")}`), "");
        break;
      case "amount":
        out.push(`${b.label}: ${b.value}${b.note ? ` (${b.note})` : ""}`, "");
        break;
      case "button":
      case "secondary":
        out.push(`${b.label}: ${b.href}`, "");
        break;
      case "box":
        out.push(b.title);
        if (b.text) out.push(segsText(b.text));
        if (b.rows) out.push(...b.rows.map((r) => `${r.label}: ${r.value}`));
        if (b.footer) out.push(segsText(b.footer));
        out.push("");
        break;
      default:
        break;
    }
  }
  out.push(c.lang === "ar" ? "إنفترا · invtra.store" : "INVTRA · invtra.store");
  return out.join("\n");
}
