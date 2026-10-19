/**
 * Seeds reference data (themes, WhatsApp templates) and the first admin account.
 * Safe to run repeatedly: `npm run db:seed`.
 *
 * With SEED_DEMO=true it also creates a demo customer with a sample wedding.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { THEME_LIST } from "../src/lib/themes/registry";
import { templateCatalog } from "../src/server/whatsapp/catalog";
import { hashPassword } from "../src/server/auth/password";
import { zonedToUtc } from "../src/lib/time";

const db = new PrismaClient();

async function main() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  // The live site never simulates WhatsApp: there, templates only become APPROVED when Meta
  // approves them (Admin → Templates → Submit / Sync). Only a development database marks them
  // usable straight away.
  const live = process.env.NODE_ENV === "production" && process.env.LOCAL_TEST_MODE !== "true";
  const mock = !live && (process.env.WHATSAPP_PROVIDER ?? "mock") === "mock";

  for (const [i, t] of THEME_LIST.entries()) {
    await db.invitationTheme.upsert({
      where: { key: t.key },
      create: { key: t.key, isPremium: t.premium, sortOrder: i, isActive: true },
      update: {}, // admins control isPremium/isActive afterwards (Admin → Themes)
    });
  }

  for (const t of templateCatalog(appUrl)) {
    const data = {
      name: t.name,
      nameAr: t.nameAr,
      description: t.description,
      purpose: t.purpose,
      metaName: t.metaName,
      language: t.language,
      locale: t.locale,
      category: t.category,
      headerType: t.headerType,
      body: t.body,
      variables: t.variables as unknown as Prisma.InputJsonValue,
      footer: t.footer,
      buttons: t.buttons as unknown as Prisma.InputJsonValue,
      eventTypes: t.eventTypes,
      sortOrder: t.sortOrder,
    };
    const existing = await db.messageTemplate.findUnique({ where: { key: t.key }, select: { status: true, metaTemplateId: true } });
    if (!existing) {
      // With the mock provider templates are usable immediately; with the real Cloud API
      // they start as DRAFT until submitted to / approved by Meta (Admin → Templates).
      await db.messageTemplate.create({ data: { key: t.key, ...data, status: mock ? "APPROVED" : "DRAFT" } });
    } else if (existing.status === "DRAFT" || existing.status === "REJECTED" || (mock && !existing.metaTemplateId)) {
      // Not (or not successfully) submitted yet: take the catalog's latest wording, category and buttons.
      await db.messageTemplate.update({ where: { key: t.key }, data });
    } else {
      // Submitted to Meta: what Meta reviewed stays as it is; only INVTRA's own labels follow the catalog.
      await db.messageTemplate.update({
        where: { key: t.key },
        data: { name: t.name, nameAr: t.nameAr, description: t.description, eventTypes: t.eventTypes, sortOrder: t.sortOrder },
      });
    }
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      await db.user.create({ data: { email, name: "INVTRA Admin", role: "ADMIN", passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
      console.log(`Created admin ${email}`);
    } else if (existing.role !== "ADMIN") {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", emailVerifiedAt: existing.emailVerifiedAt ?? new Date() } });
      console.log(`Promoted ${email} to admin`);
    }
  }

  // The live site has no demo account (its password is public); it's switched off if it exists.
  if (live) {
    const demo = await db.user.findUnique({ where: { email: "demo@invtra.store" } });
    if (demo && demo.status === "ACTIVE") {
      await db.user.update({ where: { id: demo.id }, data: { status: "DEACTIVATED" } });
      await db.session.deleteMany({ where: { userId: demo.id } });
      console.log("Deactivated the demo account");
    }
  } else if (process.env.SEED_DEMO === "true") await seedDemo();
  console.log("Seed complete.");
}

async function seedDemo() {
  const email = "demo@invtra.store";
  let user = await db.user.findUnique({ where: { email } });
  if (!user) user = await db.user.create({ data: { email, name: "Sara Al Mansoori", passwordHash: await hashPassword("demo-password-2026"), emailVerifiedAt: new Date() } });
  const has = await db.event.findFirst({ where: { userId: user.id } });
  if (has) return;
  const theme = THEME_LIST.find((t) => t.key === "luxury")!;
  const event = await db.event.create({
    data: {
      userId: user.id,
      type: "WEDDING",
      language: "BILINGUAL",
      title: "The Wedding of Ahmed & Sara",
      titleAr: "حفل زفاف أحمد وسارة",
      hostNames: "Ahmed & Sara",
      hostNamesAr: "أحمد و سارة",
      startsAt: zonedToUtc("2027-02-14", "19:30", "Asia/Dubai"),
      timezone: "Asia/Dubai",
      venueName: "The Grand Ballroom, Four Seasons Resort",
      venueNameAr: "القاعة الكبرى، فندق فور سيزونز",
      address: "Jumeirah Beach Road, Dubai",
      addressAr: "شارع جميرا، دبي",
      mapsUrl: "https://maps.google.com/?q=Four+Seasons+Resort+Dubai+at+Jumeirah+Beach",
      dressCode: "Black tie",
      dressCodeAr: "رسمي",
      themeKey: theme.key,
      design: theme.defaults as unknown as Prisma.InputJsonValue,
      plan: "PREMIUM",
      guestLimit: 500,
      scheduleItems: {
        create: [
          { time: "19:30", title: "Guest arrival", titleAr: "استقبال الضيوف", sortOrder: 0 },
          { time: "20:30", title: "Zaffa & ceremony", titleAr: "الزفة", sortOrder: 1 },
          { time: "21:30", title: "Dinner", titleAr: "العشاء", sortOrder: 2 },
        ],
      },
    },
  });
  const names = ["Khalid Al Hashimi", "Noura Al Suwaidi", "Omar Haddad", "Layla Nasser", "Faisal Al Qasimi", "Mariam Saeed"];
  for (const [i, name] of names.entries()) {
    await db.guest.create({ data: { eventId: event.id, name, phone: `+97150123${String(4500 + i).padStart(4, "0")}`, allowedCount: (i % 3) + 1 } });
  }
  console.log(`Demo customer: ${email} / demo-password-2026`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
