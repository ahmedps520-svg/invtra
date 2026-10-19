import { ok, requireApiAdmin, route } from "@/server/http";
import { whatsappAccountStatus } from "@/server/whatsapp/account";

/** Ask Meta again now (Admin → WhatsApp & Meta → Check again). */
export const POST = route("admin.whatsapp.status", async () => {
  await requireApiAdmin();
  const status = await whatsappAccountStatus({ fresh: true });
  return ok({ message: status.ok ? "Meta says the account can send." : "Checked with Meta — see the problems listed." });
});
