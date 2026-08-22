// exam_review.js
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
let currentIndex = 0;

let userTags = [];
let questionTags = {};

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    const resultStr = sessionStorage.getItem('examResults');
    if (!resultStr) { alert('採点データが見つかりません。メニューに戻ります。'); window.location.href = `player_menu?workbookId=${workbookId}${getExtraParams()}`; return; }

    const data = JSON.parse(resultStr);
    examQuestions = data.questions;
    userAnswers = data.answers;

    if (targetUserId && targetUserName) {
        document.getElementById('q-no-badge').innerText = `👀 ${targetUserName} さんの解答`;
    }

    await loadTagsFromAPI();
    showQuestion(0);
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
        } else { throw new Error('API Error'); }
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

function showQuestion(index) {
    if (index < 0 || index >= examQuestions.length) return;
    currentIndex = index;
    const q = examQuestions[index];
    const ans = userAnswers[index];

    document.getElementById('progress-text').innerText = `問 ${index + 1} / ${examQuestions.length}`;
    document.getElementById('q-id-badge').innerText = `ID: ${q.id}`;
    document.getElementById('q-text').innerText = q.question;
    document.getElementById('exp-text').innerText = q.explanation || "この問題には解説が設定されていません。";

    const flagInd = document.getElementById('q-flag-indicator');
    if (flagInd) flagInd.style.display = ans.flagged ? 'inline-block' : 'none';

    let isCorrect = false;
    let correctVals = [];

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
        correctVals = getCorrectValues(q);
        const userVals = ans.selectedValues || (ans.selectedValue ? [ans.selectedValue] : []);
        isCorrect = (userVals.length === correctVals.length) && userVals.every(v => correctVals.includes(v));
    }

    const resultBadge = document.getElementById('q-result-badge');
    if (isCorrect) {
        resultBadge.innerText = '⭕ 正解';
        resultBadge.style.background = 'var(--success)';
        resultBadge.style.color = '#fff';
    } else {
        resultBadge.innerText = '❌ 不正解';
        resultBadge.style.background = 'var(--danger)';
        resultBadge.style.color = '#fff';
    }

    document.getElementById('btn-prev-side').disabled = (index === 0);
    document.getElementById('btn-prev-bottom').disabled = (index === 0);
    document.getElementById('btn-next-side').disabled = (index === examQuestions.length - 1);
    document.getElementById('btn-next-bottom').disabled = (index === examQuestions.length - 1);

    const playArea = document.getElementById('play-area');
    playArea.innerHTML = '';

    if (q.format === 'dd') renderReviewDd(q, ans);
    else renderReviewMcq(q, ans, correctVals);
}

