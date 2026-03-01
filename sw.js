// ===== CLEAN HELMET SERVICE WORKER v4.0.2 =====
// Service Worker para PWA com cache offline e notificações

const CACHE_VERSION = 'v4.0.2'; // incrementa sempre que mudar arquivos
const CACHE_NAME = `clean-helmet-${CACHE_VERSION}`;
const CACHE_URLS = [
  '/',
  '/index.html',
  '/styles-touch-sequential-complete.css',
  '/js/offline-manager.js',
  '/js/session-manager.js',
  '/js/mercadopago-manager.js',
  '/clean-helmet-client-final.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log(`🔧 Clean Helmet SW: Instalando versão ${CACHE_VERSION}...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker com limpeza automática
self.addEventListener('activate', (event) => {
  console.log(`🚀 Clean Helmet SW: Ativando versão ${CACHE_VERSION}...`);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Clean Helmet SW: Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições (Cache First Strategy)
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        console.log('📦 Clean Helmet SW: Servindo do cache:', event.request.url);
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
