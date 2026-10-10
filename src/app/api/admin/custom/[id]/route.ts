import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  badRequest,
  ok,
  parseJson,
  requireApiAdmin,
  route,
} from "@/server/http";
import { audit } from "@/server/log";
import {
  cancelCustomPackage,
  sendPaymentRequest,
} from "@/server/custom/service";
import { undoTestPayment } from "@/server/payments/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    whatsapp: z.boolean().default(false),
    email: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().max(500).default(""),
  }),
  z.object({ action: z.literal("undo_test") }),
]);

/** Admin: resend a payment link (WhatsApp / email) or withdraw the package. */
export const POST = route<Ctx>(
  "admin.custom.action",
  async (req: NextRequest, ctx) => {
    const admin = await requireApiAdmin();
    const { id } = await ctx.params;
    const input = await parseJson(req, schema);
    if (input.action === "send") {
      if (!input.whatsapp && !input.email)
        throw badRequest("no_channel", "Choose WhatsApp, email or both.");
      const r = await sendPaymentRequest(id, input);
      await audit(admin.id, "admin.custom.send", "order", id, r);
      return ok({
        message:
          [r.whatsapp && "WhatsApp message queued", r.email && "email sent"]
            .filter(Boolean)
            .join(" · ") || "Nothing was sent",
      });
    }
    if (input.action === "undo_test") {
      await undoTestPayment(id);
      await audit(admin.id, "admin.custom.undo_test_payment", "order", id);
      return ok({
        message: "Test payment undone — the link is awaiting payment again",
      });
    }
    await cancelCustomPackage(admin.id, id);
    return ok({
      message: "Package withdrawn — the payment link no longer works",
    });
  },
);
