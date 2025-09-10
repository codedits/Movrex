const CACHE_NAME = 'movrex-v1';
const STATIC_CACHE = 'movrex-static-v1';
const API_CACHE = 'movrex-api-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/offline',
  '/manifest.json',
  '/movrex.svg',
  '/favicon.ico',
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/trending/cached',
  '/api/discover',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// Handle API requests with caching
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const clonedResponse = response.clone();
      cache.put(request, clonedResponse);
    }
    
    return response;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API requests
    return new Response(
      JSON.stringify({ error: 'Offline - No cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  // Check cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Try network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const clonedResponse = response.clone();
      cache.put(request, clonedResponse);
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/offline');
    }
    
    // Return error for other requests
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Sync any pending data when connection is restored
  const cache = await caches.open(API_CACHE);
  const requests = await cache.keys();
  
  for (const request of requests) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response);
      }
    } catch (error) {
      console.log('Background sync failed for:', request.url);
    }
  }
}

// Push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New movie updates available!',
    icon: '/movrex.svg',
    badge: '/movrex.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore Movies',
        icon: '/movrex.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/movrex.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Movrex', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});


