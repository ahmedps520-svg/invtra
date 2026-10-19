import type { Metadata } from "next";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { ownerEventOrList } from "@/app/dashboard/_lib/access";
import { editorProps } from "@/server/events/editor";
import { getI18n } from "@/server/i18n";
import { orderInReview } from "@/server/orders/service";
import { isUnlocked } from "@/server/render/preview";
import { mediaUrl } from "@/server/storage";
import { pickNamespaces } from "@/lib/i18n";
import { designSourcesFor } from "@/lib/products";
import { I18nProvider } from "@/components/i18n/provider";
import { DesignEditor } from "@/components/editor/design-editor";
import { DesignBrief, DesignSourcePicker } from "@/components/dashboard/wizard/design-source";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.editor.meta.title };
}

/**
 * Step 3. Before the event is paid for, the customer first picks how it's designed: one of
 * INVTRA's designs or their own upload (both in the editor), or a custom design request (a brief).
 */
export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/design`);
  const event = await ownerEventOrList(user.id, id);
  const { dict, locale } = await getI18n();
  const ordering = !isUnlocked(event);
  const steps = dict.dashboard.orders.steps;
  const next = ordering
    ? event.product === "PHOTO_ONLY"
      ? { href: `/dashboard/events/${event.id}/summary`, label: steps.review }
      : { href: `/dashboard/events/${event.id}/features`, label: steps.features }
    : null;
  const nav = next ? { back: { href: `/dashboard/events/${event.id}/details`, label: steps.details }, next } : undefined;
  const locked = ordering && Boolean(await orderInReview(event.id));

  if (ordering && event.designSource === "REQUEST") {
    const refs = await db.upload.findMany({ where: { eventId: event.id, kind: "REFERENCE" }, orderBy: { createdAt: "asc" } });
    return (
      <div>
        <DesignSourcePicker eventId={event.id} sources={designSourcesFor(event.product)} current={event.designSource} locked={locked} />
        <DesignBrief
          eventId={event.id}
          initialBrief={event.designBrief ?? ""}
          references={await Promise.all(refs.map(async (r) => ({ id: r.id, url: await mediaUrl(r.key) })))}
          maxReferences={5}
          next={next!}
          locked={locked}
        />
      </div>
    );
  }

  const props = await editorProps(event, { nav });
  return (
    <div>
      {ordering ? <DesignSourcePicker eventId={event.id} sources={designSourcesFor(event.product)} current={event.designSource} locked={locked} /> : null}
      <I18nProvider locale={locale} dict={pickNamespaces(locale, ["editor", "themes"])}>
      <DesignEditor {...props} />
    </I18nProvider>
    </div>
  );
}
