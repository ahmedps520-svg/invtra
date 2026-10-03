import type { NextRequest } from "next/server";

/**
 * Test for the "we're updating" page: /updating-test always answers 503, like the server
 * does in the middle of a deploy, so the real service-worker path (public/sw.js) runs.
 *
 * Browsers that already have the INVTRA service worker never see this body — the worker
 * swaps in the branded page (in test mode: it doesn't reload, it says it was a test).
 * On a first visit the worker isn't installed yet, so this body installs it and reloads
 * once; from then on the browser behaves exactly like a returning visitor during a deploy.
 */
export function GET(req: NextRequest) {
  const nonce = req.headers.get("x-nonce") ?? "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>INVTRA — update test</title><link rel="icon" href="/icon.png">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#faf7f2;color:#1e1a16;font:15.5px/1.65 system-ui,sans-serif;text-align:center}main{max-width:420px}b{font-weight:600}p{color:#57504a}a{color:#84664a}</style>
</head><body><main>
<p id="m"><b>Preparing the update test…</b><br>Installing INVTRA's update page in this browser — one moment.</p>
</main>
<script nonce="${nonce}">
(function () {
  var m = document.getElementById("m");
  function fail(why) {
    m.innerHTML = "<b>This browser can't show the update page.</b><br>" + why + '<br><a href="/">Back to INVTRA</a>';
  }
  if (!("serviceWorker" in navigator)) return fail("It doesn't support service workers (private browsing can turn them off).");
  var key = "invtra-updating-test";
  var tried = 0;
  try { tried = Number(sessionStorage.getItem(key) || 0); } catch (e) {}
  if (tried >= 3) {
    try { sessionStorage.removeItem(key); } catch (e) {}
    return fail("The service worker didn't take over this page (private browsing or blocked site data can prevent it).");
  }
  function reload() {
    try { sessionStorage.setItem(key, String(tried + 1)); } catch (e) {}
    location.reload();
  }
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(function (reg) {
    if (navigator.serviceWorker.controller) return reg.update().then(reload, reload);
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    return navigator.serviceWorker.ready.then(function () { setTimeout(reload, 1500); });
  }).catch(function () { fail("Installing the service worker failed."); });
})();
</script></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "15", "X-Robots-Tag": "noindex" },
  });
}
