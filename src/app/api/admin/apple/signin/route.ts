import type { NextRequest } from "next/server";
import { ok, requireApiAdmin, route } from "@/server/http";
import { audit } from "@/server/log";
import { installSigninKey } from "@/server/apple/config";

/** Sign in with Apple: Team ID, Services ID, Key ID and the .p8 key file. */
export const POST = route("admin.apple.signin", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const form = await req.formData();
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const file = form.get("p8");
  const p8 = file instanceof File && file.size > 0 && file.size < 8 * 1024 ? await file.text() : null;
  await installSigninKey({ teamId: text("teamId").toUpperCase(), clientId: text("clientId"), keyId: text("keyId").toUpperCase(), p8 });
  await audit(admin.id, "admin.apple.signin", "setting", "apple.signin", { clientId: text("clientId"), keyId: text("keyId") });
  return ok({ message: "Sign in with Apple is ready" });
});