function renderReviewMcq(q, ans, correctVals) {
    const playArea = document.getElementById('play-area');
    const choices = [];
    
    const arrayData = q.choices || q.options || q.items || null;
    if (Array.isArray(arrayData)) {
        arrayData.forEach((c, index) => {
            const text = typeof c === 'object' ? (c.text || c.content || c.name || '') : c;
            if (text) choices.push({ id: index + 1, text: text });
        });
    } else {
        let i = 1;
        while (q[`choice${i}`] || q[`option${i}`]) {
            choices.push({ id: i, text: q[`choice${i}`] || q[`option${i}`] });
            i++;
        }
    }

    const userVals = ans.selectedValues || (ans.selectedValue ? [ans.selectedValue] : []);
    const inputType = correctVals.length > 1 ? 'checkbox' : 'radio';

    let html = `<div class="mcq-options" style="display: flex; flex-direction: column; gap: 12px;">`;
    
    choices.forEach(c => {
        let bgStyle = 'background-color: var(--bg-card); border-color: var(--border);';
        let isChecked = userVals.includes(c.id) ? 'checked' : '';
        
        if (correctVals.includes(c.id)) {
            if (userVals.includes(c.id)) {
                bgStyle = 'background-color: rgba(16, 185, 129, 0.1); border-color: var(--success);';
            } else {
                bgStyle = 'background-color: rgba(59, 130, 246, 0.1); border-color: var(--primary);';
            }
        } else if (userVals.includes(c.id)) {
            bgStyle = 'background-color: rgba(239, 68, 68, 0.1); border-color: var(--danger);';
        }

        const safeText = c.text.toString().replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
            <label class="mcq-label" style="display: flex; align-items: center; padding: 15px; border: 2px solid; border-radius: 8px; cursor: default; ${bgStyle}">
                <input type="${inputType}" disabled ${isChecked} style="margin-right: 15px; transform: scale(1.3);">
                <span style="font-size: 1.1em; line-height: 1.4;">${safeText}</span>
            </label>
        `;
    });
    html += `</div>`;
    playArea.innerHTML = html;
}

function renderReviewDd(q, ans) {
    const playArea = document.getElementById('play-area');
    
    let html = `
        <div style="margin-bottom: 20px;">
            <p style="font-weight: bold; margin-bottom: 10px; color: var(--text-main);">👇 あなたの解答結果</p>
            <div id="dd-source-area" class="dd-drop-zone" data-zone-index="-1" style="min-height: 80px; padding: 15px; background: var(--bg-main); border: 2px dashed var(--border); border-radius: 8px; display: flex; flex-wrap: wrap; gap: 10px;">
            </div>
        </div>
        <div id="dd-zones-area" style="display: flex; flex-wrap: wrap; gap: 20px;">
        </div>
    `;
    playArea.innerHTML = html;

    const sourceArea = playArea.querySelector('#dd-source-area');
    const zonesArea = playArea.querySelector('#dd-zones-area');

    if (q.dropZones) {
        q.dropZones.forEach((z, index) => {
            const zoneName = z.name || z.zoneName || z.title || `ゾーン ${index + 1}`;
            zonesArea.insertAdjacentHTML('beforeend', `
                <div class="dd-zone-container" style="flex: 1; min-width: 200px; background: var(--bg-card); border: 2px solid var(--border); border-radius: 8px; overflow: hidden;">
                    <div style="background: var(--bg-main); padding: 10px; font-weight: bold; border-bottom: 1px solid var(--border); text-align: center;">${zoneName}</div>
                    <div class="dd-drop-zone" data-zone-index="${index}" style="min-height: 120px; padding: 10px; display: flex; flex-direction: column; gap: 10px; background: transparent;"></div>
                </div>
            `);
        });
    }

    let items = q.dragItems || q.draggables || q.items || [];
    
    items.forEach((item, index) => {
        const text = item.text || item.content || item.name || '';
        const cZone = (item.correctZoneIndex !== undefined && item.correctZoneIndex !== null) ? item.correctZoneIndex : -1;
        const uZone = (ans.ddAnswers && ans.ddAnswers[index] !== undefined) ? ans.ddAnswers[index] : -1;
        
        let bgColor = 'var(--bg-card)';
        let borderColor = 'var(--border)';
        
        if (cZone === uZone) {
            bgColor = 'rgba(16, 185, 129, 0.1)';
            borderColor = 'var(--success)';
        } else {
            bgColor = 'rgba(239, 68, 68, 0.1)';
            borderColor = 'var(--danger)';
        }

        let itemHtml = `<div class="dd-drag-item" style="background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 6px; padding: 10px 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); user-select: none; display: flex; flex-direction: column; gap: 5px;">`;
        if (item.imageUrl) itemHtml += `<img src="${item.imageUrl}" style="max-height: 50px; display: block; margin-bottom: 5px;">`;
        itemHtml += `<span>${text}</span>`;
        
        if (cZone !== uZone) {
            let correctZoneName = "元の場所 (未分類)";
            if (cZone !== -1 && q.dropZones && q.dropZones[cZone]) correctZoneName = q.dropZones[cZone].name || `ゾーン ${cZone + 1}`;
            itemHtml += `<span style="font-size: 0.8em; color: var(--danger); font-weight: bold;">※正解: ${correctZoneName}</span>`;
        }
        itemHtml += `</div>`;
        
        let targetZone = sourceArea;
        if (uZone !== -1) {
            const z = playArea.querySelector(`.dd-drop-zone[data-zone-index="${uZone}"]`);
            if (z) targetZone = z;
        }
        targetZone.insertAdjacentHTML('beforeend', itemHtml);
    });
}

function nextQuestion() { if (currentIndex < examQuestions.length - 1) showQuestion(currentIndex + 1); }
function prevQuestion() { if (currentIndex > 0) showQuestion(currentIndex - 1); }

function showExamListModal() {
    const container = document.getElementById('list-container');
    container.innerHTML = '';
    examQuestions.forEach((q, i) => {
        const ans = userAnswers[i];
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

        const flagText = ans.flagged ? ' 🚩' : ''; 
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.style.marginBottom = '8px';
        btn.style.borderLeft = `5px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`;
        
        btn.innerText = `問${i + 1} - ${isCorrect ? '⭕ 正解' : '❌ 不正解'}${flagText}`;
        btn.onclick = () => { showQuestion(i); closeModal('list-modal'); };
        container.appendChild(btn);
    });
    document.getElementById('list-modal').classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ==========================================
// タグ操作関連（モーダル）
// ==========================================
function openQuizTagModal() {
    document.getElementById('quiz-new-tag-input').value = ''; 
    renderQuizTagCheckboxes(); 
    document.getElementById('quiz-tag-modal').classList.remove('hidden');
}

function renderQuizTagCheckboxes(preserveChecked = false) {
    const q = examQuestions[currentIndex]; 
    let tagsForThisQ = questionTags[`${q.format}_${q.id}`] || [];
    
    if (preserveChecked) {
        const checkedBoxes = document.querySelectorAll('input[name="quiz-active-tags"]:checked');
        tagsForThisQ = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    }
    
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
    // ★ 修正：個別タグ作成時、プレビューモードならブロックする
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
            renderQuizTagCheckboxes(false);
            input.value = '';
        }
    } catch (e) {
        alert('タグの作成に失敗しました。');
    }
}

async function saveQuizTags() {
    // ★ 修正：個別タグ保存時、プレビューモードならブロックする
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

function goBackToResult() { window.location.href = `exam_result?workbookId=${workbookId}${getExtraParams()}`; }