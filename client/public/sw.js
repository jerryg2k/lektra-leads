// Lektra Cloud — GTC 2026 Offline Service Worker
// Bump CACHE_NAME version whenever the app is redeployed to clear stale bundles.
const CACHE_NAME = "lektra-gtc-v3";

// Pages and assets to pre-cache for offline use
const PRECACHE_URLS = [
  "/",
  "/scan-card",
  "/nfc",
];

// Routes that must NEVER be served from cache (auth flows, API calls)
const BYPASS_PATTERNS = [
  /^\/callback/,       // Auth0 PKCE callback — must always hit network
  /^\/api\//,          // tRPC API calls
  /auth0\.com/,        // Auth0 domain requests
];

// Install: pre-cache key pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up ALL old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: bypass cache entirely for auth/API routes
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const fullUrl = event.request.url;

  // Never cache auth callback or API routes — always go to network
  const shouldBypass = BYPASS_PATTERNS.some(
    (pattern) => pattern.test(url.pathname) || pattern.test(fullUrl)
  );

  if (shouldBypass) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // For navigation requests (HTML pages), try network then fall back to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // For static assets (JS, CSS, images): cache-first
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
    )
  );
});
