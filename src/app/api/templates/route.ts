import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { ok, requireApiUser, route } from "@/server/http";
import { namedBody } from "@/lib/whatsapp/templates";

/** Approved invitation templates customers can choose from. */
export const GET = route("templates.list", async (req: NextRequest) => {
  await requireApiUser();
  const locale = req.nextUrl.searchParams.get("locale");
  const templates = await db.messageTemplate.findMany({
    where: { purpose: "INVITATION", status: "APPROVED", isActive: true, ...(locale ? { locale } : {}) },
    orderBy: { sortOrder: "asc" },
  });
  return ok({
    templates: templates.map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      nameAr: t.nameAr,
      description: t.description,
      locale: t.locale,
      language: t.language,
      headerType: t.headerType,
      body: t.body,
      namedBody: namedBody({ body: t.body, variables: t.variables as string[] as never }),
      variables: t.variables,
      footer: t.footer,
      buttons: t.buttons,
      eventTypes: t.eventTypes,
    })),
  });
});
