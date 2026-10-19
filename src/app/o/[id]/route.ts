import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/server/env";

type Ctx = { params: Promise<{ id: string }> };

/** Short link used by the WhatsApp "order ready" button: opens the order (sign-in required). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(appUrl(`/dashboard/orders/${id}`));
}
