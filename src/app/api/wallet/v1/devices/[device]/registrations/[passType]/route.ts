import type { NextRequest } from "next/server";
import { changedPasses } from "@/server/apple/webservice";

export async function GET(req: NextRequest, ctx: { params: Promise<{ device: string; passType: string }> }) {
  return changedPasses(req, await ctx.params);
}
