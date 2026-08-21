// js/login.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initTheme === 'function') initTheme();

    // すでにログイン済みの場合はトップへスキップ
    const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
    const loginUserId = localStorage.getItem('loginUserId') || sessionStorage.getItem('loginUserId');
    if (userJson || loginUserId) {
        window.location.href = 'index.html';
        return;
    }

    // ★ 追加：入力フィールドで Enter キーが押された際に明示的にフォーム送信を発火させるリスナー
    setupEnterKeySubmit();
});

function setupEnterKeySubmit() {
    const loginPasswordInput = document.getElementById('login-password');
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('login-form').requestSubmit();
            }
        });
    }

    const regPasswordInput = document.getElementById('reg-password');
    if (regPasswordInput) {
        regPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('register-form').requestSubmit();
            }
        });
    }
}

// タブ切り替え（ログイン / 新規登録）
function switchAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');

    if (mode === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabReg.classList.add('active');
    }
}

// ① ログイン処理
async function handleLogin(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const keepLoggedInEl = document.getElementById('keep-logged-in');
    const keepLoggedIn = keepLoggedInEl ? keepLoggedInEl.checked : true;
    const submitBtn = document.getElementById('btn-login-submit');

    if (!email || !password) return;

    submitBtn.disabled = true;
    submitBtn.innerText = 'ログイン中...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });

        const data = await response.json();

        if (data.success) {
            // 古いキャッシュのクリア
            localStorage.removeItem('user');
            localStorage.removeItem('loginUserId');
            localStorage.removeItem('loginUserName');
            localStorage.removeItem('loginUserRole');
            localStorage.removeItem('loginExpiresAt');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('loginUserId');
            sessionStorage.removeItem('loginUserName');
            sessionStorage.removeItem('loginUserRole');

            const userObj = {
                id: data.userId,
                username: data.username,
                role: data.role || 'USER'
            };

            const targetStorage = keepLoggedIn ? localStorage : sessionStorage;

            // user オブジェクトと個別キーの両方を保存（互換性確保）
            targetStorage.setItem('user', JSON.stringify(userObj));
            targetStorage.setItem('loginUserId', data.userId);
            targetStorage.setItem('loginUserName', data.username);
            targetStorage.setItem('loginUserRole', data.role || 'USER');

            if (keepLoggedIn) {
                const expires = new Date();
                expires.setMonth(expires.getMonth() + 3);
                localStorage.setItem('loginExpiresAt', expires.getTime());
            }

            if (typeof showToast === 'function') showToast('ログインに成功しました！');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 300);

        } else {
            alert(data.message || 'メールアドレスまたはパスワードが間違っています。');
            submitBtn.disabled = false;
            submitBtn.innerText = 'ログイン ＞';
        }

    } catch (error) {
        console.error('ログインエラー:', error);
        alert('サーバーとの通信に失敗しました。バックエンドが起動しているか確認してください。');
        submitBtn.disabled = false;
        submitBtn.innerText = 'ログイン ＞';
    }
}

// ② 新規登録処理
async function handleRegister(event) {
    if (event) event.preventDefault();

    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const submitBtn = document.getElementById('btn-reg-submit');

    if (!username || !email || !password) return;

    submitBtn.disabled = true;
    submitBtn.innerText = '登録中...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, email: email, password: password })
        });

        const data = await response.json();

        if (data.success) {
            const userObj = {
                id: data.userId,
                username: data.username,
                role: data.role || 'USER'
            };

            sessionStorage.setItem('user', JSON.stringify(userObj));
            sessionStorage.setItem('loginUserId', data.userId);
            sessionStorage.setItem('loginUserName', data.username);
            sessionStorage.setItem('loginUserRole', data.role || 'USER');

            alert('登録が完了しました！トップページへ移動します。');
            window.location.href = 'index.html';

        } else {
            alert(data.message || '登録に失敗しました。別のメールアドレスをお試しくいただくか、内容を確認してください。');
            submitBtn.disabled = false;
            submitBtn.innerText = '登録して開始 ＞';
        }

    } catch (error) {
        console.error('登録エラー:', error);
        alert('サーバーとの通信に失敗しました。バックエンドが起動しているか確認してください。');
        submitBtn.disabled = false;
        submitBtn.innerText = '登録して開始 ＞';
    }
}