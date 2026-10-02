import { randomBytes } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

// Cloud-mode configuration so the Meta Graph code paths run (fetch is stubbed below).
// Must be set before the env module is first read.
Object.assign(process.env, {
  WHATSAPP_PROVIDER: "cloud",
  WHATSAPP_ACCESS_TOKEN: "test-token",
  WHATSAPP_PHONE_NUMBER_ID: "PNID",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "WABA123",
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || "test-app-secret",
  WHATSAPP_VERIFY_TOKEN: "verify",
  WHATSAPP_APP_ID: "APP42",
  WHATSAPP_API_VERSION: "v23.0",
});

const { db } = await import("@/server/db");
const { THEMES } = await import("@/lib/themes/registry");
const { templateCatalog } = await import("@/server/whatsapp/catalog");
const { templateInputSchema, templateShapeErrors, createTemplate, updateTemplate } = await import("@/server/admin/templates");
const meta = await import("@/server/whatsapp/meta-templates");
const customers = await import("@/server/admin/customers");
const events = await import("@/server/admin/events");
const messages = await import("@/server/admin/messages");
const jobs = await import("@/server/admin/jobs");
const errors = await import("@/server/admin/errors");

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];
const templateIds: string[] = [];

async function makeUser(tag: string, role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
  const u = await db.user.create({ data: { email: `admin-test-${tag}-${run}@example.test`, name: `Admin Test ${tag}`, passwordHash: "x", role } });
  userIds.push(u.id);
  return u;
}

