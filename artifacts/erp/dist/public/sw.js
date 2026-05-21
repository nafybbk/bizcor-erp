const CACHE_NAME = "bizerp-v6";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.svg",
];

// Install: cache shell assets immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch(() => {})
    )
  );
});

// Activate: remove old caches, take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls — let browser handle natively, no SW interception
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (HTML pages) — network first, cache on success, fallback to cached "/"
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Try the exact URL first, then fall back to "/"
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match("/")) ||
            (await caches.match(new Request("/")));
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizERP – Offline</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f1f5f9;color:#334155}.box{text-align:center;padding:2rem;background:white;border-radius:1rem;box-shadow:0 4px 24px #0001;max-width:320px}.icon{font-size:3rem;margin-bottom:1rem}h2{margin:0 0 .5rem;font-size:1.2rem}p{margin:0;font-size:.9rem;color:#64748b}</style></head><body><div class="box"><div class="icon">📶</div><h2>Internet nahi hai</h2><p>App abhi offline hai. Internet aane ke baad page refresh karein.</p></div></body></html>`,
            { status: 200, headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images) — cache first, then network, cache on success
  if (
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    event.request.destination === "font" ||
    event.request.destination === "image"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — network first, cache as fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
