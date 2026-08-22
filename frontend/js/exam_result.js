// exam_result.js
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
const isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';

const isReadOnlyMode = !!targetUserId || isPreviewMode;

function getExtraParams() {
    let extra = '';
    if (targetUserId) extra += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreviewMode) extra += `&preview=true`;
    return extra;
}

let examQuestions = [];
let userAnswers = [];
let incorrectQuestionsToRevenge = []; 
let isHistoryReview = false;

let userTags = [];
let questionTags = {};
let currentIndex = 0; // タグ編集用

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    if (!workbookId) { alert('エラー：問題集が指定されていません。'); window.location.href = 'index'; return; }
    
    const resultStr = sessionStorage.getItem('examResults');
    if (!resultStr) { alert('採点データが見つかりません。メニューに戻ります。'); window.location.href = `player_menu?workbookId=${workbookId}${getExtraParams()}`; return; }

    const data = JSON.parse(resultStr);
    examQuestions = data.questions;
    userAnswers = data.answers;
    isHistoryReview = data.isHistoryReview === true;

    if (targetUserId && targetUserName) {
        const titleEl = document.querySelector('.header h1') || document.querySelector('h1');
        if (titleEl) titleEl.innerText = `📋 ${targetUserName} さんの採点結果`;
    }

    // タグ情報の読み込み（モーダル用）
    await loadTagsFromAPI();

    const historyBtn = document.querySelector('button[onclick*="exam_history"]');
    if (historyBtn) {
        historyBtn.setAttribute('onclick', `window.location.href='exam_history?workbookId=${workbookId}${getExtraParams()}'`);
    }

    gradeExam();
});

