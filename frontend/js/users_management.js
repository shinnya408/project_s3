document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadWorkbooks();
    loadUsers();
});

const myRole = localStorage.getItem('loginUserRole') || sessionStorage.getItem('loginUserRole') || 'USER';

async function loadWorkbooks() {
    try {
        const res = await fetch(`${API_BASE_URL}/workbooks`, { headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {} });
        const workbooks = await res.json();
        const select = document.getElementById('workbook-select');
        select.innerHTML = '<option value="">-- 問題集を選択 --</option>';
        workbooks.forEach(wb => {
            // ★ 修正: data-format 属性を追加
            select.innerHTML += `<option value="${wb.id}" data-format="${wb.format}">${wb.name}</option>`;
        });
    } catch (e) {
        showToast('問題集の読み込みに失敗しました');
    }
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
            
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 10px;">${user.id}</td>
                    <td style="padding: 10px; font-weight: bold;">${user.username}</td>
                    <td style="padding: 10px; color: var(--text-sub);">${user.email}</td>
                    <td style="padding: 10px;">
                        <select class="form-control" style="width: auto; padding: 4px;" onchange="changeRole(${user.id}, this.value)" ${roleSelectDisabled}>
                            <option value="USER" ${user.role === 'USER' ? 'selected' : ''}>一般 (USER)</option>
                            <option value="MANAGER" ${user.role === 'MANAGER' ? 'selected' : ''}>マネージャー</option>
                            <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>管理者 (ADMIN)</option>
                        </select>
                    </td>
                    <td style="padding: 10px; text-align: center; display: flex; gap: 5px; justify-content: center;">
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
    
    if (!wbId) return alert('上のプルダウンから、進捗を確認したい「問題集」を選択してください。');
    
    // ★ 追加: 選択された問題集のフォーマットを取得
    const selectedOption = select.options[select.selectedIndex];
    const format = selectedOption.getAttribute('data-format');
    
    const queryParams = `?workbookId=${wbId}&targetUserId=${userId}&targetUserName=${encodeURIComponent(username)}`;

    // ★ 修正: フォーマットによって遷移先を分岐
    if (format === 'SIMULATION') {
        window.location.href = `sim_menu.html${queryParams}`;
    } else {
        // 通常の選択式・D&D問題集の場合（直接statsではなく、履歴も選べるmenu画面に飛ばすのが自然です）
        window.location.href = `player_menu.html${queryParams}`;
    }
}