// Service worker mínimo: habilita la instalación como app (PWA) en Android.
// No cachea nada: deja que el navegador resuelva cada petición por red,
// así nunca se sirve contenido viejo.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {
  // Sin respondWith: paso directo a la red.
})
