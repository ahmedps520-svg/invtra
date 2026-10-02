import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { findOwnedEvent } from "@/server/events/access";
import { cardPreviewProps } from "@/server/events/preview";
import { sendReadiness } from "@/server/sending/service";
import { messagePreview } from "@/server/sending/preview";
import { eventLocale, systemText, templateValues } from "@/server/whatsapp/compose";
import { getTheme } from "@/lib/themes/registry";
import { TEST_SEND_LIMIT } from "@/lib/plans";
import { isTemplateButtons } from "@/lib/whatsapp/templates";
import { ReviewStep, type ReviewTemplate } from "@/components/dashboard/review";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.review };
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/dashboard/events/${id}/review`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();

  const msgLocale = eventLocale(event);
  const [readiness, preview, message, rows, themeRow] = await Promise.all([
    sendReadiness(event),
    cardPreviewProps(event),
    messagePreview(event),
    db.messageTemplate.findMany({
      where: { purpose: "INVITATION", status: "APPROVED", isActive: true, locale: msgLocale },
      orderBy: { sortOrder: "asc" },
    }),
    db.invitationTheme.findUnique({ where: { key: event.themeKey } }),
  ]);

  // Only templates suited to this occasion (a newborn visit shouldn't offer wedding wording), most specific first.
  const fits = rows.filter((t) => t.eventTypes.includes(event.type));
  const ordered = fits.length ? [...fits].sort((a, b) => a.eventTypes.length - b.eventTypes.length || a.sortOrder - b.sortOrder) : rows;
  const templates: ReviewTemplate[] = ordered.map((t) => ({
    id: t.id,
    name: t.name,
    nameAr: t.nameAr,
    description: t.description,
    headerType: t.headerType,
    body: t.body,
    variables: (t.variables ?? []) as string[],
    footer: t.footer,
    buttons: isTemplateButtons(t.buttons) ? t.buttons.map((b) => ({ type: b.type, text: b.text, ...(b.type === "URL" ? { url: b.url } : {}) })) : [],
  }));
  const ids = templates.map((t) => t.id);
  const selected =
    event.messageTemplateId && ids.includes(event.messageTemplateId)
      ? event.messageTemplateId
      : message.template && ids.includes(message.template.id)
        ? message.template.id
        : (ids[0] ?? null);

  const defaults = templateValues({ ...event, templateVariables: null }, { name: message.guestName }, "SAMPLE0000");
  const overrides = Object.fromEntries(
    Object.entries((event.templateVariables ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const checkout = sp.checkout === "success" || sp.checkout === "cancelled" ? sp.checkout : null;
  const { locale } = await getI18n();
  const nameAr = locale === "ar" ? readiness.template?.nameAr : null;
  const checks = readiness.checks.map((c) => (c.key === "template" && c.ok && nameAr ? { ...c, detail: { name: nameAr } } : c));

  return (
    <ReviewStep
      eventId={event.id}
      readiness={{
        ready: readiness.ready,
        checks,
        unsent: readiness.unsent,
        guestCount: readiness.guestCount,
      }}
      preview={preview}
      templates={templates}
      selectedTemplateId={selected}
      defaults={defaults}
      overrides={overrides}
      guestName={message.guestName}
      delivery={message.delivery}
      declineText={systemText(msgLocale, "decline")}
      plan={event.plan}
      guestLimit={event.guestLimit}
      premiumTheme={themeRow?.isPremium ?? getTheme(event.themeKey).premium}
      test={{ phone: user.phone ?? "", used: event.testSendsUsed, limit: TEST_SEND_LIMIT }}
      mock={env().WHATSAPP_PROVIDER === "mock"}
      checkout={checkout}
    />
  );
}
