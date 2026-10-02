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
  const mock = (process.env.WHATSAPP_PROVIDER ?? "mock") === "mock";

  for (const [i, t] of THEME_LIST.entries()) {
    await db.invitationTheme.upsert({
      where: { key: t.key },
      create: { key: t.key, isPremium: t.premium, sortOrder: i, isActive: true },
      update: {},
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
    await db.messageTemplate.upsert({
      where: { key: t.key },
      // With the mock provider templates are usable immediately; with the real Cloud API
      // they start as DRAFT until submitted to / approved by Meta (Admin → Templates).
      create: { key: t.key, ...data, status: mock ? "APPROVED" : "DRAFT" },
      update: data,
    });
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      await db.user.create({ data: { email, name: "INVTRA Admin", role: "ADMIN", passwordHash: await hashPassword(password) } });
      console.log(`Created admin ${email}`);
    } else if (existing.role !== "ADMIN") {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
      console.log(`Promoted ${email} to admin`);
    }
  }

  if (process.env.SEED_DEMO === "true") await seedDemo();
  console.log("Seed complete.");
}

async function seedDemo() {
  const email = "demo@invtra.store";
  let user = await db.user.findUnique({ where: { email } });
  if (!user) user = await db.user.create({ data: { email, name: "Sara Al Mansoori", passwordHash: await hashPassword("demo-password-2026") } });
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
