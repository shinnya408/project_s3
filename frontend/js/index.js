// index.js

// --- 0. ログインチェックとルーティングガード ---
let loginUserId = sessionStorage.getItem('loginUserId');
let loginUserName = sessionStorage.getItem('loginUserName');

// sessionStorage に無い場合は localStorage をチェック
if (!loginUserId) {
    const localId = localStorage.getItem('loginUserId');
    const expiresAt = localStorage.getItem('loginExpiresAt');
    
    if (localId && expiresAt) {
        const now = new Date().getTime();
        // 現在時刻が有効期限（3ヶ月後）を過ぎていたらクリアする
        if (now > parseInt(expiresAt)) {
            localStorage.removeItem('loginUserId');
            localStorage.removeItem('loginUserName');
            localStorage.removeItem('loginExpiresAt');
            alert('ログインの有効期限が切れました。再度ログインしてください。');
            window.location.href = 'login.html';
        } else {
            // 有効期限内ならログイン情報として採用
            loginUserId = localId;
            loginUserName = localStorage.getItem('loginUserName');
        }
    }
}

if (!loginUserId) {
    window.location.href = 'login.html';
} else {
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl) {
        greetingEl.textContent = `${loginUserName} さん`;
    }
}

function logout() {
    if (confirm('ログアウトしますか？')) {
        localStorage.removeItem('loginUserId');
        localStorage.removeItem('loginUserName');
        localStorage.removeItem('loginExpiresAt');
        sessionStorage.removeItem('loginUserId');
        sessionStorage.removeItem('loginUserName');
        window.location.href = 'login.html';
    }
}
const loginUserRole = localStorage.getItem('loginUserRole') || sessionStorage.getItem('loginUserRole') || 'USER';

// ADMIN のみ問題管理（エディタ）にアクセス可能
if (loginUserRole === 'ADMIN') {
    const adminBtn = document.getElementById('admin-settings-btn');
    if (adminBtn) adminBtn.style.display = 'block';
}

// ADMIN と MANAGER はユーザー管理画面にアクセス可能
if (loginUserRole === 'ADMIN' || loginUserRole === 'MANAGER') {
    const userBtn = document.getElementById('user-management-btn');
    if (userBtn) userBtn.style.display = 'block';
}

// --- 1. テーマの初期化と切替 ---
initTheme();
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}

// --- 2. APIからデータを取得する仕組み ---
async function fetchWorkbooks() {
    const listElement = document.getElementById('workbook-list');
    try {
        const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        const response = await fetch(`${API_BASE_URL}/workbooks`, { headers: headers });
        
        if (!response.ok) throw new Error('ネットワークエラー');
        const workbooks = await response.json();

        listElement.innerHTML = '';

        if (workbooks.length === 0) {
            listElement.innerHTML = '<li class="loading">問題集がありません。</li>';
            return;
        }

        // ★ 追加: 管理者の場合、変更履歴フォームの「対象」に問題集名を追加する
        const clTargetSelect = document.getElementById('cl-target');
        if (clTargetSelect) {
            // 固定項目以外をクリア（二重追加防止）
            const fixedOptions = ["システム全体", "選択問題", "D&D", "選択問題/D&D", "シミュレーション", "その他"];
            Array.from(clTargetSelect.options).forEach(opt => {
                if (!fixedOptions.includes(opt.value)) opt.remove();
            });
            // 問題集をプルダウンに追加
            workbooks.forEach(wb => {
                const opt = document.createElement('option');
                opt.value = wb.name;
                opt.textContent = wb.name;
                clTargetSelect.appendChild(opt);
            });
        }

        workbooks.forEach(wb => {
            const li = document.createElement('li');
            li.className = 'workbook-item';

            const infoDiv = document.createElement('div');
            const titleSpan = document.createElement('div');
            titleSpan.className = 'workbook-title';
            titleSpan.textContent = wb.name;
            
            const formatSpan = document.createElement('div');
            formatSpan.className = 'workbook-format';
            
            if (wb.format === 'MULTIPLE_CHOICE') {
                formatSpan.textContent = '選択問題';
            } else if (wb.format === 'DRAG_AND_DROP') {
                formatSpan.textContent = 'D&D問題';
            } else if (wb.format === 'SIMULATION') {
                formatSpan.textContent = 'シミュレーション問題';
            } else {
                formatSpan.textContent = wb.format;
            }

            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(formatSpan);

            const startBtn = document.createElement('button');
            startBtn.className = 'start-btn';
            startBtn.textContent = '始める';
            startBtn.onclick = () => {
                if (wb.format === 'SIMULATION') {
                    window.location.href = `sim_menu.html?workbookId=${wb.id}`;
                } else {
                    window.location.href = `player_menu.html?workbookId=${wb.id}`;
                }
            };

            li.appendChild(infoDiv);
            li.appendChild(startBtn);
            listElement.appendChild(li);
        });
    } catch (error) {
        console.error('エラー:', error);
        listElement.innerHTML = '<li class="loading" style="color: var(--danger);">データの取得に失敗しました。<br>バックエンドが起動しているか確認してください。</li>';
    }
}

if (loginUserId) {
    fetchWorkbooks();
}

// ==========================================
// 変更履歴 (Changelog) 機能
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 管理者ならフォームを表示
    if (loginUserRole === 'ADMIN') {
        const form = document.getElementById('admin-changelog-form');
        if (form) form.style.display = 'block';
    }
    fetchChangelogs();
});

async function fetchChangelogs() {
    const listEl = document.getElementById('changelog-list');
    if (!listEl) return;
    try {
        const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        const res = await fetch(`${API_BASE_URL}/changelogs`, { headers: headers });
        if (!res.ok) throw new Error('取得失敗');
        const logs = await res.json();
        
        if (logs.length === 0) {
            listEl.innerHTML = '<span style="color: var(--format-text);">変更履歴はありません。</span>';
            return;
        }

        listEl.innerHTML = logs.map(log => {
            const date = new Date(log.createAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            // ★ 追加: 新しい種別に応じた色分け設定
            let typeColor = '#64748b'; // デフォルト色
            if (log.type === '不具合') typeColor = '#ef4444';      // 赤
            else if (log.type === '問題変更') typeColor = '#10b981';// 緑
            else if (log.type === '更新') typeColor = '#3b82f6';    // 青
            else if (log.type === 'その他') typeColor = '#f59e0b';  // オレンジ

            return `
                <div style="padding-bottom: 8px; border-bottom: 1px dashed var(--border-color);">
                    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                        <span style="color: var(--format-text); font-size: 0.85em;">${date}</span>
                        <span style="background: var(--format-bg); color: var(--format-text); padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8em;">${log.target}</span>
                        <span style="background: ${typeColor}20; color: ${typeColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8em;">${log.type}</span>
                    </div>
                    <div style="color: var(--text-color); white-space: pre-wrap;">${log.content}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        listEl.innerHTML = '<span style="color: #ef4444;">履歴の取得に失敗しました。</span>';
    }
}

async function postChangelog() {
    const target = document.getElementById('cl-target').value;
    const type = document.getElementById('cl-type').value;
    const content = document.getElementById('cl-content').value.trim();

    if (!content) return alert('変更内容を入力してください。');

    try {
        const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        headers['Content-Type'] = 'application/json';

        const res = await fetch(`${API_BASE_URL}/changelogs`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ target, type, content })
        });
        if (!res.ok) throw new Error('投稿失敗');
        document.getElementById('cl-content').value = '';
        fetchChangelogs();
    } catch (e) {
        alert('投稿に失敗しました。');
    }
}