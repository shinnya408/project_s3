const CACHE_NAME = 'project_s3_v1.0.25';

// ★ Cloudflareの仕様(308リダイレクト)を回避するため、キャッシュ対象はすべて「拡張子なし」にする
const urlsToCache = [
  '/',
  '/index',
  '/login',
  '/reset_password',
  '/player_menu',
  '/quiz',
  '/exam_filter',
  '/exam_options',
  '/exam_player',
  '/exam_review',
  '/exam_result',
  '/exam_history',
  '/favorite_filter',
  '/player_stats',
  '/sim_menu',
  '/sim_player',
  '/sim_stats',
  '/sim_history',
  '/question_editor',
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
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(event.request.url);
    const path = url.pathname;

    // 1. まずはパスそのままでキャッシュを検索（?workbookId=1 等のパラメータは無視）
    let response = await cache.match(path, { ignoreSearch: true });
    if (response) return response;

    // 2. もし .html 付きでリクエストされたら、外して検索
    if (path.endsWith('.html')) {
      response = await cache.match(path.replace(/\.html$/, ''), { ignoreSearch: true });
      if (response) return response;
    }

    // 3. ルートパスのフォールバック
    if (path === '/') {
      response = await cache.match('/index', { ignoreSearch: true });
      if (response) return response;
    }

    // 4. キャッシュに無ければネットワークへ
    try {
      // ★ 最重要: ブラウザの厳格なリダイレクト制限（redirect mode is not "follow"）を回避するため、
      // 新しいリクエストオブジェクトを生成し、Cloudflareのリダイレクトに自動追従させる
      const fetchOptions = {
        method: event.request.method,
        headers: event.request.headers,
        credentials: event.request.credentials,
        redirect: 'follow' 
      };
      return await fetch(event.request.url, fetchOptions);
    } catch (error) {
      console.warn('Network request failed, offline mode:', event.request.url);
      // 完全オフライン時の画面遷移エラー救済
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('/index', { ignoreSearch: true }) || await cache.match('/', { ignoreSearch: true });
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});