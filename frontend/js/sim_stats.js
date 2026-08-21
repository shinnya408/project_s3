// =====================================
// js/sim_stats.js
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
        window.location.href = 'index.html';
        return;
    }

    // ★ 追加: 他人の成績閲覧時はタイトルを変更
    if (targetUserId && targetUserName) {
        const titleEl = document.querySelector('.sim-page-title') || document.querySelector('h2');
        if (titleEl) {
            titleEl.innerText = `📊 ${targetUserName} さんの成績データ`;
        }
    }

    // ★ 追加: 戻るボタンにパラメータを引き継ぐ（HTML側のonclickをJSで上書きします）
    const backBtn = document.getElementById('btn-back');
    if(backBtn) {
        // HTMLの属性を無効化してJSで制御
        backBtn.removeAttribute('onclick'); 
        backBtn.onclick = () => {
            window.location.href = `sim_menu.html?workbookId=${workbookId}${getExtraParams()}`;
        };
    }

    await loadAndCalculateStats();
});

async function loadAndCalculateStats() {
    try {
        // ★ 修正: targetUserId があればAPIのURLに付与する
        let apiUrl = `${API_BASE_URL}/sim-answer-history?workbookId=${workbookId}`;
        if (targetUserId) apiUrl += `&targetUserId=${targetUserId}`;

        const res = await fetch(apiUrl, {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('履歴の取得に失敗しました');

        const historyData = await res.json();
        
        document.getElementById('loading-msg').style.display = 'none';
        document.getElementById('stats-content').style.display = 'block';

        if (historyData.length === 0) {
            document.getElementById('task-stats-container').innerHTML = '<p class="text-sub">まだ演習データがありません。</p>';
            return;
        }

        // 1. 全体サマリーの計算
        const totalPlays = historyData.length;
        const perfectClears = historyData.filter(h => h.correct).length;
        const perfectRate = Math.round((perfectClears / totalPlays) * 100);

        let totalPercentageSum = 0;
        historyData.forEach(h => {
            const percent = h.maxScore > 0 ? (h.earnedScore / h.maxScore) * 100 : 0;
            totalPercentageSum += percent;
        });
        const avgScore = Math.round(totalPercentageSum / totalPlays);

        document.getElementById('stat-total-plays').textContent = totalPlays;
        document.getElementById('stat-perfect-rate').textContent = `${perfectRate}%`;
        document.getElementById('stat-avg-score').textContent = `${avgScore}%`;

        // 2. 問題IDごとの最高スコア集計
        const taskStats = {};
        historyData.forEach(h => {
            const qId = h.simQuestionId;
            const percent = h.maxScore > 0 ? Math.round((h.earnedScore / h.maxScore) * 100) : 0;
            
            if (!taskStats[qId]) {
                taskStats[qId] = { maxScore: percent, attempts: 1, lastPlayed: h.createAt };
            } else {
                taskStats[qId].attempts += 1;
                if (percent > taskStats[qId].maxScore) {
                    taskStats[qId].maxScore = percent;
                }
                if (new Date(h.createAt) > new Date(taskStats[qId].lastPlayed)) {
                    taskStats[qId].lastPlayed = h.createAt;
                }
            }
        });

        // 3. 問題別リストの描画
        const container = document.getElementById('task-stats-container');
        container.innerHTML = '';

        Object.keys(taskStats).forEach(qId => {
            const stat = taskStats[qId];
            const dateStr = new Date(stat.lastPlayed).toLocaleDateString('ja-JP');
            
            let color = 'var(--text-main)';
            let icon = '📝';
            if (stat.maxScore === 100) { color = '#16a34a'; icon = '✅'; }
            else if (stat.maxScore >= 80) { color = '#0284c7'; icon = '⭐'; }
            else { color = '#ea580c'; icon = '⚠️'; }

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '10px';
            row.style.borderBottom = '1px solid var(--border, #e2e8f0)';

            row.innerHTML = `
                <div>
                    <div style="font-weight: bold; font-size: 1.1em;">${icon} 問題 ID: ${qId}</div>
                    <div style="font-size: 0.85em; color: var(--text-sub);">挑戦回数: ${stat.attempts} 回 / 最終演習: ${dateStr}</div>
                </div>
                <div style="font-size: 1.5em; font-weight: bold; color: ${color};">
                    ${stat.maxScore}%
                </div>
            `;
            container.appendChild(row);
        });

    } catch (e) {
        console.error(e);
        document.getElementById('loading-msg').textContent = 'エラー: 成績データの読み込みに失敗しました。';
        document.getElementById('loading-msg').style.color = '#ef4444';
    }
}