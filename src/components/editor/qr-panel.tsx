"use client";

import { useId, useMemo, useState } from "react";
import { ScanLine } from "lucide-react";
import { Switch } from "@/components/ui/toggle";
import { Field, Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n/provider";
import { designSchema, QR_POSITIONS, QR_SIZES, QR_STYLES, type InvitationDesign } from "@/lib/design/schema";
import { qrSvgGroup } from "@/lib/qr";
import { ChoiceGroup, GroupLabel, Hint, Note } from "./controls";
import { useEditor } from "./editor-context";

type Qr = InvitationDesign["card"]["qr"];
type Side = "center" | "left" | "right";

function PositionDiagram({ side }: { side: Side }) {
  const qr = { center: { left: "35%" }, left: { left: "12%" }, right: { right: "12%" } }[side];
  return (
    <span dir="ltr" className="relative mx-auto block aspect-[4/5] w-16 overflow-hidden rounded-[4px] border border-line-strong/70 bg-ivory shadow-soft">
      <span className="absolute inset-x-[28%] top-[14%] h-[3px] rounded-full bg-bronze-300" />
      <span className="absolute inset-x-[18%] top-[24%] h-[5px] rounded-full bg-ink/70" />
      <span className="absolute inset-x-[30%] top-[36%] h-[3px] rounded-full bg-line-strong" />
      <span className="absolute inset-x-[24%] top-[44%] h-[3px] rounded-full bg-line-strong" />
      <span className="absolute bottom-[10%] aspect-square w-[30%] rounded-[2px] bg-ink/80" style={qr} />
      {side !== "center" ? (
        <>
          <span className="absolute bottom-[25%] h-[3px] w-[34%] rounded-full bg-ink/40" style={side === "left" ? { right: "12%" } : { left: "12%" }} />
          <span className="absolute bottom-[17%] h-[3px] w-[24%] rounded-full bg-bronze-300" style={side === "left" ? { right: "22%" } : { left: "22%" }} />
        </>
      ) : null}
    </span>
  );
}

export function QrPanel() {
  const { dict } = useI18n();
  const t = dict.editor.qr;
  const { event, draft, setDesign, advanced } = useEditor();
  const card = draft.design.card;
  const off = card.qr.enabled === false;
  const custom = draft.imageMode === "CUSTOM";
  // On an Arabic card, "start" is the right-hand side.
  const rtlCard = event.language === "AR";
  const sideOf = (p: Qr["position"]): Side => (p === "bottom-center" ? "center" : (p === "bottom-start") !== rtlCard ? "left" : "right");
  const setQr = (patch: Partial<Qr>) => setDesign({ card: { qr: patch } });

  const styleArt = useMemo(
    () =>
      Object.fromEntries(
        QR_STYLES.map((s) => [
          s,
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${qrSvgGroup({ text: "https://invtra.store", size: 120, style: s, fg: "#1E1A16", bg: "#FFFFFF", logo: card.qr.showLogo })}</svg>`,
        ]),
      ),
    [card.qr.showLogo],
  );

  const toggles: { key: "showLogo" | "showGuestName" | "showVenueAddress" | "showBranding"; label: string; hint: string; hideCustom?: boolean }[] = [
    { key: "showLogo", label: t.logo, hint: t.logoHint },
    { key: "showGuestName", label: t.guest, hint: t.guestHint, hideCustom: true },
    { key: "showVenueAddress", label: t.address, hint: t.addressHint, hideCustom: true },
    { key: "showBranding", label: t.branding, hint: t.brandingHint, hideCustom: true },
  ];

  return (
    <div className="space-y-8">
      {advanced ? <QrChoice /> : null}

      {off ? null : (
        <>
          <Note icon={<ScanLine />}>{t.explainer}</Note>

          {custom ? (
            <p className="text-[13px] leading-relaxed text-ink-faint">{t.customNote}</p>
          ) : (
            <>
              <div>
                <GroupLabel>{t.position}</GroupLabel>
                <ChoiceGroup<Qr["position"]>
                  name="qr-position"
                  label={t.position}
                  value={card.qr.position}
                  onChange={(position) => setQr({ position })}
                  columns={3}
                  tileClassName="items-center text-center"
                  options={QR_POSITIONS.map((p) => ({ value: p, label: t.positions[sideOf(p)], visual: <PositionDiagram side={sideOf(p)} /> }))}
                />
                <Hint>{t.positionHint}</Hint>
              </div>

              <div>
                <GroupLabel>{t.size}</GroupLabel>
                <ChoiceGroup<Qr["size"]>
                  name="qr-size"
                  label={t.size}
                  value={card.qr.size}
                  onChange={(size) => setQr({ size })}
                  columns={3}
                  layout="row"
                  options={QR_SIZES.map((s) => ({
                    value: s,
                    label: t.sizes[s],
                    visual: (
                      <span className="flex size-7 items-center justify-center">
                        <span className="rounded-[3px] border-2 border-ink/70" style={{ width: { sm: 14, md: 20, lg: 26 }[s], height: { sm: 14, md: 20, lg: 26 }[s] }} />
                      </span>
                    ),
                  }))}
                />
                <Hint>{t.sizeHint}</Hint>
              </div>
            </>
          )}

          <div>
            <GroupLabel>{t.style}</GroupLabel>
            <ChoiceGroup<Qr["style"]>
              name="qr-style"
              label={t.style}
              value={card.qr.style}
              onChange={(style) => setQr({ style })}
              columns={3}
              tileClassName="items-center text-center"
              options={QR_STYLES.map((s) => ({
                value: s,
                label: t.styles[s],
                visual: <span aria-hidden="true" className="mx-auto block size-16 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: styleArt[s] }} />,
              }))}
            />
            <Hint>{t.styleHint}</Hint>
          </div>
        </>
      )}

      <div className="space-y-5 border-t border-line pt-6">
        {toggles
          .filter((x) => !(custom && x.hideCustom) && !(off && x.key === "showLogo"))
          .map((x) => (
            <Switch
              key={x.key}
              id={`qr-${x.key}`}
              checked={x.key === "showLogo" ? card.qr.showLogo : card[x.key]}
              onChange={(v) => (x.key === "showLogo" ? setQr({ showLogo: v }) : setDesign({ card: { [x.key]: v } }))}
              label={x.label}
              description={x.hint}
            />
          ))}
      </div>
    </div>
  );
}

const linkSchema = designSchema.shape.card.shape.qr.shape.link;

/** Custom events: print a QR or not, and what it opens (each guest's invitation or one link). */
function QrChoice() {
  const { dict } = useI18n();
  const t = dict.editor.qr;
  const { draft, setDesign } = useEditor();
  const qr = draft.design.card.qr;
  const uid = useId();
  const [ownLink, setOwnLink] = useState(Boolean(qr.link));
  // The link is saved once it's a valid web address; until then it's only kept here.
  const [link, setLink] = useState(qr.link);
  const [linkError, setLinkError] = useState<string | null>(null);
  const setQr = (patch: Partial<Qr>) => setDesign({ card: { qr: patch } });

  function changeLink(value: string) {
    setLink(value);
    const ok = linkSchema.safeParse(value.trim()).success && value.trim() !== "";
    setLinkError(ok || !value.trim() ? null : t.linkError);
    if (ok) setQr({ link: value.trim() });
  }

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-ivory/70 p-5">
      <Switch id={`${uid}-on`} checked={qr.enabled !== false} onChange={(v) => setQr({ enabled: v })} label={t.show} description={t.showHint} />
      {qr.enabled !== false ? (
        <>
          <div>
            <GroupLabel>{t.target}</GroupLabel>
            <ChoiceGroup<"guest" | "link">
              name="qr-target"
              label={t.target}
              value={ownLink ? "link" : "guest"}
              onChange={(v) => {
                setOwnLink(v === "link");
                if (v === "guest") {
                  setQr({ link: "" });
                  setLinkError(null);
                } else if (link.trim() && linkSchema.safeParse(link.trim()).success) setQr({ link: link.trim() });
              }}
              columns={2}
              options={[
                {
                  value: "guest",
                  label: t.targetGuest,
                  hint: t.targetGuestHint,
                },
                {
                  value: "link",
                  label: t.targetLink,
                  hint: t.targetLinkHint,
                },
              ]}
            />
          </div>
          {ownLink ? (
            <Field id={`${uid}-link`} label={t.link} error={linkError}>
              <Input
                id={`${uid}-link`}
                type="url"
                inputMode="url"
                dir="ltr"
                maxLength={500}
                placeholder="https://"
                value={link}
                onChange={(e) => changeLink(e.target.value)}
                aria-invalid={Boolean(linkError)}
              />
            </Field>
          ) : null}
          <Field id={`${uid}-caption`} label={t.caption} hint={t.captionHint}>
            <Input id={`${uid}-caption`} dir="auto" maxLength={60} value={qr.caption} onChange={(e) => setQr({ caption: e.target.value })} />
          </Field>
        </>
      ) : null}
    </div>
  );
}
