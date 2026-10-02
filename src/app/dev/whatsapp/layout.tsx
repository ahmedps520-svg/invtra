import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/server/env";
import { requireUser } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "WhatsApp simulator",
  robots: { index: false, follow: false },
};

/** Development-only: available with WHATSAPP_PROVIDER=mock, for signed-in users. */
export default async function SimulatorLayout({ children }: { children: React.ReactNode }) {
  if (env().WHATSAPP_PROVIDER !== "mock") notFound();
  await requireUser("/dev/whatsapp");
  return <div className="min-h-dvh bg-ivory">{children}</div>;
}
