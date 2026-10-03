"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleDashed,
  Download,
  Info,
  ShieldCheck,
} from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { isUnlimited } from "@/lib/plans";
import {
  CUSTOMIZABLE_VARIABLES,
  renderTemplateBody,
  type TemplateVariable,
} from "@/lib/whatsapp/templates";
import { cn } from "@/lib/utils";
import { errorMessage, plural } from "./i18n";
import { PlanCards, usePlans, type PlanTier } from "./plan-picker";
import { stepHref } from "./steps";
import { TestSend } from "./test-send";
import { Bubble, ChatFrame, ChatNote, MessageText } from "./whatsapp-preview";

type PreviewProps = React.ComponentProps<typeof CardPreview>;

export type ReviewTemplate = {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  headerType: string;
  body: string;
  variables: string[];
  footer: string | null;
  buttons: { type: string; text: string; url?: string }[];
};

export type ReadinessCheck = {
  key:
    | "details"
    | "date"
    | "design"
    | "guests"
    | "template"
    | "plan"
    | "theme_plan"
    | "whatsapp";
  ok: boolean;
  detail?: Record<string, string | number>;
};

export type ReviewData = {
  eventId: string;
  readiness: {
    ready: boolean;
    checks: ReadinessCheck[];
    unsent: number;
    guestCount: number;
  };
  preview: PreviewProps;
  templates: ReviewTemplate[];
  selectedTemplateId: string | null;
  defaults: Record<string, string>;
  overrides: Record<string, string>;
  guestName: string;
  delivery: { body: string; footer: string; button: string };
  declineText: string;
  plan: PlanTier | null;
  guestLimit: number;
  premiumTheme: boolean;
  test: { phone: string; country: string; used: number; limit: number };
  mock: boolean;
  checkout: "success" | "cancelled" | null;
};

