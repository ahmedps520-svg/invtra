import { db } from "@/server/db";
import { notFound } from "@/server/http";
import { audit } from "@/server/log";
import { isThemeKey, THEME_LIST } from "@/lib/themes/registry";

/** The code-defined themes joined with their operational settings and usage. */
export async function listThemes() {
  const [rows, usage] = await Promise.all([
    db.invitationTheme.findMany(),
    db.event.groupBy({ by: ["themeKey"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const used = new Map(usage.map((u) => [u.themeKey, u._count._all]));
  return THEME_LIST.map((t, i) => {
    const row = byKey.get(t.key);
    return {
      key: t.key,
      recommendedLanguage: t.recommendedLanguage,
      defaultPremium: t.premium,
      isActive: row?.isActive ?? true,
      isPremium: row?.isPremium ?? t.premium,
      sortOrder: row?.sortOrder ?? i,
      configured: Boolean(row),
      updatedAt: row?.updatedAt ?? null,
      events: used.get(t.key) ?? 0,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

export async function updateTheme(actorId: string, key: string, patch: { isActive?: boolean; isPremium?: boolean; sortOrder?: number }) {
  if (!isThemeKey(key)) throw notFound("Theme");
  const def = THEME_LIST.find((t) => t.key === key)!;
  const before = await db.invitationTheme.findUnique({ where: { key } });
  const row = await db.invitationTheme.upsert({
    where: { key },
    create: {
      key,
      isActive: patch.isActive ?? true,
      isPremium: patch.isPremium ?? def.premium,
      sortOrder: patch.sortOrder ?? THEME_LIST.indexOf(def),
    },
    update: patch,
  });
  await audit(actorId, "admin.theme.update", "theme", key, {
    changes: patch,
    before: before ? { isActive: before.isActive, isPremium: before.isPremium, sortOrder: before.sortOrder } : null,
  });
  return row;
}
