import { destroySession } from "@/server/auth/session";
import { ok, route } from "@/server/http";

export const POST = route("auth.logout", async () => {
  await destroySession();
  return ok();
});
