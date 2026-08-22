// =====================================
// js/sim_menu.js
// =====================================
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();

    if (!workbookId) {
        alert('問題集が指定されていません。');
        window.location.href = 'index';
        return;
    }

    const targetUserId = urlParams.get('targetUserId');
    const targetUserName = urlParams.get('targetUserName');
    const isPreview = urlParams.get('mode') === 'preview' || urlParams.get('preview') === 'true';

    // 問題集の名前をAPIから取得
    let workbookName = `シミュレーション問題集 (ID: ${workbookId})`;
    try {
        const wbRes = await fetch(`${API_BASE_URL}/workbooks`, { headers: getAuthHeaders() });
        if (wbRes.ok) {
            const workbooks = await wbRes.json();
            const wb = workbooks.find(w => String(w.id) === String(workbookId));
            if (wb && wb.name) {
                workbookName = wb.name;
            }
        }
    } catch (e) {
        console.warn("問題集の名前の取得に失敗しました", e);
    }

    // タイトル表示の更新
    const titleEl = document.getElementById('workbook-title');
    if (titleEl) {
        if (targetUserId) {
            titleEl.innerText = `📊 ${targetUserName} さんの成績確認 - ${workbookName}`;
        } else if (isPreview) {
            titleEl.innerText = `👀 ${workbookName} [プレビュー中]`;
        } else {
            titleEl.innerText = `🧪 ${workbookName} のメニュー`;
        }
    }
});

function goToMode(targetMode) {
    if (!workbookId) return;

    const currentParams = new URLSearchParams(window.location.search);
    const targetUserId = currentParams.get('targetUserId');
    const targetUserName = currentParams.get('targetUserName');
    const isPreview = currentParams.get('mode') === 'preview' || currentParams.get('preview') === 'true';

    let extraParams = '';
    if (targetUserId) extraParams += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreview) extraParams += `&preview=true`;

    if (targetMode === 'practice') {
        window.location.href = `sim_player?workbookId=${workbookId}&mode=practice${extraParams}`;
    } 
    else if (targetMode === 'exam') {
        window.location.href = `sim_player?workbookId=${workbookId}&mode=exam${extraParams}`;
    }
    else if (targetMode === 'free') {
        window.location.href = `sim_player?workbookId=${workbookId}&mode=free${extraParams}`;
    }
    else if (targetMode === 'stats') {
        window.location.href = `sim_stats?workbookId=${workbookId}${extraParams}`;
    }
    else if (targetMode === 'history') {
        window.location.href = `sim_history?workbookId=${workbookId}${extraParams}`;
    }
}