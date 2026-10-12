import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/server/auth/session";
import { isLocked } from "@/lib/auth/verification";

/**
 * For Server Components / pages: redirect to sign-in when there is no session, and to the
 * verification page when the account is deactivated for not verifying its email.
 */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (isLocked(user)) redirect(next ? `/verify-email?next=${encodeURIComponent(next)}` : "/verify-email");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
