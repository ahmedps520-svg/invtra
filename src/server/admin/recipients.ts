import { db } from "@/server/db";
import { env } from "@/server/env";

/** Who gets staff emails (VAT statements, orders to verify): active admins plus ADMIN_EMAIL. */
export async function adminRecipients(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { email: true } });
  const list = admins.map((a) => a.email.toLowerCase());
  const configured = env().ADMIN_EMAIL?.toLowerCase();
  if (configured) list.push(configured);
  return [...new Set(list)];
}
