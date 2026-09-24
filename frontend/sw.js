const CACHE_NAME = 'project_s3_v1.0.23';

// ★修正: 相対パス(./)ではなく絶対パス(/)を指定し、キャッシュの迷子を完全に防ぐ
const urlsToCache = [
  '/',
  '/exam_filter.html',
  '/exam_history.html',
  '/exam_options.html',
  '/exam_player.html',
  '/exam_result.html',
  '/exam_review.html',
  '/favorite_filter.html',
  '/index.html',
  '/login.html',
  '/player_menu.html',
  '/player_stats.html',
  '/question_editor.html',
  '/quiz.html',
  '/reset_password.html',
  '/sim_history.html',
  '/sim_menu.html',
  '/sim_player.html',
  '/sim_stats.html',
  '/users_management.html',
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
  '/js/simulator_engine.js'
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
  // GETリクエスト以外、またはAPI通信はキャッシュを通さない
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const url = new URL(event.request.url);
      let path = url.pathname;
      
      // 1. ルートアクセスは確実に index.html を返す
      if (path === '/' || path === '') {
        let response = await cache.match('/index.html', { ignoreSearch: true });
        if (response) return response;
      }

      // 2. そのまま（パラメータ無視）でキャッシュ検索
      let response = await cache.match(event.request, { ignoreSearch: true });
      if (response) return response;

      // 3. クリーンURL（拡張子なし）の場合、末尾に .html を付けて探す
      if (!path.includes('.')) {
        response = await cache.match(path + '.html', { ignoreSearch: true });
        if (response) return response;
      }

      // 4. .html 付きでリクエストされた場合はそのまま探す
      if (path.endsWith('.html')) {
         response = await cache.match(path, { ignoreSearch: true });
         if (response) return response;
      }

      // 5. キャッシュになければネットワークへ
      try {
        const networkResponse = await fetch(event.request);
        
        // リダイレクト時にパラメータが消えるのを防ぐ
        if (event.request.mode === 'navigate' && networkResponse.redirected) {
          const redirectUrl = new URL(networkResponse.url);
          if (!redirectUrl.search && url.search) {
             redirectUrl.search = url.search;
          }
          return Response.redirect(redirectUrl.toString(), 302);
        }
        
        return networkResponse;
      } catch (error) {
        console.warn('Network request failed, attempting offline fallback:', event.request.url);
        
        // ★追加: 完全にオフラインで、かつ画面遷移のリクエストだった場合の究極のフォールバック
        if (event.request.mode === 'navigate') {
            let fallback = await cache.match('/index.html', { ignoreSearch: true });
            if (fallback) return fallback;
        }
        throw error;
      }
    })()
  );
});