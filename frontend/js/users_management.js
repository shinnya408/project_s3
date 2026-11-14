// users_management.js
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadWorkbooks();
    loadUsers();
});

const myRole = localStorage.getItem('loginUserRole') || sessionStorage.getItem('loginUserRole') || 'USER';
let allUsers = []; // 取得した全ユーザーデータを保持する配列

async function loadWorkbooks() {
    try {
        const res = await fetch(`${API_BASE_URL}/workbooks`, { headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {} });
        const workbooks = await res.json();
        const select = document.getElementById('workbook-select');
        select.innerHTML = '<option value="">-- 問題集を選択 --</option>';
        workbooks.forEach(wb => {
            select.innerHTML += `<option value="${wb.id}" data-format="${wb.format}">${wb.name}</option>`;
        });
    } catch (e) {
        showToast('問題集の読み込みに失敗しました');
    }
}

// ソート・検索ロジックを含んだ描画専用関数
function renderUserList() {
    const tbody = document.getElementById('user-list');
    tbody.innerHTML = '';
    
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">ユーザーがいません</td></tr>';
        return;
    }

    // 検索フィルタリング
    const searchVal = document.getElementById('search-user-input')?.value.toLowerCase().trim() || "";
    let filteredUsers = searchVal 
        ? allUsers.filter(u => u.username.toLowerCase().includes(searchVal) || u.email.toLowerCase().includes(searchVal))
        : [...allUsers];

    // ソート処理
    const sortVal = document.getElementById('sort-user-select')?.value || "id-asc";
    filteredUsers.sort((a, b) => {
        if (sortVal === 'id-asc') return a.id - b.id;
        if (sortVal === 'id-desc') return b.id - a.id;
        if (sortVal === 'name-asc') return a.username.localeCompare(b.username, 'ja');
        if (sortVal === 'name-desc') return b.username.localeCompare(a.username, 'ja');
        return 0;
    });

    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">一致するユーザーが見つかりません</td></tr>';
        return;
    }

    // HTML描画
    filteredUsers.forEach(user => {
        const roleSelectDisabled = myRole === 'ADMIN' ? '' : 'disabled';
        tbody.innerHTML += `
            <tr class="user-row">
                <td data-label="ID">${user.id}</td>
                <td data-label="ユーザー名" style="font-weight: bold;">${user.username}</td>
                <td data-label="メールアドレス" style="color: var(--text-sub);">${user.email}</td>
                <td data-label="権限">
                    <select class="form-control" style="width: auto; padding: 4px;" onchange="changeRole(${user.id}, this.value)" ${roleSelectDisabled}>
                        <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>一般 (USER)</option>
                        <option value="MANAGER" ${user.role === 'MANAGER' ? 'selected' : ''}>マネージャー</option>
                        <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>管理者 (ADMIN)</option>
                    </select>
                </td>
                <td data-label="操作" class="action-cell">
                    <button class="btn btn-primary btn-sm" onclick="viewStats(${user.id}, '${user.username}')">📊 成績を見る</button>
                    ${myRole === 'ADMIN' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">🗑️</button>` : ''}
                </td>
            </tr>
        `;
    });
}

async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('権限エラー');
        const users = await res.json();
        
        const tbody = document.getElementById('user-list');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const roleSelectDisabled = myRole === 'ADMIN' ? '' : 'disabled';
            
            // ★ 修正: インラインスタイルを削り、スマホ表示用の data-label を付与
            tbody.innerHTML += `
                <tr class="user-row">
                    <td data-label="ID">${user.id}</td>
                    <td data-label="ユーザー名" style="font-weight: bold;">${user.username}</td>
                    <td data-label="メールアドレス" style="color: var(--text-sub);">${user.email}</td>
                    <td data-label="権限">
                        <select class="form-control" style="width: auto; padding: 4px;" onchange="changeRole(${user.id}, this.value)" ${roleSelectDisabled}>
                            <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>一般 (USER)</option>
                            <option value="MANAGER" ${user.role === 'MANAGER' ? 'selected' : ''}>マネージャー</option>
                            <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>管理者 (ADMIN)</option>
                        </select>
                    </td>
                    <td data-label="操作" class="action-cell">
                        <button class="btn btn-primary btn-sm" onclick="viewStats(${user.id}, '${user.username}')">📊 成績を見る</button>
                        ${myRole === 'ADMIN' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">🗑️</button>` : ''}
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        showToast('ユーザー一覧の取得に失敗しました（権限がありません）');
    }
}

async function changeRole(userId, newRole) {
    if (!confirm('権限を変更しますか？')) return loadUsers();
    try {
        await fetch(`${API_BASE_URL}/users/${userId}/role`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role: newRole })
        });
        showToast('権限を更新しました');
    } catch (e) {
        showToast('更新失敗');
        loadUsers();
    }
}

async function deleteUser(userId) {
    if (!confirm('本当にこのユーザーを完全削除しますか？\n履歴もすべて消去されます。')) return;
    try {
        await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE', headers: getAuthHeaders() });
        showToast('ユーザーを削除しました');
        loadUsers();
    } catch (e) {
        showToast('削除失敗');
    }
}

function viewStats(userId, username) {
    const select = document.getElementById('workbook-select');
    const wbId = select.value;
    
    if (!wbId) {
        alert('上のプルダウンから、進捗を確認したい「問題集」を選択してください。');
        select.focus(); // フォーカスを当てて気づきやすくする
        return;
    }
    
    const selectedOption = select.options[select.selectedIndex];
    const format = selectedOption.getAttribute('data-format');
    
    const queryParams = `?workbookId=${wbId}&targetUserId=${userId}&targetUserName=${encodeURIComponent(username)}`;

    if (format === 'SIMULATION') {
        window.location.href = `sim_menu${queryParams}`;
    } else {
        window.location.href = `player_menu${queryParams}`;
    }
}