import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { findOwnedEvent } from "@/server/events/access";
import { cardPreviewProps } from "@/server/events/preview";
import { sendReadiness } from "@/server/sending/service";
import { messagePreview } from "@/server/sending/preview";
import { SendPanel } from "@/components/dashboard/send-panel";
import { themeName } from "@/components/dashboard/i18n";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.send };
}

export default async function SendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/send`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();
  const { dict, locale } = await getI18n();

  const [readiness, preview, message, latest, failedCount] = await Promise.all([
    sendReadiness(event),
    cardPreviewProps(event),
    messagePreview(event),
    db.sendBatch.findFirst({ where: { eventId: event.id, kind: { in: ["INITIAL", "RESEND"] } }, orderBy: { createdAt: "desc" } }),
    db.guest.count({ where: { eventId: event.id, isTest: false, status: "FAILED" } }),
  ]);
  const template = message.template;
  const templateName = template
    ? locale === "ar"
      ? ((await db.messageTemplate.findUnique({ where: { id: template.id }, select: { nameAr: true } }))?.nameAr ?? template.name)
      : template.name
    : null;

  return (
    <SendPanel
      eventId={event.id}
      ready={readiness.ready}
      unsent={readiness.unsent}
      guestCount={readiness.guestCount}
      failedCount={failedCount}
      themeLabel={event.imageMode === "CUSTOM" ? dict.dashboard.send.ready.customDesign : themeName(dict, event.themeKey)}
      templateName={templateName}
      languageLabel={dict.common.eventLanguages[event.language]}
      preview={preview}
      message={
        template
          ? { body: template.body, footer: template.footer, buttons: template.buttons, headerImage: template.headerType === "IMAGE" }
          : null
      }
      runningBatch={
        latest && (latest.status === "QUEUED" || latest.status === "RUNNING")
          ? { id: latest.id, total: latest.total, sent: latest.sent, failed: latest.failed, skipped: latest.skipped, status: latest.status, kind: latest.kind }
          : null
      }
    />
  );
}
