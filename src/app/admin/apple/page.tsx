import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { appUrl } from "@/server/env";
import { appleStatus } from "@/server/apple/config";
import { PageHeader } from "@/components/admin/ui";
import { AppleSetup } from "@/components/admin/apple-setup";

export const metadata: Metadata = { title: "Apple" };

/** Apple Developer integrations: Wallet passes and Sign in with Apple. */
export default async function ApplePage() {
  await requireAdmin();
  const status = await appleStatus();
  const returnUrl = appUrl("/api/auth/apple/callback");
  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Apple"
        description="Uses your Apple Developer Program membership. Keys are stored encrypted on the server and never shown again. (Apple Pay needs nothing here — it's on Tap's payment page.)"
      />
      <AppleSetup status={status} returnUrl={returnUrl} domain={new URL(returnUrl).hostname} />
    </>
  );
}
