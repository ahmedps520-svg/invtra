#!/usr/bin/env node
/**
 * Visual QA helper.
 *   node scripts/screenshot.mjs <path> <out.png> [--mobile] [--ar] [--login email:password] [--full] [--wait ms] [--base http://localhost:3000]
 * Example:
 *   node scripts/screenshot.mjs / /tmp/home.png --full
 *   node scripts/screenshot.mjs /dashboard /tmp/dash-ar.png --ar --login demo@invtra.store:demo-password-2026
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const [path, out] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--login", "--wait", "--base"].includes(args[i - 1])));
if (!path || !out) {
  console.error("usage: node scripts/screenshot.mjs <path> <out.png> [--mobile] [--ar] [--login email:password] [--full] [--wait ms]");
  process.exit(1);
}
const base = opt("--base", "http://localhost:3000");
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) => existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const context = await browser.newContext({
  viewport: flag("--mobile") ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: flag("--mobile") ? 2 : 1,
  isMobile: flag("--mobile"),
  hasTouch: flag("--mobile"),
  userAgent: flag("--mobile") ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : undefined,
});
await context.addCookies([{ name: "invtra_locale", value: flag("--ar") ? "ar" : "en", url: base }]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
const login = opt("--login");
if (login) {
  // Reuse a cached session cookie per account so repeated runs don't hit the login rate limit.
  const { readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const [email, password] = login.split(":");
  const cacheDir = `${tmpdir()}/invtra-screenshot`;
  const cacheFile = `${cacheDir}/${email.replace(/[^a-z0-9]/gi, "_")}.json`;
  let cookies = null;
  try {
    cookies = JSON.parse(readFileSync(cacheFile, "utf8"));
  } catch {}
  if (cookies) await context.addCookies(cookies);
  const me = cookies ? await page.request.get(`${base}/api/events`) : null;
  if (!me || me.status() === 401) {
    const r = await page.request.post(`${base}/api/auth/login`, { data: { email, password }, headers: { Origin: base } });
    if (!r.ok()) console.error("login failed", r.status(), await r.text());
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify((await context.cookies()).filter((c) => c.name === "invtra_session")));
  }
}
const res = await page.goto(base + path, { waitUntil: "networkidle" });
if (flag("--full") || flag("--scroll")) {
  // Trigger scroll-based reveals before a full-page capture.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += Math.round(window.innerHeight * 0.4)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
  });
}
await page.waitForTimeout(Number(opt("--wait", "800")));
await page.screenshot({ path: out, fullPage: flag("--full") });
console.log(`${res?.status()} ${page.url()} -> ${out}`);
if (errors.length) console.log(errors.slice(0, 10).join("\n"));
await browser.close();