export function ReviewStep(props: ReviewData) {
  const { eventId, readiness, preview, templates, delivery } = props;
  const { dict, locale } = useI18n();
  const d = dict.dashboard.review;
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const handledCheckout = useRef(false);

  const [templateId, setTemplateId] = useState<string | null>(
    props.selectedTemplateId ?? templates[0]?.id ?? null,
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(
    props.overrides,
  );
  const [saved, setSaved] = useState<{
    templateId: string | null;
    overrides: Record<string, string>;
  }>({
    templateId: props.selectedTemplateId ?? templates[0]?.id ?? null,
    overrides: props.overrides,
  });
  const [saving, setSaving] = useState(false);
  const [cancelledNote, setCancelledNote] = useState(
    props.checkout === "cancelled",
  );

  const template = templates.find((t) => t.id === templateId) ?? null;
  const dirty =
    templateId !== saved.templateId ||
    JSON.stringify(clean(overrides)) !== JSON.stringify(clean(saved.overrides));

  useEffect(() => {
    if (handledCheckout.current || !props.checkout) return;
    handledCheckout.current = true;
    if (props.checkout === "success") toast(d.plan.success);
    router.replace(pathname, { scroll: false });
  }, [props.checkout, d.plan.success, toast, router, pathname]);

  const values = useMemo(() => {
    const v: Record<string, string> = { ...props.defaults };
    for (const [k, val] of Object.entries(overrides))
      if (val.trim()) v[k] = val.trim();
    return v;
  }, [props.defaults, overrides]);

  const body = template
    ? renderTemplateBody(
        {
          body: template.body,
          variables: template.variables as TemplateVariable[],
        },
        values,
      )
    : "";
  const editable = template
    ? template.variables.filter((v): v is TemplateVariable =>
        (CUSTOMIZABLE_VARIABLES as string[]).includes(v),
      )
    : [];
  const acceptText =
    template?.buttons.find((b) => b.type === "QUICK_REPLY")?.text ?? "";

  async function saveMessage() {
    setSaving(true);
    try {
      const vars = clean(overrides);
      await api(`/api/events/${eventId}/messaging`, {
        method: "PATCH",
        body: { messageTemplateId: templateId, templateVariables: vars },
      });
      setSaved({ templateId, overrides: vars });
      toast(d.message.saved);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setSaving(false);
    }
  }

  const failing = readiness.checks.filter((c) => !c.ok);
  const planCheck = readiness.checks.find((c) => c.key === "plan");
  const themeCheck = readiness.checks.find((c) => c.key === "theme_plan");
  const needsPlan = !planCheck?.ok || !themeCheck?.ok;

  return (
    <div className="animate-fade-up space-y-10 pb-6">
      <div className="max-w-2xl">
        <p className="eyebrow">{d.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">
          {d.title}
        </h2>
        <p className="mt-2 text-[15px] text-ink-soft">{d.intro}</p>
      </div>

      {cancelledNote ? (
        <div
          className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-sand/70 px-5 py-4 text-sm text-ink-soft"
          role="status"
        >
          <span className="flex items-start gap-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-bronze-600" />
            {d.plan.cancelled}
          </span>
          <button
            type="button"
            onClick={() => setCancelledNote(false)}
            className="text-[13px] font-medium text-ink-faint hover:text-ink"
          >
            {dict.common.actions.close}
          </button>
        </div>
      ) : null}

      {/* Readiness */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5 sm:px-8">
          <h3 className="font-display text-2xl text-ink">
            {d.checklist.title}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[13px] font-medium",
              readiness.ready
                ? "bg-sage-soft text-sage"
                : "bg-ochre-soft text-ochre",
            )}
          >
            {readiness.ready ? (
              <Check className="size-3.5" strokeWidth={2.5} />
            ) : (
              <CircleDashed className="size-3.5" />
            )}
            {readiness.ready
              ? d.checklist.ready
              : plural(locale, d.checklist.missing, failing.length)}
          </span>
        </div>
        <ul className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0">
          {readiness.checks.map((c, i) => (
            <CheckRow key={c.key} check={c} eventId={eventId} index={i} />
          ))}
        </ul>
      </Card>

      {/* The invitation message */}
      <section aria-labelledby="msg-h">
        <SectionTitle
          id="msg-h"
          title={d.message.title}
          description={d.message.description}
        />
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-7 px-6 py-7 sm:px-8">
              <p className="flex gap-3 rounded-2xl bg-sand/70 px-4 py-3.5 text-[13px] leading-relaxed text-ink-soft">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-bronze-600" />
                {d.message.approvedNote}
              </p>
              {templates.length ? (
                <>
                  <fieldset>
                    <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">
                      {d.message.style}
                    </legend>
                    <div className="grid gap-2.5" role="radiogroup">
                      {templates.map((t) => {
                        const active = t.id === templateId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setTemplateId(t.id)}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border px-4 py-3 text-start transition-all duration-300 ease-luxe",
                              active
                                ? "border-bronze-400 bg-bronze-50 shadow-soft"
                                : "border-line bg-paper hover:border-line-strong",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                active
                                  ? "border-bronze-600 bg-bronze-600"
                                  : "border-line-strong",
                              )}
                            >
                              {active ? (
                                <span className="size-1.5 rounded-full bg-white" />
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium text-ink">
                                {locale === "ar" && t.nameAr
                                  ? t.nameAr
                                  : t.name}
                              </span>
                              {t.description && locale === "en" ? (
                                <span className="mt-0.5 block text-[13px] text-ink-faint">
                                  {t.description}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  {editable.length ? (
                    <fieldset>
                      <legend className="mb-1 text-[13px] font-medium text-ink-soft">
                        {d.message.wording}
                      </legend>
                      <p className="mb-3.5 text-[13px] text-ink-faint">
                        {d.message.wordingHint}
                      </p>
                      <div className="grid gap-4">
                        {editable.map((v) => {
                          const ar = v.endsWith("_ar");
                          return (
                            <Field
                              key={v}
                              id={`var-${v}`}
                              label={
                                (d.message.vars as Record<string, string>)[v] ??
                                v
                              }
                            >
                              <Input
                                id={`var-${v}`}
                                value={overrides[v] ?? ""}
                                placeholder={props.defaults[v]}
                                dir={ar ? "rtl" : "auto"}
                                lang={ar ? "ar" : undefined}
                                maxLength={120}
                                onChange={(e) =>
                                  setOverrides((o) => ({
                                    ...o,
                                    [v]: e.target.value,
                                  }))
                                }
                              />
                            </Field>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-4">
                    <Button
                      variant="primary"
                      onClick={saveMessage}
                      loading={saving}
                      disabled={!dirty}
                    >
                      {d.message.save}
                    </Button>
                    <AnimatePresence>
                      {dirty ? (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 text-[13px] text-ink-faint"
                        >
                          <span className="size-1.5 rounded-full bg-ochre" />
                          {d.message.unsaved}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <p className="rounded-2xl border border-ochre/25 bg-ochre-soft px-4 py-3.5 text-sm text-ink-soft">
                  {d.message.none}
                </p>
              )}
            </div>
            <div className="border-t border-line bg-ivory/60 px-5 py-7 sm:px-8 lg:border-s lg:border-t-0">
              <p className="mb-3 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                {fmt(d.message.previewFor, { name: props.guestName })}
              </p>
              <ChatFrame
                title={dict.dashboard.whatsapp.business}
                subtitle={dict.dashboard.whatsapp.verified}
                className="mx-auto max-w-sm"
              >
                <ChatNote>{d.message.today}</ChatNote>
                {template ? (
                  <Bubble
                    header={
                      template.headerType === "IMAGE" ? (
                        <CardPreview
                          {...preview}
                          guest={null}
                          qrPlaceholder={false}
                          className="rounded-lg"
                          title={dict.dashboard.whatsapp.image}
                        />
                      ) : undefined
                    }
                    body={body}
                    footer={template.footer}
                    buttons={template.buttons.map((b) => ({
                      text: b.text,
                      url: b.type === "URL" ? "#" : undefined,
                    }))}
                  />
                ) : (
                  <Bubble body={d.message.none} />
                )}
              </ChatFrame>
            </div>
          </div>
        </Card>
      </section>

      {/* After they accept */}
      <section aria-labelledby="after-h">
        <SectionTitle
          id="after-h"
          title={d.after.title}
          description={d.after.description}
        />
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="paper-grain flex flex-col items-center justify-center gap-5 bg-sand px-6 py-9">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                {d.after.personal}
              </p>
              <CardPreview
                {...preview}
                className="w-full max-w-[300px] rounded-[3px] shadow-lift ring-1 ring-ink/5"
                title={d.after.personal}
              />
              <a
                href={`/api/events/${eventId}/card?sample=1&download=1`}
                className={buttonClasses("outline", "sm")}
                download
              >
                <Download className="size-3.5" />
                {d.after.download}
              </a>
            </div>
            <div className="bg-ivory/60 px-5 py-7 sm:px-8">
              <ChatFrame
                title={dict.dashboard.whatsapp.business}
                subtitle={dict.dashboard.whatsapp.verified}
                className="mx-auto max-w-sm"
              >
                {acceptText ? (
                  <>
                    <ChatNote>
                      {fmt(d.after.tapped, { button: acceptText })}
                    </ChatNote>
                    <Bubble side="out" body={acceptText} />
                  </>
                ) : null}
                <Bubble
                  header={
                    <CardPreview
                      {...preview}
                      className="rounded-lg"
                      title={d.after.personal}
                    />
                  }
                  body={delivery.body}
                  footer={delivery.footer}
                  buttons={[{ text: delivery.button, url: "#" }]}
                />
              </ChatFrame>
              <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-line bg-paper px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                  {d.after.ifDecline}
                </p>
                <MessageText
                  text={props.declineText}
                  className="mt-1 text-sm text-ink-soft"
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Plan */}
      <section id="plan" aria-labelledby="plan-h" className="scroll-mt-24">
        <PlanSection
          eventId={eventId}
          plan={props.plan}
          guestLimit={props.guestLimit}
          guestCount={readiness.guestCount}
          premiumTheme={props.premiumTheme}
          needsPlan={needsPlan}
        />
      </section>

      {/* Test */}
      <section aria-label={d.test.title}>
        <TestSend
          eventId={eventId}
          defaultPhone={props.test.phone}
          defaultCountry={props.test.country}
          hasPlan={Boolean(props.plan)}
          used={props.test.used}
          limit={props.test.limit}
          mock={props.mock}
        />
      </section>

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-line bg-ivory/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {!readiness.ready ? (
            <span className="text-[13px] text-ink-faint">{d.notReady}</span>
          ) : null}
          {readiness.ready ? (
            <Link
              href={stepHref(eventId, "send")}
              className={buttonClasses("primary", "lg")}
            >
              {d.continue}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          ) : (
            <Button size="lg" disabled>
              {d.continue}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function clean(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(o)
      .map(([k, v]) => [k, v.trim()])
      .filter(([k, v]) => v && (CUSTOMIZABLE_VARIABLES as string[]).includes(k))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function SectionTitle({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 max-w-2xl">
      <h3 id={id} className="font-display text-3xl text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {description}
      </p>
    </div>
  );
}

function CheckRow({
  check,
  eventId,
  index,
}: {
  check: ReadinessCheck;
  eventId: string;
  index: number;
}) {
  const { dict, locale } = useI18n();
  const items = dict.dashboard.review.checklist.items;
  const det = check.detail ?? {};
  const num = (k: string) => formatNumber(Number(det[k] ?? 0), locale);
  let text: string;
  let fix: { href: string; external?: boolean } | null = null;
  switch (check.key) {
    case "guests":
      text = check.ok
        ? plural(locale, items.guests.ok, Number(det.total ?? 0))
        : items.guests.todo;
      fix = { href: stepHref(eventId, "guests") };
      break;
    case "template":
      text = check.ok
        ? fmt(items.template.ok, { name: String(det.name ?? "") })
        : items.template.todo;
      break;
    case "plan": {
      const plan = String(det.plan ?? "");
      const label = (dict.common.plans as Record<string, string>)[plan] ?? plan;
      text = check.ok
        ? fmt(items.plan.ok, { plan: label, limit: num("limit") })
        : plan
          ? fmt(items.plan.over, { total: num("total"), limit: num("limit") })
          : items.plan.todo;
      fix = { href: "#plan" };
      break;
    }
    case "theme_plan":
      text = check.ok ? items.theme_plan.ok : items.theme_plan.todo;
      fix = { href: "#plan" };
      break;
    case "whatsapp":
      text = check.ok ? items.whatsapp.ok : items.whatsapp.todo;
      fix = { href: "mailto:contact@invtra.store", external: true };
      break;
    case "design":
      text = check.ok ? items.design.ok : items.design.todo;
      fix = { href: stepHref(eventId, "design") };
      break;
    case "date":
      text = check.ok ? items.date.ok : items.date.todo;
      fix = { href: stepHref(eventId, "event") };
      break;
    default:
      text = check.ok ? items.details.ok : items.details.todo;
      fix = { href: stepHref(eventId, "event") };
  }
  return (
    <li
      className={cn(
        "flex items-center gap-3.5 px-6 py-4 sm:px-8",
        index > 1 && "md:border-t md:border-line",
        index % 2 === 1 && "md:border-s md:border-line",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          check.ok
            ? "bg-sage-soft text-sage"
            : "border border-dashed border-ochre/60 bg-ochre-soft text-ochre",
        )}
      >
        {check.ok ? (
          <Check className="size-3.5" strokeWidth={2.5} />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-sm",
          check.ok ? "text-ink-soft" : "font-medium text-ink",
        )}
      >
        {text}
      </span>
      {!check.ok && fix ? (
        fix.external ? (
          <a
            href={fix.href}
            className="shrink-0 text-[13px] font-medium text-bronze-700 hover:text-bronze-900"
          >
            {dict.dashboard.review.checklist.fix}
          </a>
        ) : (
          <Link
            href={fix.href}
            className="shrink-0 text-[13px] font-medium text-bronze-700 hover:text-bronze-900"
          >
            {dict.dashboard.review.checklist.fix}
          </Link>
        )
      ) : null}
    </li>
  );
}

function PlanSection({
  eventId,
  plan,
  guestLimit,
  guestCount,
  premiumTheme,
  needsPlan,
}: {
  eventId: string;
  plan: PlanTier | null;
  guestLimit: number;
  guestCount: number;
  premiumTheme: boolean;
  needsPlan: boolean;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.review.plan;
  const { data, error, reload } = usePlans(eventId);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const canUpgrade = plan === "BASIC";

  return (
    <div>
      <SectionTitle id="plan-h" title={d.title} description={d.description} />
      {plan && !needsPlan ? (
        <Card className="px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-2xl text-ink">
                {fmt(d.current, { plan: dict.common.plans[plan] })}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {isUnlimited(guestLimit)
                  ? fmt(d.coversUnlimited, {
                      used: formatNumber(guestCount, locale),
                    })
                  : fmt(d.covers, {
                      limit: formatNumber(guestLimit, locale),
                      used: formatNumber(guestCount, locale),
                    })}
              </p>
            </div>
            {canUpgrade && !showUpgrade ? (
              <Button variant="outline" onClick={() => setShowUpgrade(true)}>
                {d.upgradeTitle}
              </Button>
            ) : null}
          </div>
          {showUpgrade ? (
            <div className="mt-6 border-t border-line pt-6">
              {data ? (
                <PlanCards
                  plans={data.plans}
                  currency={data.currency}
                  eventId={eventId}
                  currentPlan={plan}
                  guestCount={guestCount}
                  premiumTheme={premiumTheme}
                  credit={data.credit}
                  compact
                />
              ) : error ? (
                <LoadError onRetry={reload} />
              ) : (
                <div className="skeleton h-40 rounded-2xl" />
              )}
            </div>
          ) : null}
        </Card>
      ) : data ? (
        <PlanCards
          plans={data.plans}
          currency={data.currency}
          eventId={eventId}
          currentPlan={plan}
          guestCount={guestCount}
          premiumTheme={premiumTheme}
          offer={data.offer}
          credit={data.credit}
        />
      ) : error ? (
        <Card className="px-6 py-6">
          <LoadError onRetry={reload} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-80 rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { dict } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
      <span>{dict.dashboard.review.plan.loadError}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {dict.common.actions.retry}
      </Button>
    </div>
  );
}
