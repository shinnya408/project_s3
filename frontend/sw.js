const CACHE_NAME = 'project_s3_v1.0.21';

// ★ Cloudflareの仕様に合わせ、.html を付けずにキャッシュさせる
const urlsToCache = [
  '/',
  '/exam_filter',
  '/exam_history',
  '/exam_options',
  '/exam_player',
  '/exam_result',
  '/exam_review',
  '/favorite_filter',
  '/index',
  '/login',
  '/player_menu',
  '/player_stats',
  '/question_editor',
  '/quiz',
  '/reset_password',
  '/sim_history',
  '/sim_menu',
  '/sim_player',
  '/sim_stats',
  '/users_management',
  '/css/exam_config.css',
  '/css/exam_player.css',
  '/css/exam_result.css',
  '/css/index.css',
  '/css/player_menu.css',
  '/css/player_stats.css',
  '/css/question_editor.css',
  '/css/quiz.css',
  '/css/sim_player.css',
  '/css/sim_stats.css',
  '/css/common.css',
  '/auth.js',
  '/js/common.js',
  '/js/exam_filter.js',
  '/js/exam_history.js',
  '/js/exam_option.js',
  '/js/exam_player.js',
  '/js/exam_result.js',
  '/js/exam_review.js',
  '/js/favorite_filter.js',
  '/js/index.js',
  '/js/login.js',
  '/js/player_menu.js',
  '/js/player_stats.js',
  '/js/question_editor.js',
  '/js/quiz.js',
  '/js/sim_history.js',
  '/js/sim_menu.js',
  '/js/sim_player.js',
  '/js/sim_stats.js',
  '/js/simulator_engine.js',
];

console.log(`🚀 [Service Worker] Current version: ${CACHE_NAME}`);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch(err => console.error('Cache addAll error:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      let response = await cache.match(event.request, { ignoreSearch: true });
      if (response) return response;

      const url = new URL(event.request.url);
      let path = url.pathname;
      if (path === '/' || path === '') {
        response = await cache.match('/', { ignoreSearch: true });
        if (response) return response;
      } else {
        response = await cache.match(path, { ignoreSearch: true });
        if (response) return response;
      }

      try {
        const networkResponse = await fetch(event.request);
        
        // ★ エラーの根本原因を解消:
        // Cloudflareがリダイレクトを返してきた際、それをそのまま返さずに
        // ブラウザに正しくリダイレクト処理を行わせる
        if (event.request.mode === 'navigate' && networkResponse.redirected) {
          return Response.redirect(networkResponse.url, 302);
        }
        
        return networkResponse;
      } catch (error) {
        console.warn('Network request failed:', event.request.url);
        throw error;
      }
    })()
  );
});