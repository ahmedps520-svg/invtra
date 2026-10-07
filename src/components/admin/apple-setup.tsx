"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckCircle2, Download, FileKey2, Upload } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AppleStatus } from "@/server/apple/config";

/** Admin → Apple: set up Apple Wallet passes and Sign in with Apple, step by step. */
export function AppleSetup({ status, returnUrl, domain }: { status: AppleStatus; returnUrl: string; domain: string }) {
  return (
    <div className="space-y-8">
      <WalletSetup status={status} />
      {/* Re-mount when the Team ID becomes known (e.g. from the Wallet certificate). */}
      <SigninSetup key={status.teamId ?? "none"} status={status} returnUrl={returnUrl} domain={domain} />
    </div>
  );
}

function Panel({ title, ready, children, onRemove }: { title: string; ready: boolean; children: ReactNode; onRemove?: () => void }) {
  return (
    <section className="rounded-2xl border border-line bg-paper px-6 py-6 shadow-soft sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium", ready ? "bg-sage-soft text-sage" : "bg-sand text-ink-faint")}>
          {ready ? <CheckCircle2 className="size-3.5" /> : null}
          {ready ? "Ready" : "Not set up"}
        </span>
      </div>
      <div className="mt-5 space-y-5 text-[14px] leading-relaxed text-ink-soft">{children}</div>
      {ready && onRemove ? (
        <button type="button" onClick={onRemove} className="mt-6 text-[12.5px] font-medium text-ink-faint hover:text-rosewood">
          Turn off and remove the keys
        </button>
      ) : null}
    </section>
  );
}