async function loadTagsFromAPI() {
    try {
        let tagsUrl = `${API_BASE_URL}/tags?workbookId=${workbookId}`;
        if (targetUserId) tagsUrl += `&targetUserId=${targetUserId}`;

        const res = await fetch(tagsUrl, { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            userTags = data.tags || [];
            questionTags = data.questionTags || {};
            if (!isReadOnlyMode) {
                localStorage.setItem(`user_tags_${workbookId}`, JSON.stringify(userTags));
                localStorage.setItem(`question_tags_${workbookId}`, JSON.stringify(questionTags));
            }
        }
    } catch (e) {
        if (!isReadOnlyMode) {
            userTags = JSON.parse(localStorage.getItem(`user_tags_${workbookId}`)) || [];
            questionTags = JSON.parse(localStorage.getItem(`question_tags_${workbookId}`)) || {};
        }
    }
}

function getCorrectValues(q) {
    let corrects = [];
    const arrayData = q.choices || q.options || q.items || null;
    if (Array.isArray(arrayData)) {
        arrayData.forEach((c, idx) => {
            if (typeof c === 'object' && (c.isCorrect === true || c.correct === true)) corrects.push(idx + 1);
        });
    }
    if (corrects.length === 0) {
        const singleCorrect = q.correctChoice ?? q.correctAnswer ?? 1;
        corrects.push(parseInt(singleCorrect) || 1);
    }
    return corrects;
}

function gradeExam() {
    let correctCount = 0;
    const totalCount = examQuestions.length;
    const listContainer = document.getElementById('result-list');
    listContainer.innerHTML = '';
    incorrectQuestionsToRevenge = []; 

    examQuestions.forEach((q, index) => {
        const ans = userAnswers[index];
        let isCorrect = false;

        if (q.format === 'dd') {
            let allCorrect = true;
            let items = q.dragItems || q.draggables || q.items || [];
            if (!ans.ddAnswers || Object.keys(ans.ddAnswers).length === 0) allCorrect = false;
            else {
                items.forEach((item, idx) => {
                    const cZone = (item.correctZoneIndex !== undefined && item.correctZoneIndex !== null) ? item.correctZoneIndex : -1;
                    const uZone = ans.ddAnswers[idx] !== undefined ? ans.ddAnswers[idx] : -1;
                    if (cZone !== uZone) allCorrect = false;
                });
            }
            isCorrect = allCorrect;
        } else {
            const correctVals = getCorrectValues(q);
            const userVals = ans.selectedValues || (ans.selectedValue ? [ans.selectedValue] : []);
            isCorrect = (userVals.length === correctVals.length) && userVals.every(v => correctVals.includes(v));
        }
        
        if (isCorrect) correctCount++;
        else incorrectQuestionsToRevenge.push(q);

        const timeSpent = ans.timeSpent || 0;
        const timeMin = Math.floor(timeSpent / 60);
        const timeSec = timeSpent % 60;
        const timeText = timeMin > 0 ? `${timeMin}分${timeSec}秒` : `${timeSec}秒`;
        const timeStyle = timeSpent >= 180 ? 'color: var(--danger); font-weight: bold;' : 'color: var(--text-sub);';

        const item = document.createElement('div');
        item.className = `result-item ${isCorrect ? 'correct' : 'incorrect'}`;
        
        const statusHtml = isCorrect 
            ? `<span class="result-status" style="color: var(--success);">⭕ 正解</span>`
            : `<span class="result-status" style="color: var(--danger);">❌ 不正解</span>`;

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
                ${statusHtml}
                <div style="flex: 1;">
                    <div style="font-size: 0.9em; margin-bottom: 5px;">
                        <span style="color: var(--text-sub);">第 ${index + 1} 問 (ID: ${q.id} ${q.format === 'dd' ? 'D&D' : ''})</span>
                        <span style="margin-left: 10px; ${timeStyle}">⏱️ ${timeText}</span>
                    </div>
                    <div style="font-weight: bold;">${q.question.substring(0, 30)}${q.question.length > 30 ? '...' : ''}</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.85em;" onclick="openTagModalForIndex(${index})">⭐</button>
                    <button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.85em;" onclick="openReviewModal(${index})">🔍 見直し</button>
                </div>
            </div>
        `;
        listContainer.appendChild(item);
    });

    const percent = Math.round((correctCount / totalCount) * 100) || 0;
    document.getElementById('score-percent').innerText = `${percent}%`;
    document.getElementById('score-text').innerText = `${correctCount} / ${totalCount} 問 正解`;
    
    const msgEl = document.getElementById('score-message');
    
    if (isHistoryReview) {
        msgEl.innerText = "📅 過去の成績の閲覧モードです";
    } else if (isReadOnlyMode) {
        msgEl.innerText = "👀 プレビューモード (成績は保存されません)";
    } else {
        if (percent === 100) msgEl.innerText = "🎉 完璧です！素晴らしい！";
        else if (percent >= 90) msgEl.innerText = "🏅 合格ラインクリア！よくできました。";
        else if (percent >= 80) msgEl.innerText = "✨ 合格ラインまであと一歩！苦手を克服しましょう。";
        else if (percent >= 60) msgEl.innerText = "👍 あと一息！復習して完璧にしましょう。";
        else msgEl.innerText = "💪 伸びしろたっぷり！見直し機能で復習しましょう。";

        saveHistory(correctCount, totalCount, percent);
        submitAnswerHistory();
    }
}

async function submitAnswerHistory() {
    if (isReadOnlyMode || isHistoryReview) return;

    const payload = examQuestions.map((q, index) => {
        const ans = userAnswers[index];
        let isCorrect = false;

        if (q.format === 'dd') {
            let allCorrect = true;
            let items = q.dragItems || q.draggables || q.items || [];
            if (!ans.ddAnswers || Object.keys(ans.ddAnswers).length === 0) allCorrect = false;
            else {
                items.forEach((item, idx) => {
                    const cZone = (item.correctZoneIndex !== undefined && item.correctZoneIndex !== null) ? item.correctZoneIndex : -1;
                    const uZone = ans.ddAnswers[idx] !== undefined ? ans.ddAnswers[idx] : -1;
                    if (cZone !== uZone) allCorrect = false;
                });
            }
            isCorrect = allCorrect;
        } else {
            const correctVals = getCorrectValues(q);
            const userVals = ans.selectedValues || (ans.selectedValue ? [ans.selectedValue] : []);
            isCorrect = (userVals.length === correctVals.length) && userVals.every(v => correctVals.includes(v));
        }

        return { workbookId: parseInt(workbookId), questionId: q.id, format: q.format, correct: isCorrect };
    });

    try {
        await fetch(`${API_BASE_URL}/answer-history/submit`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn('🔌 履歴の送信に失敗しました', error);
    }
}

function startRevengeMode() {
    if (isReadOnlyMode) {
        alert('プレビュー・レビューモードではリベンジ受験はできません。');
        return;
    }
    if (incorrectQuestionsToRevenge.length === 0) { alert('間違えた問題はありません！完璧です🎉'); return; }
    if (confirm(`間違えた ${incorrectQuestionsToRevenge.length} 問のみで「リベンジ受験」を開始しますか？\n記憶が新しいうちに解き直すことで定着率がアップします！`)) {
        sessionStorage.setItem('examRevengeMode', 'true');
        sessionStorage.setItem('examRevengeQuestions', JSON.stringify(incorrectQuestionsToRevenge));
        window.location.href = `exam_player?workbookId=${workbookId}`;
    }
}

async function saveHistory(correct, total, percent) {
    if (isReadOnlyMode || isHistoryReview) return;

    const historyKey = `exam_history_${workbookId}`;
    const newRecord = {
        workbookId: parseInt(workbookId),
        correct: correct,
        total: total,
        percent: percent,
        questions: JSON.stringify(examQuestions),
        answers: JSON.stringify(userAnswers)
    };
    try {
        await fetch(`${API_BASE_URL}/history`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newRecord)
        });
    } catch (error) {
        let history = JSON.parse(localStorage.getItem(historyKey)) || [];
        const localRecord = { date: new Date().toISOString(), correct: correct, total: total, percent: percent, questions: examQuestions, answers: userAnswers };
        history.unshift(localRecord);
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem(historyKey, JSON.stringify(history));
    }
}

function openReviewModal(index) {
    const q = examQuestions[index];
    const ans = userAnswers[index];
    
    document.getElementById('review-title').innerText = `第 ${index + 1} 問 の見直し`;
    document.getElementById('review-id').innerText = `ID: ${q.id}`;
    document.getElementById('review-q-text').innerText = q.question;

    if (q.format === 'dd') {
        document.getElementById('review-correct-ans').innerText = "（詳細は「プレイヤー形式で見直す」ボタンから確認してください）";
        document.getElementById('review-user-ans').innerText = "D&D問題の解答結果";
        
        let allCorrect = true;
        let items = q.dragItems || q.draggables || q.items || [];
        if (!ans.ddAnswers || Object.keys(ans.ddAnswers).length === 0) allCorrect = false;
        else {
            items.forEach((item, idx) => {
                const cZone = (item.correctZoneIndex !== undefined && item.correctZoneIndex !== null) ? item.correctZoneIndex : -1;
                const uZone = ans.ddAnswers[idx] !== undefined ? ans.ddAnswers[idx] : -1;
                if (cZone !== uZone) allCorrect = false;
            });
        }
        
        const userBox = document.getElementById('review-user-ans').parentElement;
        if (allCorrect) {
            userBox.style.borderColor = 'var(--success)';
            userBox.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
            document.getElementById('review-user-ans').style.color = 'var(--success)';
        } else {
            userBox.style.borderColor = 'var(--danger)';
            userBox.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            document.getElementById('review-user-ans').style.color = 'var(--danger)';
        }
    } else {
        const correctVals = getCorrectValues(q);
        const userVals = ans.selectedValues || (ans.selectedValue ? [ans.selectedValue] : []);

        const getChoiceText = (val) => {
            const arrayData = q.choices || q.options || q.items || null;
            if (Array.isArray(arrayData) && arrayData.length >= val) {
                const c = arrayData[val - 1];
                return typeof c === 'object' ? (c.text || c.content || c.name || '') : c;
            }
            return q[`choice${val}`] || q[`option${val}`] || `選択肢 ${val}`;
        };

        const correctText = correctVals.map(getChoiceText).join(' ／ ');
        const userText = userVals.length > 0 ? userVals.map(getChoiceText).join(' ／ ') : "未解答";

        document.getElementById('review-correct-ans').innerText = correctText;
        document.getElementById('review-user-ans').innerText = userText;
        
        const isCorrect = (userVals.length === correctVals.length) && userVals.every(v => correctVals.includes(v));
        const userBox = document.getElementById('review-user-ans').parentElement;
        if (isCorrect) {
            userBox.style.borderColor = 'var(--success)';
            userBox.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
            document.getElementById('review-user-ans').style.color = 'var(--success)';
        } else {
            userBox.style.borderColor = 'var(--danger)';
            userBox.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            document.getElementById('review-user-ans').style.color = 'var(--danger)';
        }
    }

    document.getElementById('review-exp-text').innerText = q.explanation || "この問題には解説が設定されていません。";
    document.getElementById('review-modal').classList.remove('hidden');
}

// ==========================================
// タグ操作関連（モーダル）
// ==========================================

function openTagModal() { 
    if (isReadOnlyMode) {
        alert('プレビューモード、または他ユーザーの成績確認中はタグ付けを利用できません。');
        return;
    }

    // ★ 修正：一括タグ用のリストを動的生成
    const container = document.querySelector('#tag-modal .checkbox-group');
    if (container) {
        container.innerHTML = '';
        if (userTags.length === 0) {
            container.innerHTML = '<p style="color: var(--text-sub); font-size: 0.9em;">作成されたタグはありません。</p>';
        } else {
            userTags.forEach(tag => {
                container.insertAdjacentHTML('beforeend', `
                    <label class="check-label"><input type="checkbox" name="batch-tags" value="${tag.id}"> # ${tag.name}</label>
                `);
            });
        }
    }
    document.getElementById('new-tag-input').value = '';
    
    document.getElementById('tag-modal').classList.remove('hidden'); 
}

async function applyBatchTags() {
    if (isReadOnlyMode) {
        alert('プレビューモード、または他ユーザーの成績確認中はタグ付けを利用できません。');
        closeModal('tag-modal');
        return;
    }

    const checkedTagIds = Array.from(document.querySelectorAll('input[name="batch-tags"]:checked')).map(cb => parseInt(cb.value));
    const newTagName = document.getElementById('new-tag-input').value.trim();
    
    if (checkedTagIds.length === 0 && !newTagName) { 
        alert('タグを選択するか、新しいタグ名を入力してください。'); 
        return; 
    }
    
    try {
        let newTagId = null;
        if (newTagName) {
            if (userTags.some(t => t.name === newTagName)) {
                alert('入力された新しいタグは既に存在します。既存のタグから選択してください。');
                return;
            }
            const res = await fetch(`${API_BASE_URL}/tags`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ workbookId: parseInt(workbookId), name: newTagName })
            });
            if (res.ok) {
                const newTag = await res.json();
                userTags.push(newTag);
                newTagId = newTag.id;
                checkedTagIds.push(newTagId);
                localStorage.setItem(`user_tags_${workbookId}`, JSON.stringify(userTags));
            } else {
                throw new Error('タグ作成エラー');
            }
        }

        // ★ 修正：全出題問題にタグを付与
        for (const q of examQuestions) {
            const key = `${q.format}_${q.id}`;
            let currentTags = questionTags[key] || [];
            
            // 重複を排除してマージ
            const mergedTags = Array.from(new Set([...currentTags, ...checkedTagIds]));
            questionTags[key] = mergedTags;

            await fetch(`${API_BASE_URL}/tags/questions`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ questionId: q.id, format: q.format, tagIds: mergedTags })
            });
        }

        localStorage.setItem(`question_tags_${workbookId}`, JSON.stringify(questionTags));
        alert(`今回の出題 ${examQuestions.length} 問に一括でタグを付与しました！`);
        closeModal('tag-modal');

    } catch (e) {
        console.error(e);
        alert('一括タグ付け処理中にエラーが発生しました。');
    }
}

function openTagModalForIndex(index) {
    if (isReadOnlyMode) {
        alert('プレビューモード、または他ユーザーの成績確認中はお気に入り（タグ）の編集を利用できません。');
        return;
    }
    currentIndex = index;
    document.getElementById('quiz-new-tag-input').value = ''; 
    renderQuizTagCheckboxes(); 
    document.getElementById('quiz-tag-modal').classList.remove('hidden');
}

function renderQuizTagCheckboxes() {
    const q = examQuestions[currentIndex]; 
    let tagsForThisQ = questionTags[`${q.format}_${q.id}`] || [];
    
    const container = document.getElementById('quiz-tag-checkboxes');
    container.innerHTML = '';

    if (userTags.length === 0) {
        container.innerHTML = '<p style="color: var(--text-sub);">タグが作成されていません。</p>';
    } else {
        userTags.forEach(tag => {
            const isChecked = tagsForThisQ.includes(tag.id) ? 'checked' : '';
            container.insertAdjacentHTML('beforeend', `
                <label class="check-label" style="display: flex; cursor: pointer;">
                    <input type="checkbox" name="quiz-active-tags" value="${tag.id}" ${isChecked} style="margin-right: 10px; cursor: pointer;">
                    # ${tag.name}
                </label>
            `);
        });
    }
}

async function addNewTagFromQuiz() {
    if (isReadOnlyMode) {
        alert('プレビュー・レビューモードではタグの作成はできません。');
        return;
    }

    const input = document.getElementById('quiz-new-tag-input');
    const name = input.value.trim();
    if (!name) return;
    if (userTags.some(t => t.name === name)) { alert('そのタグは既に存在します。'); return; }

    try {
        const res = await fetch(`${API_BASE_URL}/tags`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ workbookId: parseInt(workbookId), name: name })
        });
        if (res.ok) {
            const newTag = await res.json();
            userTags.push(newTag);
            
            const q = examQuestions[currentIndex];
            const checkedBoxes = document.querySelectorAll('input[name="quiz-active-tags"]:checked');
            const activeIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
            activeIds.push(newTag.id);
            questionTags[`${q.format}_${q.id}`] = activeIds;
            
            localStorage.setItem(`user_tags_${workbookId}`, JSON.stringify(userTags));
            renderQuizTagCheckboxes();
            input.value = '';
        }
    } catch (e) {
        alert('タグの作成に失敗しました。');
    }
}

async function saveQuizTags() {
    if (isReadOnlyMode) {
        alert('プレビュー・レビューモードではタグの保存はできません。');
        return;
    }

    const q = examQuestions[currentIndex];
    const checkedBoxes = document.querySelectorAll('input[name="quiz-active-tags"]:checked');
    const newTagIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    questionTags[`${q.format}_${q.id}`] = newTagIds;
    localStorage.setItem(`question_tags_${workbookId}`, JSON.stringify(questionTags));
    closeModal('quiz-tag-modal');

    try {
        await fetch(`${API_BASE_URL}/tags/questions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ questionId: q.id, format: q.format, tagIds: newTagIds })
        });
        showToast('この問題のタグを更新しました！'); 
    } catch (e) {
        showToast('オフラインのためローカルに保存しました');
    }
}

function goToReviewPlayer() { 
    window.location.href = `exam_review?workbookId=${workbookId}${getExtraParams()}`; 
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function goToMenu() { window.location.href = `player_menu?workbookId=${workbookId}${getExtraParams()}`; }