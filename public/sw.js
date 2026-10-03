/* INVTRA service worker — shows a branded "updating" page instead of the host's raw
 * 502 while a new version is being deployed (or when the site can't be reached).
 * It only answers when the server doesn't; it never caches or serves site content. */
const CACHE = "invtra-sw-v1";
const FONTS = ["/fonts/cormorant-garamond-400.woff2", "/fonts/jost-400.woff2", "/fonts/amiri-400.woff2", "/fonts/ibm-plex-sans-arabic-400.woff2"];
const DOWN = [502, 503, 504];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FONTS)).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>INVTRA — back in a moment</title>\n<style>\n@font-face{font-family:"Cormorant Garamond";src:url(/fonts/cormorant-garamond-400.woff2) format("woff2");font-display:swap}\n@font-face{font-family:Jost;src:url(/fonts/jost-400.woff2) format("woff2");font-display:swap}\n@font-face{font-family:Amiri;src:url(/fonts/amiri-400.woff2) format("woff2");font-display:swap}\n@font-face{font-family:"IBM Plex Sans Arabic";src:url(/fonts/ibm-plex-sans-arabic-400.woff2) format("woff2");font-display:swap}\n*{box-sizing:border-box}html,body{margin:0;height:100%}\nbody{display:flex;align-items:center;justify-content:center;padding:24px;background:#faf7f2;background-image:radial-gradient(60% 50% at 50% 0%,#efe4d6,transparent);color:#1e1a16;font-family:Jost,system-ui,sans-serif}\nmain{width:100%;max-width:440px;text-align:center}\n.mark{display:inline-block;animation:breathe 2.4s ease-in-out infinite}\n@keyframes breathe{0%,100%{opacity:.55;transform:scale(.97)}50%{opacity:1;transform:scale(1)}}\n.brand{margin-top:18px;font-size:12px;letter-spacing:.42em;color:#84664a}\nh1{margin:22px 0 0;font:400 36px/1.15 "Cormorant Garamond",Georgia,serif}\np{margin:12px auto 0;max-width:360px;font-size:15.5px;line-height:1.65;color:#57504a}\n.ar{margin-top:28px;padding-top:24px;border-top:1px solid #e6ddd0}\n.ar h2{margin:0;font:700 26px/1.4 Amiri,serif}\n.ar p{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif}\n.bar{position:relative;height:2px;margin:30px auto 0;width:160px;overflow:hidden;border-radius:2px;background:#ece5da}\n.bar:after{content:"";position:absolute;inset:0;width:40%;background:#84664a;animation:slide 1.4s ease-in-out infinite}\n@keyframes slide{from{transform:translateX(-100%)}to{transform:translateX(250%)}}\nsmall{display:block;margin-top:14px;font-size:12px;color:#726a61}\n@media (prefers-reduced-motion:reduce){.mark,.bar:after{animation:none}}\n</style></head><body><main>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 372 387" width="56" height="58" aria-hidden="true"><path fill="#84664A" fill-rule="evenodd" d="M243.0 377.3C234.1 374.9 220.1 367.8 211.3 361.1C206.5 357.5 197.4 348.7 189.7 340.2C170.5 319.1 161.7 311.4 150.5 305.7C126.0 293.4 97.6 301.7 86.6 324.3C85.3 327.2 83.7 330.6 83.1 332.0C81.4 336.2 81.7 325.4 83.5 318.6C88.7 298.7 106.1 279.4 132.0 265.0C153.8 252.9 160.6 248.4 167.7 241.7C175.0 234.7 181.0 225.7 182.5 219.5C183.3 216.0 182.8 216.5 177.6 224.3C175.5 227.4 171.1 232.5 167.8 235.5C161.6 241.3 147.3 250.3 145.8 249.4C145.4 249.1 145.0 224.6 145.0 194.9L145.0 140.9L140.4 144.2C130.9 150.9 111.2 168.0 103.0 176.6C84.8 195.5 68.0 222.0 62.9 239.5C61.6 244.0 60.3 246.7 59.8 246.2C58.5 244.9 58.6 227.5 60.0 221.7C60.5 219.0 62.3 214.3 63.9 211.2C70.3 198.6 78.3 190.2 109.1 163.9C125.4 149.9 137.5 137.8 154.2 119.0C161.7 110.5 170.2 101.2 173.2 98.4C179.1 92.7 187.7 86.0 189.0 86.0C189.6 86.0 189.9 131.6 190.0 193.8C190.0 258.6 190.4 303.8 191.0 307.4C196.0 337.7 216.6 364.3 243.2 374.7C253.6 378.7 253.9 378.9 251.0 378.8C249.6 378.8 246.0 378.2 243.0 377.3ZM36.0 363.4C22.1 359.6 12.3 348.8 10.3 334.8C9.8 331.9 9.6 315.0 9.8 297.2L10.1 265.0L19.6 265.0L29.0 265.0L29.0 298.3C29.0 331.2 29.0 331.7 31.3 336.0C32.9 339.0 35.0 341.1 38.0 342.7C42.2 345.0 42.8 345.0 75.2 345.0L108.0 345.0L108.0 355.0L108.0 365.0L74.8 364.9C48.8 364.9 40.3 364.5 36.0 363.4ZM265.7 364.3C265.3 364.0 265.0 359.5 265.0 354.3L265.0 345.0L298.0 345.0C333.9 345.0 335.1 344.8 340.1 339.4C344.7 334.3 345.0 331.8 345.0 297.4L345.0 265.0L354.5 265.0L364.0 265.0L364.0 300.8C363.9 331.9 363.7 337.1 362.2 341.2C359.7 348.2 354.8 354.5 348.8 358.4C339.6 364.5 335.6 365.0 299.0 365.0C281.0 365.0 266.0 364.7 265.7 364.3ZM264.5 318.7C264.2 318.0 264.1 306.9 264.2 294.0L264.5 270.5L288.5 270.5L312.5 270.5L312.5 295.0L312.5 319.5L288.7 319.8C270.1 320.0 264.8 319.8 264.5 318.7ZM298.5 298.6C298.8 294.6 298.8 289.7 298.5 287.8L297.8 284.3L290.5 284.1C286.5 284.0 282.1 284.2 280.6 284.6C278.0 285.2 278.0 285.2 278.0 295.6L278.0 306.0L287.9 306.0L297.8 306.0L298.5 298.6ZM222.7 282.3C222.3 282.0 222.0 275.0 222.0 266.8L222.0 252.0L237.0 252.0L252.0 252.0L252.0 267.5L252.0 283.0L237.7 283.0C229.8 283.0 223.0 282.7 222.7 282.3ZM264.4 246.6C264.1 245.8 264.0 240.7 264.2 235.3L264.5 225.5L275.8 225.2L287.0 224.9L287.0 236.5L287.0 248.0L276.0 248.0C267.4 248.0 264.8 247.7 264.4 246.6ZM243.2 210.8L243.5 199.5L254.5 199.5L265.5 199.5L265.8 210.8L266.1 222.0L254.5 222.0L242.9 222.0L243.2 210.8ZM288.2 210.8L288.5 199.5L299.5 199.5L310.5 199.5L310.8 210.8L311.1 222.0L299.5 222.0L287.9 222.0L288.2 210.8ZM205.2 188.2L205.5 177.5L216.1 177.2C228.6 176.9 228.0 176.2 228.0 190.2L228.0 199.0L216.5 199.0L204.9 199.0L205.2 188.2ZM243.0 148.6C243.0 125.6 243.3 115.9 244.1 115.4C244.7 115.0 259.9 114.7 277.9 114.7L310.5 114.6L310.8 147.8L311.0 181.0L277.0 181.0L243.0 181.0L243.0 148.6ZM295.8 147.8L296.0 130.0L277.5 130.0L259.0 130.0L259.0 147.3C259.0 156.9 259.3 165.0 259.7 165.4C260.1 165.7 268.3 165.9 277.9 165.8L295.5 165.5L295.8 147.8ZM9.7 131.2C9.5 130.8 9.6 114.3 9.9 94.5C10.5 59.3 10.6 58.4 12.9 54.1C16.3 47.5 24.1 40.5 30.7 37.9C36.4 35.6 37.3 35.6 72.0 35.5L107.5 35.5L107.8 44.7L108.1 54.0L93.8 54.0C57.5 54.0 42.5 54.7 38.8 56.4C29.6 60.8 29.1 63.0 29.0 100.8L29.0 132.0L19.6 132.0C14.4 132.0 9.9 131.7 9.7 131.2ZM345.7 131.3C345.3 131.0 345.0 116.3 345.0 98.8C345.0 73.3 344.7 66.4 343.6 64.2C341.3 59.9 336.5 55.9 332.4 54.9C330.2 54.5 314.4 54.0 297.2 54.0L265.9 54.0L266.2 44.8L266.5 35.5L302.0 35.8C341.1 36.0 342.7 36.2 351.0 42.4C356.0 46.1 360.5 52.0 362.6 57.7C363.6 60.6 363.9 69.7 364.0 96.8L364.0 132.0L355.2 132.0C350.3 132.0 346.0 131.7 345.7 131.3ZM162.4 59.2L145.3 41.9L152.4 35.2C156.3 31.6 164.0 23.9 169.6 18.2L179.6 7.9L196.7 24.9L213.7 42.0L196.6 59.2L179.5 76.5L162.4 59.2Z"/></svg>\n<div class="brand">INVTRA</div>\n<h1 id="t">We\u2019re updating INVTRA</h1>\n<p id="d">A quick improvement is on its way. This page will open by itself in less than 30 seconds \u2014 no need to refresh.</p>\n<div class="ar" dir="rtl" lang="ar"><h2 id="ta">نُجري تحديثًا سريعًا</h2><p id="da">ستُفتح الصفحة تلقائيًا خلال أقل من 30 ثانية، دون الحاجة إلى إعادة التحميل.</p></div>\n<div class="bar" role="progressbar" aria-label="Updating"></div>\n<small id="s" aria-live="polite"></small>\n</main>\n<script>\n(function(){\n  var offline=!navigator.onLine;\n  function show(){\n    if(!navigator.onLine){\n      document.getElementById("t").textContent="You\u2019re offline";\n      document.getElementById("d").textContent="Check your internet connection \u2014 this page will open as soon as you\u2019re back online.";\n      document.getElementById("ta").textContent="لا يوجد اتصال بالإنترنت";\n      document.getElementById("da").textContent="تحقّق من اتصالك، وستُفتح الصفحة فور عودة الاتصال.";\n    }\n  }\n  show();\n  var tries=0;\n  function check(){\n    tries++;\n    fetch("/api/health",{cache:"no-store"}).then(function(r){\n      if(r.ok){location.reload();return}\n      schedule();\n    }).catch(schedule);\n  }\n  function schedule(){show();setTimeout(check,tries<10?3000:6000)}\n  window.addEventListener("online",check);\n  setTimeout(check,2500);\n})();\n</script></body></html>';

function maintenance() {
  return new Response(PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "15" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => (DOWN.includes(res.status) ? maintenance() : res))
        .catch(() => maintenance()),
    );
    return;
  }

  // The maintenance page's own fonts, from cache only when the server can't send them.
  if (FONTS.includes(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => (res.ok ? res : caches.match(url.pathname).then((hit) => hit || res)))
        .catch(() => caches.match(url.pathname).then((hit) => hit || Response.error())),
    );
  }
});
