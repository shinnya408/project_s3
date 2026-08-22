// =====================================
// js/sim_history.js
// =====================================
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

// ★ 追加: ターゲットユーザーの情報を取得
const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
const isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';

function getExtraParams() {
    let extra = '';
    if (targetUserId) extra += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreviewMode) extra += `&preview=true`;
    return extra;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof initTheme === 'function') initTheme();

    if (!workbookId) {
        alert('問題集が指定されていません。');
        window.location.href = 'index';
        return;
    }

    // ★ 追加: 他人の成績閲覧時はタイトルを変更
    if (targetUserId && targetUserName) {
        const titleEl = document.querySelector('.sim-page-title') || document.querySelector('h2');
        if (titleEl) {
            titleEl.innerText = `📊 ${targetUserName} さんの演習履歴`;
        }
    }

    // ★ 修正: 戻るボタンにパラメータを引き継ぐ
    document.getElementById('btn-back').onclick = () => {
        window.location.href = `sim_menu?workbookId=${workbookId}${getExtraParams()}`;
    };

    await loadHistory();
});

async function loadHistory() {
    const container = document.getElementById('history-list-container');
    try {
        // ★ 修正: targetUserId があればAPIのURLに付与する
        let apiUrl = `${API_BASE_URL}/sim-answer-history?workbookId=${workbookId}`;
        if (targetUserId) apiUrl += `&targetUserId=${targetUserId}`;

        const res = await fetch(apiUrl, {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('履歴の取得に失敗しました');

        const historyData = await res.json();
        container.innerHTML = '';

        if (historyData.length === 0) {
            container.innerHTML = '<p class="text-sub" style="text-align: center; padding: 20px;">シミュレーションの演習履歴がありません。</p>';
            return;
        }

        historyData.forEach(item => {
            const dateStr = new Date(item.createAt).toLocaleString('ja-JP');
            const percent = item.maxScore > 0 ? Math.round((item.earnedScore / item.maxScore) * 100) : 0;
            const statusBadge = item.correct 
                ? '<span class="task-status-badge accomplished">⭕ 完璧</span>' 
                : '<span class="task-status-badge unaccomplished">△ もう一息</span>';

            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 10px; margin-bottom: 10px;">
                    <div>
                        <div style="font-size: 0.85em; color: var(--text-sub); margin-bottom: 5px;">🗓️ ${dateStr} (問題ID: ${item.simQuestionId})</div>
                        <div style="font-size: 1.2em; font-weight: bold; color: var(--primary);">${percent}% <span style="font-size: 0.7em; color: var(--text-sub);">(${item.earnedScore} / ${item.maxScore} 点)</span></div>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                <details class="task-exp-details">
                    <summary style="font-size: 0.9em;">📝 当時の提出コンフィグを見る</summary>
                    <pre class="task-exp-code" style="margin-top: 10px;">${escapeHtml(item.userAnswerText || 'コンフィグなし')}</pre>
                </details>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #ef4444;">エラー: 履歴の読み込みに失敗しました。</p>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}