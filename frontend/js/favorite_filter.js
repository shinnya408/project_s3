// =====================================
// favorite_filter.js
// =====================================
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

// ★ URLからターゲットIDやプレビューフラグを取得
const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
const isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';

// ★ 追加：リードオンリー（保存しない）モードの判定
const isReadOnlyMode = !!targetUserId || isPreviewMode;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadFilterData();
});

async function loadFilterData() {
    if (!workbookId) return;

    try {
        // 他人のデータを見ている場合は、その人のタグを取得するためのURLを作る
        let tagsUrl = `${API_BASE_URL}/tags?workbookId=${workbookId}`;
        if (targetUserId) tagsUrl += `&targetUserId=${targetUserId}`;

        // すべての fetch に { headers: getAuthHeaders() } を付与
        const [tagsRes, catRes, mcqRes, ddRes] = await Promise.all([
            fetch(tagsUrl, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/categories?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/questions/player?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/dd-questions?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false}))
        ]);
        
        // --- タグの描画 ---
        const tagContainer = document.getElementById('tag-manage-list');
        const tagSelectGroup = document.getElementById('tag-select-group');
        
        if (tagsRes.ok) {
            const tagData = await tagsRes.json();
            const tags = tagData.tags || [];
            
            if (tagContainer) {
                tagContainer.innerHTML = '';
                if (tags.length === 0) {
                    tagContainer.innerHTML = '<li style="color: var(--text-sub); font-size: 0.9em; padding: 10px;">作成されたタグはありません。</li>';
                } else {
                    tags.forEach(t => {
                        // 管理用リスト
                        // ★ 修正：ダミー削除ではなく、実際の削除関数を呼び出すように変更
                        tagContainer.insertAdjacentHTML('beforeend', `
                            <li class="tag-item">
                                <span># ${t.name}</span>
                                <div class="tag-actions">
                                    <button class="btn-delete" onclick="deleteTag(${t.id})">🗑️</button>
                                </div>
                            </li>
                        `);
                    });
                }
            }
            
            if (tagSelectGroup) {
                tagSelectGroup.innerHTML = '';
                if (tags.length === 0) {
                    tagSelectGroup.innerHTML = '<p style="color: var(--text-sub); font-size: 0.9em;">作成されたタグはありません。</p>';
                } else {
                    tags.forEach(t => {
                        tagSelectGroup.insertAdjacentHTML('beforeend', `
                            <label class="check-label"><input type="checkbox" name="select-tags" value="${t.id}"> # ${t.name}</label>
                        `);
                    });
                }
            }
        } else {
            if (tagContainer) tagContainer.innerHTML = '<p style="color: var(--danger); font-size: 0.9em;">通信エラー</p>';
        }

    } catch (e) {
        console.error(e);
    }
}

function goBack() { 
    let url = `player_menu.html?workbookId=${workbookId}`;
    if (targetUserId) url += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName)}`;
    if (isPreviewMode) url += `&preview=true`;
    window.location.href = url;
}

// ★ 修正：本物のタグ作成処理
async function createTag() {
    if (isReadOnlyMode) {
        alert('プレビューモード、または他ユーザーの成績確認中はタグの作成はできません。');
        return;
    }

    const input = document.getElementById('new-tag-input');
    const name = input.value.trim();

    if (!name) {
        alert('タグ名を入力してください。');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/tags`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ workbookId: parseInt(workbookId), name: name })
        });
        
        if (res.ok) {
            showToast('タグを作成しました！');
            input.value = '';
            loadFilterData(); // リストを再描画
        } else {
            alert('タグの作成に失敗しました。');
        }
    } catch (e) {
        console.error(e);
        alert('通信エラーが発生しました。');
    }
}

// ★ 追加：本物のタグ削除処理
async function deleteTag(tagId) {
    if (isReadOnlyMode) {
        alert('プレビューモード、または他ユーザーの成績確認中はタグの削除はできません。');
        return;
    }

    if (!confirm('本当にこのタグを削除しますか？\n（問題との紐付けもすべて解除されます）')) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/tags/${tagId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (res.ok) {
            showToast('タグを削除しました。');
            loadFilterData(); // リストを再描画
        } else {
            alert('タグの削除に失敗しました。');
        }
    } catch (e) {
        console.error(e);
        alert('通信エラーが発生しました。');
    }
}

function startFavoriteMode() {
    const checkedTags = Array.from(document.querySelectorAll('input[name="select-tags"]:checked')).map(cb => parseInt(cb.value));
    if (checkedTags.length === 0) {
        alert('出題するタグを1つ以上選択してください。');
        return;
    }
    sessionStorage.setItem('favoriteSelectedTags', JSON.stringify(checkedTags));

    let extraParams = '';
    if (targetUserId) extraParams += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName)}`;
    if (isPreviewMode) extraParams += `&preview=true`;

    window.location.href = `quiz.html?workbookId=${workbookId}&mode=favorite${extraParams}`;
}