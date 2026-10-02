import { HttpError, ok, requireApiAdmin, route } from "@/server/http";
import { audit, logError } from "@/server/log";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { MetaGraphError, syncTemplatesFromMeta } from "@/server/whatsapp/meta-templates";

/** Pull template statuses (approved / rejected / paused …) from WhatsApp Manager. */
export const POST = route("admin.templates.sync", async () => {
  const admin = await requireApiAdmin();
  await enforceRateLimit(`admin.meta:${admin.id}`, 30, 600);
  try {
    const r = await syncTemplatesFromMeta();
    if (r.simulated) {
      return ok({ result: r, notice: "Nothing to sync — WhatsApp is in mock mode (templates are approved locally)." });
    }
    await audit(admin.id, "admin.template.sync", "template", "all", {
      remote: r.remote,
      matched: r.matched,
      changed: r.changed.map((c) => `${c.name}: ${c.from} → ${c.to}`),
      remoteOnly: r.remoteOnly.length,
      missingAtMeta: r.missingAtMeta,
    });
    const parts = [`Synced ${r.matched} of ${r.remote} Meta templates`, r.changed.length ? `${r.changed.length} changed` : "no status changes"];
    if (r.missingAtMeta.length) parts.push(`${r.missingAtMeta.length} missing at Meta`);
    return ok({ result: r, message: parts.join(" · ") });
  } catch (e) {
    if (e instanceof MetaGraphError) {
      await logError("admin:templates.sync", e, { code: e.code, fbtraceId: e.fbtraceId }, "warn");
      throw new HttpError(502, "meta_error", `Meta: ${e.message}${e.code ? ` (code ${e.code})` : ""}`);
    }
    throw e;
  }
});
