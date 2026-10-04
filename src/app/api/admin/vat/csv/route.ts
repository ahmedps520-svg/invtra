import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseQuery, requireApiAdmin, route } from "@/server/http";
import { monthCsv } from "@/server/admin/tax";

/** One month's receipts and refunds with the VAT on each line, for the accountant. */
export const GET = route("admin.vat.csv", async (req: NextRequest) => {
  await requireApiAdmin();
  const { month } = parseQuery(req, z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }));
  return new NextResponse(await monthCsv(month), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invtra-vat-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
