// sw.js
const CACHE_NAME = 'project_s3_v1.0.19'; // ★バージョンを上げてキャッシュを更新させる
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
  './css/common.css',
  // js
  './auth.js',
  './js/common.js',
  './js/exam_filter.js',
  './js/exam_history.js',
  './js/exam_option.js',
  './js/exam_player.js',
  './js/exam_result.js',
  './js/exam_review.js',
  './js/favorite_filter.js',
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

console.log(`🚀 [Service Worker] Current version: ${CACHE_NAME}`);

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

// 3. ネットワークリクエストの賢い処理（オフライン対応の要）
self.addEventListener('fetch', (event) => {
  // バックエンドAPIへの通信はキャッシュせず、常にネットワークへ
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 🔍 ステップ1: パラメータ(?workbookId=等)を無視して完全一致を探す
      let response = await cache.match(event.request, { ignoreSearch: true });
      if (response) return response;

      // 🔍 ステップ2: 拡張子省略(例: /quiz)の場合、末尾に .html を付けて探す
      const url = new URL(event.request.url);
      // ドメイン名が含まれる場合は pathname だけを抽出して判定する
      let path = url.pathname;
      if (!path.includes('.') && !path.endsWith('/')) {
        // パスが '/' 始まりで、キャッシュキーが './' 始まりの環境差異を吸収
        const lookupPath = '.' + path + '.html';
        response = await cache.match(lookupPath, { ignoreSearch: true });
        
        // それでも無ければ絶対パス相当で再検索
        if (!response) {
            response = await cache.match(path + '.html', { ignoreSearch: true });
        }
        if (response) return response;
      }

      // 🔍 ステップ3: ルートURL (/) の場合は index.html を返す
      if (path === '/' || path === '') {
        response = await cache.match('./index.html', { ignoreSearch: true }) || await cache.match('/index.html', { ignoreSearch: true });
        if (response) return response;
      }

      // 🌐 ステップ4: キャッシュに無ければネットワークへ（オンラインなら成功、オフラインなら失敗）
      try {
        return await fetch(event.request);
      } catch (error) {
        console.warn('オフラインのためネットワークリクエストに失敗しました:', event.request.url);
        throw error;
      }
    })()
  );
});