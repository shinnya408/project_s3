const CACHE_NAME = 'project_s3_v0.00'; // ★バージョンを上げました
const urlsToCache = [
  './',
  './exam_filter.html',
  './exam_history.html',
  './exam_options.html',
  './exam_player.html',
  './exam_result.html',
  './exam_review.html',
  './favorite_filter.html',
  './index.html',
  './login.html',
  './player_menu.html',
  './player_stats.html',
  './question_editor.html',
  './quiz.html',
  './reset_password.html',
  './sim_history.html',
  './sim_menu.html',
  './sim_player.html',
  './sim_stats.html',
  './users_management.html',
  // css
  './css/exam_config.css',
  './css/exam_player.css',
  './css/exam_result.css',
  './css/index.css',
  './css/player_menu.css',
  './css/player_stats.css',
  './css/question_editor.css',
  './css/quiz.css',
  './css/sim_player.css',
  './css/sim_stats.css',
  // js
  './auth.js',
  './js/common.js',
  './js/exam_filter.js',
  './js/exam_history.js',
  './js/exam_option.js',
  './js/exam_player.js',
  './js/exam_result.js',
  './js/exam_review.js',
  './js/favorite_filter',
  './js/index.js',
  './js/login.js',
  './js/player_menu.js',
  './js/player_stats.js',
  './js/question_editor.js',
  './js/quiz.js',
  './js/sim_history.js',
  './js/sim_menu.js',
  './js/sim_player.js',
  './js/sim_stats.js',
  './js/simulator_engine.js',
];

// 1. インストール時に静的ファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// 2. アクティベート時に古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('古いキャッシュを削除します:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. ネットワークリクエストの処理
self.addEventListener('fetch', (event) => {
  // ★重要: バックエンドAPIへの通信はキャッシュせず、常にネットワークへ
  if (event.request.url.includes('/api/')) {
    return; // ブラウザのデフォルトの通信に任せる
  }

  // API以外の静的ファイルは、キャッシュを優先しつつ無ければネットワークへ
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});