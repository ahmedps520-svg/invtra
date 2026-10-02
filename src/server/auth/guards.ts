import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/server/auth/session";

/** For Server Components / pages: redirect to sign-in when there is no session. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
