import type { NextRequest } from "next/server";
import { registerDevice, unregisterDevice } from "@/server/apple/webservice";

type Ctx = { params: Promise<{ device: string; passType: string; serial: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  return registerDevice(req, await ctx.params);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return unregisterDevice(req, await ctx.params);
}
