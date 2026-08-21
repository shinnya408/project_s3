// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initTheme === 'function') initTheme();
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn && typeof toggleTheme === 'function') {
        themeBtn.addEventListener('click', toggleTheme);
    }
});

// ログイン処理
async function login() {
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const keepEl = document.getElementById('keep-logged-in');

    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const password = passEl.value.trim();
    const keepLoggedIn = keepEl ? keepEl.checked : true;

    if (!email || !password) {
        if (typeof showToast === 'function') showToast('メールアドレスとパスワードを入力してください。');
        else alert('メールアドレスとパスワードを入力してください。');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 保存前にクリア
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

            targetStorage.setItem('user', JSON.stringify(userObj));
            targetStorage.setItem('loginUserId', data.userId);
            targetStorage.setItem('loginUserName', data.username);
            targetStorage.setItem('loginUserRole', data.role || 'USER');

            if (keepLoggedIn) {
                const expires = new Date();
                expires.setMonth(expires.getMonth() + 3);
                localStorage.setItem('loginExpiresAt', expires.getTime());
            }

            window.location.href = 'index.html'; 
        } else {
            if (typeof showToast === 'function') showToast(data.message);
            else alert(data.message);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('サーバーとの通信に失敗しました。');
        else alert('サーバーとの通信に失敗しました。');
    }
}

// 新規登録処理
async function register() {
    const userEl = document.getElementById('username');
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');

    if (!userEl || !emailEl || !passEl) return;

    const username = userEl.value.trim();
    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if (!username || !email || !password) {
        if (typeof showToast === 'function') showToast('全ての項目を入力してください。');
        else alert('全ての項目を入力してください。');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
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
            if (typeof showToast === 'function') showToast(data.message);
            else alert(data.message);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('サーバーとの通信に失敗しました。');
        else alert('サーバーとの通信に失敗しました。');
    }
}

// パスワードリセット処理
async function resetPassword() {
    const emailEl = document.getElementById('email');
    const userEl = document.getElementById('username');
    const newPassEl = document.getElementById('new-password');

    if (!emailEl || !userEl || !newPassEl) return;

    const email = emailEl.value.trim();
    const username = userEl.value.trim();
    const newPassword = newPassEl.value.trim();

    if (!email || !username || !newPassword) {
        if (typeof showToast === 'function') showToast('全ての項目を入力してください。');
        else alert('全ての項目を入力してください。');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('パスワードの再設定処理を受け付けました。\n入力情報が正しければパスワードが更新されています。');
            window.location.href = 'login.html';
        } else {
            if (typeof showToast === 'function') showToast('エラーが発生しました。');
            else alert('エラーが発生しました。');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('サーバーとの通信に失敗しました。');
        else alert('サーバーとの通信に失敗しました。');
    }
}