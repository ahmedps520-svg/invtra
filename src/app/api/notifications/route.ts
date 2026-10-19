import { ok, requireApiSession, route } from "@/server/http";
import { listNotifications } from "@/server/notifications";

/** The bell: latest notifications and how many are unread. */
export const GET = route("notifications.list", async () => {
  const user = await requireApiSession();
  return ok(await listNotifications(user.id));
});
