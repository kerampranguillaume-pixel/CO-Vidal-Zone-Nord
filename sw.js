/* Service worker : fait fonctionner l'application sans réseau.
   - Fichiers de l'application : réseau d'abord (pour recevoir les mises à jour), sinon copie locale.
   - Bibliothèques Firebase et polices : copie locale d'abord.
   - Données Firestore et connexion : jamais interceptées (Firebase gère lui-même le hors ligne). */
const VERSION = "co-vidal-v3";
const CORE = ["./", "./index.html", "./map.jpg", "./manifest.webmanifest", "./firebase-config.js",
              "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const NEVER = /firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|googleapis\.com\/identitytoolkit|firebaseinstallations/;
const CDN = /gstatic\.com|fonts\.googleapis\.com/;

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)) }

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || NEVER.test(req.url)) return;
  const url = new URL(req.url);
  if (CDN.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    Promise.race([fetch(req, {cache: "no-cache"}), timeout(4000)]).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
