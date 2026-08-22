const API_BASE_URL = 'https://question-app-3rn.pages.dev';

function initTheme() {
      if (localStorage.getItem('theme') === 'dark') {
          document.body.setAttribute('data-theme', 'dark');
          document.getElementById('theme-toggle').innerText = '☀️';
      }
}


// ダークモード切替関数
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle');
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (btn) btn.innerText = '🌙';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (btn) btn.innerText = '☀️';
    }
}

// ==========================================
// Service Worker (PWA) の登録
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('ServiceWorker の登録に成功しました。スコープ: ', registration.scope);
            })
            .catch((error) => {
                console.log('ServiceWorker の登録に失敗しました: ', error);
            });
    });
}

// トースト通知のタイマーを管理する変数
let toastTimeout;

// ② 時間経過でスライドアウトする処理を含む表示関数
function showToast(message) {
    const toast = document.getElementById('toast-container');
    if (!toast) return;

    // メッセージをセット
    toast.innerText = message;

    // 連打された場合、一度アニメーションとタイマーをリセットする
    toast.classList.remove('show');
    clearTimeout(toastTimeout);

    // 少しだけ時間差をつけてからスライドイン開始（ブラウザに変化を認識させるため）
    setTimeout(() => {
        toast.classList.add('show');
        
        // 約3秒 (3000ミリ秒) 後にクラスを外してスライドアウトさせる
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }, 50);
}

// API通信用の共通ヘッダーを取得する関数
function getAuthHeaders() {
    const userId = localStorage.getItem('loginUserId') || sessionStorage.getItem('loginUserId') || '1';
    const role = localStorage.getItem('loginUserRole') || sessionStorage.getItem('loginUserRole') || 'USER';
    return {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        'X-User-Role': role
    };
}