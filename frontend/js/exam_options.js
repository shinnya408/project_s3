// =====================================
// exam_options.js
// =====================================
const workbookId = new URLSearchParams(window.location.search).get('workbookId');

// 初期値のデフォルト
let defaultTimeValueMinutes = 60; 
let defaultCountValue = 20;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await loadExamDefaultSettings(); // ★ 追加: DBから設定値を取得
});

function goBack() { 
    window.location.href = `exam_filter?workbookId=${workbookId}`; 
}

// ★ 追加: バックエンドから模試設定を取得してUIに反映する
async function loadExamDefaultSettings() {
    if (!workbookId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/multiple-choice-settings?workbookId=${workbookId}`, { headers: getAuthHeaders() });
        if (res.ok) {
            const settings = await res.json();
            const setting = Array.isArray(settings) ? settings[0] : settings;
            
            if (setting) {
                // 値の取得（秒を分に変換）
                if (setting.questionCount || setting.question_count) {
                    defaultCountValue = setting.questionCount || setting.question_count;
                }
                const sec = setting.timeLimiteSecond || setting.time_limite_second;
                if (sec) {
                    defaultTimeValueMinutes = Math.floor(sec / 60);
                }

                // UIの書き換え
                const timeLabel = document.getElementById('default-time-label');
                if (timeLabel) {
                    timeLabel.innerHTML = `<input type="radio" name="time_limit" value="default" checked> デフォルト (${defaultTimeValueMinutes}分)`;
                }
                const countLabel = document.getElementById('default-count-label');
                if (countLabel) {
                    countLabel.innerHTML = `<input type="radio" name="q_count" value="default" checked> デフォルト (${defaultCountValue}問)`;
                }
            }
        }
    } catch(e) {
        console.warn('模試デフォルト設定の取得に失敗しました:', e);
    }
}

function startExam() {
    const timeLimitType = document.querySelector('input[name="time_limit"]:checked').value;
    let timeValue = defaultTimeValueMinutes; // ★ 変数を使用
    if (timeLimitType === 'custom') {
        const val = document.getElementById('custom-time').value;
        if (!val) { alert('指定時間を入力してください。'); return; }
        timeValue = parseInt(val);
    } else if (timeLimitType === 'none') {
        timeValue = 0; 
    }

    const qCountType = document.querySelector('input[name="q_count"]:checked').value;
    let countValue = defaultCountValue; // ★ 変数を使用
    if (qCountType === 'custom') {
        const val = document.getElementById('custom-count').value;
        if (!val) { alert('指定出題数を入力してください。'); return; }
        countValue = parseInt(val);
    } else if (qCountType === 'all') {
        countValue = 9999; 
    }

    const optionConfig = {
        timeLimitType: timeLimitType,
        timeLimitMinutes: timeValue,
        timeoutAction: document.querySelector('input[name="timeout_action"]:checked').value,
        qCountType: qCountType,
        qCountValue: countValue
    };

    sessionStorage.setItem('examOptionConfig', JSON.stringify(optionConfig));
    window.location.href = `exam_player?workbookId=${workbookId}`;
}