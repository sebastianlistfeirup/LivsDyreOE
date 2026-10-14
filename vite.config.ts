import { defineConfig } from "vite";

export default defineConfig({
  base: "/LivsDyreOE/",
  define: { __BUILD_VERSION__: JSON.stringify("akvarie-0.1.0") },
  plugins: [
    {
      name: "aquarium-offline-cache",
      generateBundle(_options, bundle) {
        const version = `livs-akvarie-${Date.now()}`;
        const art = [
          "underwater-world",
          "underwater-aquarium",
          ...["bobo", "sky", "glimt", "plet"].map((id) => `fish-${id}`),
          ...[
            "seagrass",
            "cave",
            "ring",
            "arch",
            "clam",
            "bubbles",
            "wreck",
            "lantern",
          ].map((id) => `decor-${id}`),
        ];
        const urls = [
          "./",
          "./manifest.webmanifest",
          "./aquarium/icon.svg",
          "./aquarium/icon-192.png",
          "./aquarium/icon-512.png",
          ...Object.keys(bundle)
            .filter((file) => /\.(js|css|woff2)$/.test(file))
            .map((file) => `./${file}`),
          ...art.map((id) => `./aquarium/art/${id}.webp`),
        ];
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `
const CACHE = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('livs-akvarie-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('./', self.location).href, { ignoreVary: true })));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  })));
});`,
        });
      },
    },
  ],
  test: { environment: "node" },
});