function Step({ n, title, children, done }: { n: number; title: string; children?: ReactNode; done?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", done ? "bg-sage text-white" : "bg-sand text-ink")}>
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        {children ? <div className="mt-1.5 space-y-2.5">{children}</div> : null}
      </div>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => <code className="rounded bg-sand px-1.5 py-0.5 text-[12.5px] text-ink">{children}</code>;

function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<{ message?: string } | null | undefined>) {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.message) toast(r.message, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong.", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

function WalletSetup({ status }: { status: AppleStatus }) {
  const w = status.wallet;
  const { busy, run } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const isP12 = Boolean(file && /\.p12$/i.test(file.name));

  async function upload() {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    if (password) form.set("password", password);
    if (await run("upload", () => api<{ message: string }>("/api/admin/apple/certificate", { method: "POST", body: form }))) setFile(null);
  }

  return (
    <Panel
      title="Apple Wallet passes"
      ready={w.ready}
      onRemove={() => confirm("Turn off Apple Wallet passes? Passes guests already saved stop updating.") && run("remove", () => api("/api/admin/apple", { method: "POST", body: { action: "remove", part: "wallet" } }))}
    >
      <p>
        Guests who accept get <b>Add to Apple Wallet</b> on their invitation (iPhone, iPad and Mac): their entry QR, the date, time, venue and section, shown on the
        lock screen on the day — and updated by itself when you change the event or check them in.
      </p>
      {w.ready && w.certificate ? (
        <div className="rounded-xl border border-sage/25 bg-sage-soft/40 px-4 py-3">
          <p className="text-ink">
            <Code>{w.passTypeId}</Code> · Team <Code>{status.teamId}</Code>
          </p>
          <p className="mt-1 text-[13px]">
            Certificate valid until <b>{new Date(w.certificate.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</b> — Apple
            certificates last a year: repeat steps 2–4 before then.
          </p>
          <a href="/api/admin/apple/test-pass" className={buttonClasses("outline", "sm", "mt-3")}>
            <Download className="size-3.5" />
            Download a sample pass
          </a>
          <p className="mt-1.5 text-[12.5px] text-ink-faint">Open it on an iPhone (or AirDrop / email it to one) to see the pass.</p>
        </div>
      ) : null}
      <div className="space-y-5">
        <Step n={1} title="Create a Pass Type ID" done={w.ready}>
          <p>
            developer.apple.com → Account → <b>Certificates, IDs &amp; Profiles</b> → Identifiers → <b>+</b> → <b>Pass Type IDs</b> → Description <Code>INVTRA
            invitations</Code>, Identifier <Code>pass.store.invtra.invitation</Code> → Continue → Register.
          </p>
        </Step>
        <Step n={2} title="Download INVTRA's certificate request" done={w.ready && !w.csrPending}>
          <p>INVTRA creates the private key here — it never leaves the server.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant={w.csrPending ? "outline" : "primary"} size="sm" icon={<FileKey2 className="size-3.5" />} loading={busy === "csr"} onClick={() => run("csr", () => api("/api/admin/apple", { method: "POST", body: { action: "create_csr" } }))}>
              {w.csrPending ? "Create a new request" : "Create the request"}
            </Button>
            {w.csrPending ? (
              <a href="/api/admin/apple/csr" className={buttonClasses("primary", "sm")} download>
                <Download className="size-3.5" />
                Download INVTRA-Wallet.certSigningRequest
              </a>
            ) : null}
          </div>
        </Step>
        <Step n={3} title="Let Apple sign it">
          <p>
            Certificates, IDs &amp; Profiles → <b>Certificates</b> → <b>+</b> → <b>Pass Type ID Certificate</b> → choose your Pass Type ID → upload the request file →
            Continue → <b>Download</b> (you get <Code>pass.cer</Code>).
          </p>
        </Step>
        <Step n={4} title="Upload the certificate here" done={w.ready}>
          <div className="flex flex-wrap items-end gap-3">
            <label className={cn(buttonClasses("outline", "sm"), "cursor-pointer")}>
              <Upload className="size-3.5" />
              {file ? file.name : "Choose pass.cer"}
              <input type="file" accept=".cer,.crt,.pem,.p12" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {isP12 ? (
              <Field id="p12-pass" label="Password of the .p12" className="w-56">
                <Input id="p12-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
              </Field>
            ) : null}
            <Button variant="primary" size="sm" disabled={!file} loading={busy === "upload"} onClick={upload}>
              Upload
            </Button>
          </div>
          <p className="text-[12.5px] text-ink-faint">Made the certificate on a Mac instead? Upload the .p12 exported from Keychain with its password.</p>
        </Step>
      </div>
    </Panel>
  );
}

function SigninSetup({ status, returnUrl, domain }: { status: AppleStatus; returnUrl: string; domain: string }) {
  const s = status.signin;
  const { busy, run } = useAction();
  const [teamId, setTeamId] = useState(status.teamId ?? "");
  const [clientId, setClientId] = useState(s.clientId ?? "store.invtra.signin");
  const [keyId, setKeyId] = useState(s.keyId ?? "");
  const [p8, setP8] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const form = new FormData();
    form.set("teamId", teamId);
    form.set("clientId", clientId);
    form.set("keyId", keyId);
    if (p8) form.set("p8", p8);
    setErrors({});
    await run("signin", async () => {
      try {
        return await api<{ message: string }>("/api/admin/apple/signin", { method: "POST", body: form });
      } catch (e) {
        if (e instanceof ApiError && e.fields) setErrors(e.fields);
        throw e;
      }
    });
  }

  return (
    <Panel
      title="Sign in with Apple"
      ready={s.ready}
      onRemove={() => confirm("Turn off Sign in with Apple? Hosts who signed up with Apple sign in with “Forgot password” instead.") && run("remove", () => api("/api/admin/apple", { method: "POST", body: { action: "remove", part: "signin" } }))}
    >
      <p>
        Hosts can create an account and sign in with their Apple ID — <b>Continue with Apple</b> appears on the sign-in and sign-up pages once this is set up.
      </p>
      <div className="space-y-5">
        <Step n={1} title="An App ID with Sign in with Apple">
          <p>
            Identifiers → <b>+</b> → <b>App IDs</b> → App → Description <Code>INVTRA</Code>, Bundle ID (explicit) <Code>store.invtra.web</Code> → tick <b>Sign in with
            Apple</b> → Continue → Register.
          </p>
        </Step>
        <Step n={2} title="A Services ID for the website">
          <p>
            Identifiers → <b>+</b> → <b>Services IDs</b> → Description <Code>INVTRA sign in</Code>, Identifier <Code>store.invtra.signin</Code> → Register. Open it → tick{" "}
            <b>Sign in with Apple</b> → Configure → Primary App ID: INVTRA · Domains: <Code>{domain}</Code> · Return URLs: <Code>{returnUrl}</Code> → Next → Done →
            Save.
          </p>
        </Step>
        <Step n={3} title="A key">
          <p>
            <b>Keys</b> → <b>+</b> → Name <Code>INVTRA sign in</Code> → tick <b>Sign in with Apple</b> → Configure → INVTRA → Save → Continue → Register →{" "}
            <b>Download</b> the <Code>AuthKey_XXXXXXXXXX.p8</Code> file (Apple lets you download it only once) and note the <b>Key ID</b>.
          </p>
        </Step>
        <Step n={4} title="Enter them here" done={s.ready}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="apple-team" label="Team ID" hint="Top right of your developer account, or Membership details" error={errors.teamId}>
              <Input id="apple-team" value={teamId} onChange={(e) => setTeamId(e.target.value.toUpperCase())} placeholder="ABCDE12345" dir="ltr" autoComplete="off" />
            </Field>
            <Field id="apple-client" label="Services ID" error={errors.clientId}>
              <Input id="apple-client" value={clientId} onChange={(e) => setClientId(e.target.value.trim())} dir="ltr" autoComplete="off" />
            </Field>
            <Field id="apple-key" label="Key ID" error={errors.keyId}>
              <Input id="apple-key" value={keyId} onChange={(e) => setKeyId(e.target.value.toUpperCase())} placeholder="XXXXXXXXXX" dir="ltr" autoComplete="off" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className={cn(buttonClasses("outline", "sm"), "cursor-pointer")}>
              <Upload className="size-3.5" />
              {p8 ? p8.name : s.hasKey ? "Replace the .p8 key" : "Choose the .p8 key"}
              <input
                type="file"
                accept=".p8"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setP8(f);
                  const id = f?.name.match(/AuthKey_([A-Z0-9]{10})\.p8$/i)?.[1];
                  if (id && !keyId) setKeyId(id.toUpperCase());
                }}
              />
            </label>
            <Button variant="primary" size="sm" loading={busy === "signin"} onClick={save} disabled={!teamId || !clientId || !keyId || (!p8 && !s.hasKey)}>
              Save
            </Button>
          </div>
          {errors.p8 ? <p className="text-[13px] text-rosewood">{errors.p8}</p> : null}
        </Step>
        <Step n={5} title="Emails to “Hide My Email” addresses">
          <p>
            Hosts may hide their email from you. So receipts and password emails reach them: Certificates, IDs &amp; Profiles → <b>Services</b> → Sign in with Apple for
            Email Communication → add <Code>{domain}</Code> and <Code>contact@{domain}</Code>.
          </p>
        </Step>
      </div>
    </Panel>
  );
}
