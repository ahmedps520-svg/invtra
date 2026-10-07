import type { NextRequest } from "next/server";
import { latestPass } from "@/server/apple/webservice";

export async function GET(req: NextRequest, ctx: { params: Promise<{ passType: string; serial: string }> }) {
  return latestPass(req, await ctx.params);
}
