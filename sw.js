// Service Worker — QP Clinic ECE
// Estrategia: network-first para el HTML (siempre la versión más reciente
// desplegada en Vercel), cache como respaldo si no hay conexión.
const CACHE = "qpclinic-ece-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Nunca interceptar llamadas a Supabase ni a la API de IA:
  // los datos clínicos siempre van directo a la red
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) return;

  // Solo manejar GET
  if (e.request.method !== "GET") return;

  // Network-first: intenta red, guarda copia, cae al cache sin conexión
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/index.html")))
  );
});
