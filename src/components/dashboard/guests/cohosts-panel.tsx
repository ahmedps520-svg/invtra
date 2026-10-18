"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Copy, Mail, MessageCircle, MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber, formatRelative } from "@/lib/format";
import type { CoHostView } from "@/server/events/cohosts";
import { errorMessage, plural } from "../i18n";

/**
 * "Guest lists" on the owner's Guests page: their own list and each co-host's, with how many
 * guests are on it. The owner invites co-hosts here (they're emailed a link, which the owner
 * can also copy or send on WhatsApp), changes a list's limit, or removes a co-host.
 */
export function CoHostsPanel({ eventId, initial, ownCount, max }: { eventId: string; initial: CoHostView[]; ownCount: number; max: number }) {
  const { dict, locale } = useI18n();
  const t = dict.dashboard.cohosts;
  const toast = useToast();
  const router = useRouter();
  const [coHosts, setCoHosts] = useState(initial);
  const [inviting, setInviting] = useState(0); // a counter, so the form starts empty each time
  const [editing, setEditing] = useState<CoHostView | null>(null);
  const [removing, setRemoving] = useState<CoHostView | null>(null);
  const [busy, setBusy] = useState(false);
  const n = (v: number) => formatNumber(v, locale);

  const update = (list: CoHostView[]) => {
    setCoHosts(list);
    router.refresh(); // the guest table's list filter and counts
  };

  async function copy(c: CoHostView) {
    if (!c.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(c.inviteUrl);
      toast(t.copied);
    } catch {
      window.prompt(t.copyLink, c.inviteUrl);
    }
  }

  async function resend(c: CoHostView) {
    try {
      const r = await api<{ coHosts: CoHostView[] }>(`/api/events/${eventId}/cohosts/${c.id}`, { method: "POST", body: { action: "resend" } });
      setCoHosts(r.coHosts);
      toast(t.resent);
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    }
  }

  async function remove(c: CoHostView) {
    setBusy(true);
    try {
      const r = await api<{ coHosts: CoHostView[] }>(`/api/events/${eventId}/cohosts/${c.id}`, { method: "DELETE" });
      update(r.coHosts);
      setRemoving(null);
      toast(t.removed);
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  const menuFor = (c: CoHostView): (MenuItem | "divider")[] => [
    ...(c.inviteUrl
      ? ([
          { label: t.copyLink, icon: <Copy />, onSelect: () => copy(c) },
          {
            label: t.whatsapp,
            icon: <MessageCircle />,
            onSelect: () => window.open(`https://wa.me/?text=${encodeURIComponent(fmt(t.whatsappText, { label: c.label, url: c.inviteUrl! }))}`, "_blank", "noopener"),
          },
          { label: t.resend, icon: <Mail />, onSelect: () => resend(c) },
          "divider",
        ] satisfies (MenuItem | "divider")[])
      : []),
    { label: t.edit, icon: <Pencil />, onSelect: () => setEditing(c) },
    { label: t.remove, icon: <Trash2 />, danger: true, onSelect: () => setRemoving(c) },
  ];

  const full = coHosts.length >= max;

  return (
    <section aria-labelledby="lists-h" className="mt-8 rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 max-w-2xl items-start gap-3.5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-bronze-200 bg-bronze-50 text-bronze-600" aria-hidden="true">
            <Users className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 id="lists-h" className="font-display text-xl text-ink">
              {t.title}
            </h3>
            {coHosts.length ? null : <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{t.intro}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<UserPlus className="size-3.5" />}
          onClick={() => setInviting((k) => k + 1)}
          disabled={full}
          title={full ? fmt(t.max, { n: max }) : undefined}
        >
          {t.invite}
        </Button>
      </div>

      {coHosts.length ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          <li className="flex items-center justify-between gap-4 py-3">
            <span className="text-[14px] font-medium text-ink">{t.yourList}</span>
            <span className="text-[13px] text-ink-soft tabular-nums">{plural(locale, t.guests, ownCount)}</span>
          </li>
          {coHosts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium text-ink">
                  <span className="truncate">{c.label}</span>
                  {c.joined ? (
                    <Badge tone="sage" dot>
                      {t.joined}
                    </Badge>
                  ) : (
                    <Badge tone="ochre" dot>
                      {t.pending}
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">
                  {c.joined && c.joinedAs
                    ? fmt(t.joinedAs, { name: c.joinedAs })
                    : `${c.email} · ${fmt(t.invitedOn, { date: formatRelative(new Date(c.invitedAt), locale) })}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[13px] text-ink-soft tabular-nums">
                  {c.guestLimit ? fmt(t.guestsOf, { n: n(c.guests), limit: n(c.guestLimit) }) : plural(locale, t.guests, c.guests)}
                </span>
                <Menu
                  label={`${t.manage} — ${c.label}`}
                  items={menuFor(c)}
                  trigger={<MoreHorizontal className="size-4" />}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {inviting ? <InviteDialog key={inviting} eventId={eventId} onClose={() => setInviting(0)} onDone={update} /> : null}
      {editing ? <EditDialog key={editing.id} eventId={eventId} coHost={editing} onClose={() => setEditing(null)} onDone={update} /> : null}

      <Dialog
        open={Boolean(removing)}
        onClose={() => !busy && setRemoving(null)}
        title={removing ? fmt(t.removeTitle, { label: removing.label }) : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => removing && remove(removing)}>
              {t.remove}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          {removing?.guests ? plural(locale, t.removeBody, removing.guests) : t.removeBodyNone}
        </p>
      </Dialog>
    </section>
  );
}

function InviteDialog({ eventId, onClose, onDone }: { eventId: string; onClose: () => void; onDone: (list: CoHostView[]) => void }) {
  const { dict } = useI18n();
  const t = dict.dashboard.cohosts;
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ coHosts: CoHostView[] }>(`/api/events/${eventId}/cohosts`, {
        method: "POST",
        body: { label: label.trim(), email: email.trim(), guestLimit: limit ? Number(limit) : null },
      });
      onDone(r.coHosts);
      toast(fmt(t.sent, { email: email.trim() }));
      onClose();
    } catch (err) {
      setError(errorMessage(err, dict));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t.dialogTitle}
      description={t.dialogBody}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {dict.common.actions.cancel}
          </Button>
          <Button type="submit" form="cohost-invite" loading={busy} disabled={!label.trim() || !email.trim()} icon={<Mail className="size-4" />}>
            {t.send}
          </Button>
        </>
      }
    >
      <form id="cohost-invite" onSubmit={submit} className="space-y-5">
        <Field id="cohost-label" label={t.label}>
          <Input id="cohost-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.labelPh} maxLength={60} required dir="auto" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLabel(s)}
                className="rounded-full border border-line bg-paper px-3 py-1 text-[12.5px] text-ink-soft transition hover:border-bronze-300 hover:text-ink aria-pressed:border-bronze-400 aria-pressed:bg-bronze-50 aria-pressed:text-ink"
                aria-pressed={label === s}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
        <Field id="cohost-email" label={t.email}>
          <Input id="cohost-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required dir="ltr" />
        </Field>
        <Field id="cohost-limit" label={t.limit} hint={t.limitHint}>
          <Input id="cohost-limit" type="number" inputMode="numeric" min={1} max={10000} value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} className="sm:w-40" />
        </Field>
        {error ? (
          <p className="text-[13.5px] text-rosewood" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function EditDialog({ eventId, coHost, onClose, onDone }: { eventId: string; coHost: CoHostView; onClose: () => void; onDone: (list: CoHostView[]) => void }) {
  const { dict } = useI18n();
  const t = dict.dashboard.cohosts;
  const toast = useToast();
  const [label, setLabel] = useState(coHost.label);
  const [limit, setLimit] = useState(coHost.guestLimit ? String(coHost.guestLimit) : "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ coHosts: CoHostView[] }>(`/api/events/${eventId}/cohosts/${coHost.id}`, {
        method: "PATCH",
        body: { label: label.trim(), guestLimit: limit ? Number(limit) : null },
      });
      onDone(r.coHosts);
      toast(t.saved);
      onClose();
    } catch (err) {
      toast(errorMessage(err, dict), "error");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={fmt(t.editTitle, { label: coHost.label })}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {dict.common.actions.cancel}
          </Button>
          <Button type="submit" form="cohost-edit" loading={busy} disabled={!label.trim()} icon={<CheckCircle2 className="size-4" />}>
            {t.save}
          </Button>
        </>
      }
    >
      <form id="cohost-edit" onSubmit={submit} className="space-y-5">
        <Field id="cohost-edit-label" label={t.label}>
          <Input id="cohost-edit-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} required dir="auto" />
        </Field>
        <Field id="cohost-edit-limit" label={t.limit} hint={t.limitHint}>
          <Input id="cohost-edit-limit" type="number" inputMode="numeric" min={1} max={10000} value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} className="sm:w-40" />
        </Field>
      </form>
    </Dialog>
  );
}
