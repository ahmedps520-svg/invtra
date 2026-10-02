import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { SettingsPage } from "@/components/dashboard/settings";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.settings };
}

export default async function Settings() {
  const session = await requireUser("/dashboard/settings");
  const { locale } = await getI18n();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { name: true, email: true, phone: true, locale: true } });
  return <SettingsPage user={{ ...user, locale }} />;
}
