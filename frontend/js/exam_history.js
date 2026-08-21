// exam_history.js
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
const isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';

// APIから取得した履歴データを、他人分も含めて一時保持するグローバル変数
let globalHistoryData = [];

function getExtraParams() {
    let extra = '';
    if (targetUserId) extra += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreviewMode) extra += `&preview=true`;
    return extra;
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    if (!workbookId) {
        alert('問題集が指定されていません。');
        window.location.href = 'index.html';
        return;
    }

    if (targetUserId && targetUserName) {
        const titleEl = document.querySelector('.header h1') || document.querySelector('h1');
        if (titleEl) {
            titleEl.innerText = `📁 ${targetUserName} さんの過去の成績`;
        }
    }

    loadHistory();
});

// ==========================================
// 🔄 履歴の読み込み（API連携版）
// ==========================================
async function loadHistory() {
    const historyKey = `exam_history_${workbookId}`;
    
    const listContainer = document.getElementById('history-list');
    const chartContainer = document.getElementById('score-chart');

    try {
        let historyUrl = `${API_BASE_URL}/history?workbookId=${workbookId}`;
        if (targetUserId) historyUrl += `&targetUserId=${targetUserId}`;

        const response = await fetch(historyUrl, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('ネットワークエラー');
        
        const apiData = await response.json();
        
        globalHistoryData = apiData.map(item => ({
            id: item.id,
            date: item.date,
            correct: item.correct,
            total: item.total,
            percent: item.percent,
            questions: JSON.parse(item.questions),
            answers: JSON.parse(item.answers)
        }));
        
        if (!targetUserId && !isPreviewMode) {
            localStorage.setItem(historyKey, JSON.stringify(globalHistoryData));
        }
        console.log('✅ サーバーから履歴を取得しました');

    } catch (error) {
        console.warn('🔌 オフライン: ローカルの履歴を使用します');
        globalHistoryData = JSON.parse(localStorage.getItem(historyKey)) || [];
    }

    listContainer.innerHTML = '';
    chartContainer.innerHTML = '';

    if (globalHistoryData.length === 0) {
        const emptyMsg = '<div style="text-align: center; color: var(--text-sub); width: 100%;">データがありません。</div>';
        listContainer.innerHTML = `<div class="form-group">${emptyMsg}</div>`;
        chartContainer.innerHTML = emptyMsg;
        chartContainer.style.alignItems = 'center';
        return;
    }

    chartContainer.style.alignItems = 'flex-end';

    const chronologicalHistory = [...globalHistoryData].reverse();
    chronologicalHistory.forEach(record => {
        const dateObj = new Date(record.date);
        const shortDate = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
        
        let barColor = 'var(--c-red, #ef4444)'; 
        if (record.percent === 100) barColor = 'var(--c-hat, #3b82f6)';
        else if (record.percent >= 80) barColor = 'var(--c-goal, #10b981)';
        else if (record.percent >= 60) barColor = 'var(--c-yellow, #f59e0b)';

        const group = document.createElement('div');
        group.className = 'chart-bar-group';
        group.innerHTML = `
            <div class="chart-bar" style="height: ${record.percent}%; background-color: ${barColor};" data-score="${record.percent}"></div>
            <div class="chart-label">${shortDate}</div>
        `;
        chartContainer.appendChild(group);
    });

    globalHistoryData.forEach((record, index) => {
        const dateObj = new Date(record.date);
        const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth()+1}月${dateObj.getDate()}日 ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        let scoreColor = 'var(--danger)';
        if (record.percent >= 80) scoreColor = 'var(--success)';
        else if (record.percent >= 60) scoreColor = '#f59e0b'; 

        const item = document.createElement('div');
        item.className = 'form-group';
        item.style.padding = '20px';
        item.style.marginBottom = '0';
        
        const isDbData = record.id !== undefined;
        const deleteTarget = isDbData ? record.id : index;

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
                <div>
                    <div style="font-size: 0.9em; color: var(--text-sub); margin-bottom: 5px;">📅 ${formattedDate}</div>
                    <div style="font-size: 1.2em; font-weight: bold;">
                        <span style="color: ${scoreColor}; font-size: 1.5em;">${record.percent}%</span> 
                        <span style="margin-left: 10px; font-size: 0.85em; color: var(--text-main);">(${record.correct} / ${record.total} 問正解)</span>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-outline btn-sm" onclick="reviewPastExam(${index})">🖥️ 見直す</button>
                    <button class="btn btn-primary btn-sm" onclick="retryPastExam(${index})">🔄 再挑戦</button>
                    <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" onclick="deleteHistory(${deleteTarget}, ${isDbData})" title="履歴を削除">🗑️</button>
                </div>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// ==========================================
// アクション処理群
// ==========================================

function reviewPastExam(index) {
    const record = globalHistoryData[index];

    if (!record || !record.questions || !record.answers) {
        alert('⚠️ 問題データが残っておらず見直しができません。');
        return;
    }

    const resultData = { 
        questions: record.questions, 
        answers: record.answers,
        isHistoryReview: true 
    };
    
    sessionStorage.setItem('examResults', JSON.stringify(resultData));
    
    // ★ 修正：遷移時にパラメータを引き継ぐように修正
    window.location.href = `exam_result.html?workbookId=${workbookId}${getExtraParams()}`;
}

function retryPastExam(index) {
    if (targetUserId || isPreviewMode) {
        alert('プレビューモード、または他ユーザーの成績確認中は「再挑戦」を利用できません。');
        return;
    }

    const record = globalHistoryData[index];

    if (!record || !record.questions) {
        alert('⚠️ 問題データが残っていないため再挑戦できません。');
        return;
    }

    if (confirm(`当時の出題セット（全 ${record.total} 問）でもう一度模試を開始しますか？\n過去の自分を越えましょう！`)) {
        sessionStorage.setItem('examRevengeMode', 'true');
        sessionStorage.setItem('examRevengeQuestions', JSON.stringify(record.questions));
        window.location.href = `exam_player.html?workbookId=${workbookId}`;
    }
}

async function deleteHistory(targetId, isDbData) {
    if (targetUserId || isPreviewMode) {
        alert('プレビューモード、または他ユーザーの履歴は削除できません。');
        return;
    }

    if (!confirm('この履歴を削除してもよろしいですか？\n（この操作は取り消せません）')) return;

    try {
        if (isDbData) {
            const response = await fetch(`${API_BASE_URL}/history/${targetId}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (!response.ok) throw new Error('サーバー削除エラー');
        } else {
            const historyKey = `exam_history_${workbookId}`;
            let history = JSON.parse(localStorage.getItem(historyKey)) || [];
            history.splice(targetId, 1);
            localStorage.setItem(historyKey, JSON.stringify(history));
        }
        
        showToast('🗑️ 履歴を削除しました');
        loadHistory(); 

    } catch (error) {
        console.error(error);
        alert('削除に失敗しました。');
    }
}

function goBack() { 
    window.location.href = `player_menu.html?workbookId=${workbookId}${getExtraParams()}`;
}