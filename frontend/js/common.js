const API_BASE_URL = 'https://project-s3.onrender.com/api';
//const API_BASE_URL = 'http://localhost:8080/api';

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

document.addEventListener('DOMContentLoaded', async () => {
    // 既にローディング画面がある場合や、API_BASE_URLが未定義のページでは何もしない
    if (document.getElementById('initial-loader') || typeof API_BASE_URL === 'undefined') return;

    // ローディング画面をJavaScriptで動的に作って画面（body）に追加する
    const loader = document.createElement('div');
    loader.id = 'initial-loader';
    loader.className = 'initial-loader';
    loader.innerHTML = `
        <div class="spinner"></div>
        <h2 style="margin-bottom: 10px;">サーバーを起動しています...</h2>
        <p style="color: #64748b; font-size: 0.9em; text-align: center; line-height: 1.5;">
            無料サーバーを利用しているため、<br>初回起動に最大1分ほどかかる場合があります。
        </p>
    `;
    document.body.appendChild(loader);

    try {
        // バックエンドを起こすための通信
        await fetch(`${API_BASE_URL}/workbooks`, { 
            method: 'GET',
            headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
        });

        // 応答があったら消す
        hideLoader();
    } catch (error) {
        console.error("サーバー起動チェックエラー:", error);
        hideLoader(); // エラー時も一生止まらないように消す
    }

    function hideLoader() {
        loader.classList.add('hidden');
        setTimeout(() => {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 500);
    }
});