async function makeEvent(userId: string) {
  return db.event.create({
    data: {
      userId,
      title: `Admin Test Event ${run}`,
      hostNames: "A & B",
      startsAt: new Date(Date.now() + 60 * 86_400_000),
      venueName: "Venue",
      address: "Address",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan: "PREMIUM",
      guestLimit: 500,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  const evs = await db.event.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  await db.job.deleteMany({ where: { eventId: { in: evs.map((e) => e.id) } } });
  await db.job.deleteMany({ where: { id: { startsWith: `admtest${run}` } } });
  await db.messageTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.errorLog.deleteMany({ where: { source: `test:${run}` } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

// ── Template rules ──────────────────────────────────────────────────────────

const base = {
  purpose: "INVITATION" as const,
  footer: null,
  buttons: [
    { type: "QUICK_REPLY" as const, text: "Accept", action: "ACCEPT" as const },
    { type: "QUICK_REPLY" as const, text: "Decline", action: "DECLINE" as const },
  ],
};

describe("template validation", () => {
  it("accepts every template in INVTRA's catalogue", () => {
    for (const t of templateCatalog("https://invtra.store")) {
      const r = templateInputSchema.safeParse({ ...t, nameAr: t.nameAr, description: t.description });
      expect(r.success, `${t.key}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it("enforces Meta's placeholder rules", () => {
    const check = (body: string, variables: string[]) => templateShapeErrors({ ...base, body, variables });
    expect(check("Dear {{1}}, you are invited to {{2}}. Will you come?", ["guest_name", "event_name"])).toEqual({});
    expect(check("{{1}}, you are invited to our party. Will you come?", ["guest_name"]).body).toMatch(/start/);
    expect(check("You are invited to our lovely party, {{1}}", ["guest_name"]).body).toMatch(/end/);
    expect(check("Dear {{1}} {{2}}, you are invited to our party.", ["guest_name", "event_name"]).body).toMatch(/next to each other/);
    expect(check("Dear {{1}}, you are invited to {{3}}. Will you come?", ["guest_name", "event_name"]).body).toMatch(/order/);
    expect(check("Dear {{name}}, you are invited to our party.", []).body).toMatch(/numbers only/);
    expect(check("Dear {{1}}, you are invited to {{2}}. Will you come?", ["guest_name"]).variables).toMatch(/2 variables but 1/);
  });

  it("requires Accept + Decline quick replies for invitations and a {{1}} URL for updates", () => {
    const body = "Dear {{1}}, you are invited to our party. Will you come?";
    expect(templateShapeErrors({ ...base, body, variables: ["guest_name"], buttons: [base.buttons[0]] }).buttons).toBeDefined();
    const update = { ...base, purpose: "UPDATE" as const, body, variables: ["guest_name"] };
    expect(templateShapeErrors({ ...update, buttons: [{ type: "URL", text: "View", url: "https://invtra.store/i/{{1}}" }] })).toEqual({});
    expect(templateShapeErrors({ ...update, buttons: [{ type: "URL", text: "View", url: "https://invtra.store/i/" }] })["buttons.0.url"]).toBeDefined();
    expect(templateShapeErrors({ ...update, buttons: base.buttons }).buttons).toBeDefined();
  });

  it("only lets DRAFT / REJECTED templates be edited", async () => {
    const admin = await makeUser("tpl", "ADMIN");
    const input = templateInputSchema.parse({
      name: "Test template",
      metaName: `invtra_test_${run}`,
      language: "en",
      locale: "en",
      purpose: "INVITATION",
      category: "UTILITY",
      headerType: "NONE",
      body: "Dear {{1}}, you are invited to {{2}}. Will you come?",
      variables: ["guest_name", "event_name"],
      footer: "Sent with INVTRA",
      buttons: base.buttons,
      eventTypes: ["WEDDING"],
    });
    const t = await createTemplate(admin.id, input);
    templateIds.push(t.id);
    expect(t.status).toBe("DRAFT");
    const edited = await updateTemplate(admin.id, t.id, { ...input, name: "Renamed" });
    expect(edited.name).toBe("Renamed");
    await db.messageTemplate.update({ where: { id: t.id }, data: { status: "APPROVED" } });
    await expect(updateTemplate(admin.id, t.id, input)).rejects.toMatchObject({ code: "template_locked" });
  });
});

// ── Meta Graph API ──────────────────────────────────────────────────────────

type Call = { url: string; init: RequestInit };
function stubFetch(responder: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const u = String(url);
      calls.push({ url: u, init });
      const r = responder(u, init);
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

describe("Meta template components", () => {
  it("builds header / body examples / footer / buttons", () => {
    const [update] = templateCatalog("https://invtra.store").filter((t) => t.key === "update_en");
    const c = meta.buildTemplateComponents(update as never, "4::HANDLE");
    expect(c[0]).toEqual({ type: "HEADER", format: "IMAGE", example: { header_handle: ["4::HANDLE"] } });
    expect(c[1]).toMatchObject({ type: "BODY", text: update.body, example: { body_text: [[meta.SAMPLE_VALUES.guest_name, meta.SAMPLE_VALUES.event_name]] } });
    expect(c[2]).toEqual({ type: "FOOTER", text: "Sent with INVTRA" });
    expect(c[3]).toEqual({
      type: "BUTTONS",
      buttons: [{ type: "URL", text: "View Invitation", url: "https://invtra.store/i/{{1}}", example: [`https://invtra.store/i/${meta.SAMPLE_VALUES.invitation_token}`] }],
    });
    expect(() => meta.buildTemplateComponents(update as never, null)).toThrow(/image handle/);
  });
});

describe("Meta Graph API (cloud mode, stubbed)", () => {
  async function draft(headerType: "IMAGE" | "NONE", metaTemplateId: string | null = null) {
    const t = await db.messageTemplate.create({
      data: {
        key: `test_${run}_${randomBytes(3).toString("hex")}`,
        name: "Graph test",
        metaName: `invtra_graph_${run}_${randomBytes(3).toString("hex")}`,
        language: "en",
        locale: "en",
        purpose: "INVITATION",
        category: "UTILITY",
        headerType,
        body: "Dear {{1}}, you are invited to {{2}}. Will you come?",
        variables: ["guest_name", "event_name"],
        footer: "Sent with INVTRA",
        buttons: base.buttons,
        eventTypes: ["WEDDING"],
        status: metaTemplateId ? "REJECTED" : "DRAFT",
        metaTemplateId,
      },
    });
    templateIds.push(t.id);
    return t;
  }

  it("uploads the example image (resumable upload) and submits the template", async () => {
    const t = await draft("IMAGE");
    const calls = stubFetch((url) => {
      if (url.includes("/APP42/uploads")) return { body: { id: "upload:MTphdHRh" } };
      if (url.endsWith("/upload:MTphdHRh")) return { body: { h: "4::aW1hZ2U=" } };
      if (url.endsWith("/WABA123/message_templates")) return { body: { id: "1234567890", status: "PENDING", category: "UTILITY" } };
      return { status: 404, body: { error: { message: "unexpected" } } };
    });
    const r = await meta.submitTemplateToMeta(t);
    expect(r.simulated).toBe(false);
    expect(r.template).toMatchObject({ status: "PENDING", metaTemplateId: "1234567890" });

    expect(calls).toHaveLength(3);
    const session = new URL(calls[0].url);
    expect(session.pathname).toBe("/v23.0/APP42/uploads");
    expect(session.searchParams.get("file_type")).toBe("image/png");
    expect(Number(session.searchParams.get("file_length"))).toBeGreaterThan(1000);
    expect(session.searchParams.get("access_token")).toBe("test-token");
    const uploadHeaders = new Headers(calls[1].init.headers);
    expect(uploadHeaders.get("authorization")).toBe("OAuth test-token");
    expect(uploadHeaders.get("file_offset")).toBe("0");
    const body = JSON.parse(String(calls[2].init.body));
    expect(body).toMatchObject({ name: t.metaName, language: "en", category: "UTILITY" });
    expect(body.components[0]).toEqual({ type: "HEADER", format: "IMAGE", example: { header_handle: ["4::aW1hZ2U="] } });
    expect(new Headers(calls[2].init.headers).get("authorization")).toBe("Bearer test-token");
  });

  it("edits a template Meta already knows instead of creating it again", async () => {
    const t = await draft("NONE", "999888777");
    const calls = stubFetch(() => ({ body: { success: true } }));
    const r = await meta.submitTemplateToMeta(t);
    expect(r.edited).toBe(true);
    expect(calls[0].url).toMatch(/\/v23\.0\/999888777$/);
    expect(r.template.status).toBe("PENDING");
  });

  it("surfaces Graph API errors with Meta's user-facing message", async () => {
    const t = await draft("NONE");
    stubFetch(() => ({
      status: 400,
      body: { error: { message: "Invalid parameter", code: 100, error_subcode: 2388023, error_user_title: "Language is being deleted", error_user_msg: "Try again in 4 weeks", fbtrace_id: "abc" } },
    }));
    const err = await meta.submitTemplateToMeta(t).catch((e) => e);
    expect(err).toBeInstanceOf(meta.MetaGraphError);
    expect(err.message).toBe("Language is being deleted: Try again in 4 weeks");
    expect(err.code).toBe(100);
    expect(err.subcode).toBe(2388023);
    expect((await db.messageTemplate.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("DRAFT");
  });

  it("syncs statuses across pages, matching on name + language", async () => {
    const a = await draft("NONE");
    const b = await draft("NONE");
    const calls = stubFetch((url) => {
      if (url.includes("after=PAGE2")) {
        return { body: { data: [{ id: "B1", name: b.metaName, language: "en", status: "REJECTED", category: "UTILITY", rejected_reason: "INVALID_FORMAT" }] } };
      }
      return {
        body: {
          data: [
            { id: "A1", name: a.metaName, language: "en", status: "APPROVED", category: "MARKETING", rejected_reason: "NONE" },
            { id: "X1", name: "someone_elses_template", language: "en_US", status: "APPROVED" },
          ],
          paging: { next: "https://graph.facebook.com/v23.0/WABA123/message_templates?after=PAGE2" },
        },
      };
    });
    const r = await meta.fetchRemoteTemplates();
    expect(r.map((x) => x.id)).toEqual(["A1", "X1", "B1"]);
    expect(calls[0].url).toContain("/WABA123/message_templates?fields=id,name,status,language,category,rejected_reason&limit=100");

    const sync = await meta.syncTemplatesFromMeta();
    expect(sync.simulated).toBe(false);
    expect(sync.remoteOnly).toContain("someone_elses_template (en_US)");
    const [ra, rb] = await Promise.all([db.messageTemplate.findUniqueOrThrow({ where: { id: a.id } }), db.messageTemplate.findUniqueOrThrow({ where: { id: b.id } })]);
    expect(ra).toMatchObject({ status: "APPROVED", metaTemplateId: "A1", category: "MARKETING", rejectedReason: null });
    expect(ra.lastSyncedAt).toBeInstanceOf(Date);
    expect(rb).toMatchObject({ status: "REJECTED", metaTemplateId: "B1", rejectedReason: "INVALID_FORMAT" });
  });

  it("maps Meta statuses", () => {
    expect(meta.mapMetaStatus("APPROVED")).toBe("APPROVED");
    expect(meta.mapMetaStatus("IN_APPEAL")).toBe("PENDING");
    expect(meta.mapMetaStatus("PAUSED")).toBe("PAUSED");
    expect(meta.mapMetaStatus("DISABLED")).toBe("DISABLED");
    expect(meta.mapMetaStatus("weird")).toBeNull();
  });
});

// ── Admin services ──────────────────────────────────────────────────────────

describe("admin actions", () => {
  it("deactivates an account (sessions revoked, events optionally deactivated) and reactivates it", async () => {
    const admin = await makeUser("actor", "ADMIN");
    const customer = await makeUser("cust");
    const event = await makeEvent(customer.id);
    await db.session.create({ data: { userId: customer.id, tokenHash: `hash-${run}`, expiresAt: new Date(Date.now() + 86_400_000) } });
    await db.job.create({ data: { type: "invitation.request", payload: { guestId: "nobody" }, eventId: event.id } });

    await expect(customers.deactivateCustomer(admin.id, admin.id, { reason: "self", alsoEvents: false })).rejects.toMatchObject({ code: "cannot_deactivate_self" });
    const r = await customers.deactivateCustomer(admin.id, customer.id, { reason: "Fraud review", alsoEvents: true });
    expect(r).toEqual({ sessions: 1, events: 1 });
    const [u, e] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: customer.id } }), db.event.findUniqueOrThrow({ where: { id: event.id } })]);
    expect(u).toMatchObject({ status: "DEACTIVATED", deactivationNote: "Fraud review" });
    expect(e.deactivatedAt).toBeInstanceOf(Date);
    expect(await db.job.count({ where: { eventId: event.id, status: "PENDING" } })).toBe(0);
    expect(await db.auditLog.count({ where: { actorId: admin.id, action: "admin.user.deactivate", targetId: customer.id } })).toBe(1);

    await customers.reactivateCustomer(admin.id, customer.id, { reason: "", alsoEvents: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe("ACTIVE");
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).deactivatedAt).toBeNull();
  });

  it("deactivating an event cancels its pending jobs", async () => {
    const admin = await makeUser("actor2", "ADMIN");
    const customer = await makeUser("cust2");
    const event = await makeEvent(customer.id);
    await db.job.create({ data: { type: "invitation.deliver", payload: { guestId: "nobody" }, eventId: event.id } });
    const r = await events.deactivateEvent(admin.id, event.id, "Abuse report");
    expect(r.jobs).toBe(1);
    await expect(events.deactivateEvent(admin.id, event.id, "again")).rejects.toMatchObject({ code: "already_deactivated" });
    await events.reactivateEvent(admin.id, event.id, "");
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).deactivatedAt).toBeNull();
  });

  it("retries a failed invitation request exactly once", async () => {
    const admin = await makeUser("actor3", "ADMIN");
    const customer = await makeUser("cust3");
    const event = await makeEvent(customer.id);
    const guest = await db.guest.create({ data: { eventId: event.id, name: "Guest", phone: "+971501230000", deliveryStatus: "FAILED", status: "FAILED", deliveryError: "not_on_whatsapp" } });
    const msg = await db.whatsAppMessage.create({
      data: { eventId: event.id, guestId: guest.id, direction: "OUTBOUND", purpose: "INVITATION_REQUEST", provider: "mock", phone: guest.phone, type: "template", status: "FAILED", errorCode: "131026" },
    });
    await messages.retryInvitationRequest(admin.id, msg.id);
    const g = await db.guest.findUniqueOrThrow({ where: { id: guest.id } });
    expect(g).toMatchObject({ deliveryStatus: "QUEUED", deliveryError: null, status: "PENDING" });
    const queued = await db.job.findMany({ where: { eventId: event.id, type: "invitation.request", status: "PENDING" } });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ priority: 5, payload: { guestId: guest.id } });
    await expect(messages.retryInvitationRequest(admin.id, msg.id)).rejects.toMatchObject({ code: "already_queued" });
  });

  it("retries a failed job with a fresh retry budget", async () => {
    const admin = await makeUser("actor4", "ADMIN");
    const job = await db.job.create({ data: { id: `admtest${run}a`, type: "invitation.notice", payload: { guestId: "x" }, status: "FAILED", attempts: 6, lastError: "boom", completedAt: new Date() } });
    await jobs.retryFailedJob(admin.id, job.id);
    const j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(j).toMatchObject({ status: "PENDING", attempts: 0, completedAt: null });
    await expect(jobs.retryFailedJob(admin.id, job.id)).rejects.toMatchObject({ code: "job_not_failed" });
  });

  it("resolves errors by id and by filter", async () => {
    const admin = await makeUser("actor5", "ADMIN");
    const source = `test:${run}`;
    const [e1] = await Promise.all([
      db.errorLog.create({ data: { source, message: "one" } }),
      db.errorLog.create({ data: { source, message: "two", level: "warn" } }),
      db.errorLog.create({ data: { source, message: "three" } }),
    ]);
    expect(await errors.resolveErrors(admin.id, { ids: [e1.id], resolved: true })).toBe(1);
    expect(await errors.resolveErrors(admin.id, { match: { source, level: "warn" }, resolved: true })).toBe(1);
    expect(await db.errorLog.count({ where: { source, resolvedAt: null } })).toBe(1);
    expect(await errors.resolveErrors(admin.id, { match: { source }, resolved: true })).toBe(1);
  });
});
