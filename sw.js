// ===== CLEAN HELMET SERVICE WORKER v4.0.0 =====
// Service Worker para PWA com cache offline e notificações

const CACHE_NAME = 'clean-helmet-v4.0.0';
const CACHE_URLS = [
  '/',
  '/index-touch-sequential-complete.html',
  '/styles-touch-sequential-complete.css',
  '/clean-helmet-client-final.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Clean Helmet SW: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Clean Helmet SW: Cache aberto');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Clean Helmet SW: Recursos em cache');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Clean Helmet SW: Erro no cache:', error);
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Clean Helmet SW: Ativando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Clean Helmet SW: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Clean Helmet SW: Ativo e controlando páginas');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições (Cache First Strategy)
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Strategy: Cache First para recursos estáticos
  if (event.request.url.includes('.css') || 
      event.request.url.includes('.js') || 
      event.request.url.includes('.html') ||
      event.request.url.includes('fonts.googleapis.com')) {
    
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            console.log('📦 Clean Helmet SW: Servindo do cache:', event.request.url);
            return response;
          }
          
          console.log('🌐 Clean Helmet SW: Buscando da rede:', event.request.url);
          return fetch(event.request)
            .then((response) => {
              // Clona a resposta antes de colocar no cache
              const responseClone = response.clone();
              
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
              
              return response;
            });
        })
        .catch(() => {
          console.log('❌ Clean Helmet SW: Offline - recurso não disponível');
          
          // Retorna página offline se disponível
          if (event.request.mode === 'navigate') {
            return caches.match('/index-touch-sequential-complete.html');
          }
        })
    );
  }
  
  // Strategy: Network First para Firebase e APIs
  else if (event.request.url.includes('firebaseio.com') || 
           event.request.url.includes('googleapis.com') ||
           event.request.url.includes('/api/')) {
    
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          console.log('🔥 Clean Helmet SW: Firebase/API response:', event.request.url);
          return response;
        })
        .catch(() => {
          console.log('📱 Clean Helmet SW: Firebase offline - modo demo ativo');
          
          // Retorna resposta mock para demonstração offline
          if (event.request.url.includes('firebaseio.com')) {
            return new Response(JSON.stringify({
              demo: true,
              message: 'Sistema funcionando em modo offline',
              timestamp: Date.now()
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        })
    );
  }
});

// Notificações Push
self.addEventListener('push', (event) => {
  console.log('📬 Clean Helmet SW: Push recebido');
  
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do Clean Helmet',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" fill="%231e3a8a" rx="10"/%3E%3Cpath d="M48 20C34 20 25 29 25 42v20c0 10 5 18 12 23h46c7-5 12-13 12-23V42c0-13-9-22-23-22z" fill="%23ffffff"/%3E%3Ccircle cx="38" cy="47" r="3" fill="%231e3a8a"/%3E%3Ccircle cx="58" cy="47" r="3" fill="%231e3a8a"/%3E%3Cpath d="M38 58c5 5 10 5 15 0 5 5 10 5 15 0" stroke="%231e3a8a" stroke-width="2" fill="none"/%3E%3Crect x="43" y="70" width="10" height="15" rx="2" fill="%23ffffff"/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Ccircle cx="48" cy="48" r="40" fill="%231e3a8a"/%3E%3Ctext x="48" y="58" text-anchor="middle" fill="%23ffffff" font-size="24" font-weight="bold"%3E🏍️%3C/text%3E%3C/svg%3E',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23ffffff" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/%3E%3C/svg%3E'
      },
      {
        action: 'dismiss',
        title: 'Dispensar',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%23ffffff" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/%3E%3C/svg%3E'
      }
    ],
    requireInteraction: true,
    tag: 'clean-helmet-notification'
  };

  event.waitUntil(
    self.registration.showNotification('Clean Helmet ESP32', options)
  );
});

// Clique em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Clean Helmet SW: Notificação clicada:', event.action);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Se já há uma janela aberta, foca nela
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Caso contrário, abre nova janela
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
// Background Sync (para quando voltar online)
self.addEventListener('sync', (event) => {
  console.log('🔄 Clean Helmet SW: Background sync:', event.tag);
  
  if (event.tag === 'clean-helmet-sync') {
    event.waitUntil(
      // Aqui você pode sincronizar dados quando voltar online
      syncOfflineData()
    );
  }
});

// Função para sincronizar dados offline
async function syncOfflineData() {
  try {
    console.log('📡 Clean Helmet SW: Sincronizando dados offline...');
    
    // Aqui você implementaria a lógica para:
    // 1. Enviar dados de ciclos armazenados offline
    // 2. Sincronizar pagamentos pendentes
    // 3. Atualizar configurações
    
    const offlineData = await getOfflineData();
    if (offlineData.length > 0) {
      // Envia dados para Firebase quando voltar online
      await sendToFirebase(offlineData);
      await clearOfflineData();
    }
    
    console.log('✅ Clean Helmet SW: Sincronização concluída');
    
  } catch (error) {
    console.error('❌ Clean Helmet SW: Erro na sincronização:', error);
  }
}

// Funções auxiliares para dados offline
async function getOfflineData() {
  // Implementar lógica para recuperar dados do IndexedDB
  return [];
}

async function sendToFirebase(data) {
  // Implementar envio para Firebase
  console.log('📤 Enviando para Firebase:', data);
}

async function clearOfflineData() {
  // Limpar dados offline após sincronização
  console.log('🗑️ Limpando dados offline sincronizados');
}

// Tratamento de erros
self.addEventListener('error', (event) => {
  console.error('❌ Clean Helmet SW: Erro:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Clean Helmet SW: Promise rejeitada:', event.reason);
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  console.log('💬 Clean Helmet SW: Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.ports[0].postMessage({ urls: CACHE_URLS });
  }
});

// Log de inicialização
console.log('🚀 Clean Helmet Service Worker v4.0.0 carregado');
console.log('📦 Cache:', CACHE_NAME);
console.log('🔗 URLs em cache:', CACHE_URLS.length);