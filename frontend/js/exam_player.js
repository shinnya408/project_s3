// exam_player.js
const workbookId = new URLSearchParams(window.location.search).get('workbookId');

let examQuestions = []; 
let userAnswers = []; 
let currentIndex = 0;
let remainingSeconds = 0;
let timerInterval = null;
let timeoutAction = 'force_end'; 
let globalMemo = ""; 

const SAVE_KEY = `exam_progress_${workbookId}`; 

let userTags = [];
let questionTags = {};

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    if (!workbookId) { alert('問題集が指定されていません。'); window.location.href = 'index'; return; }
    
    await loadTagsFromAPI();

    const savedData = localStorage.getItem(SAVE_KEY);
    if (savedData) { restoreExam(JSON.parse(savedData)); return; }
    initFreshExam();
});

async function loadTagsFromAPI() {
    try {
        const res = await fetch(`${API_BASE_URL}/tags?workbookId=${workbookId}`, { headers: getAuthHeaders() });
        if(res.ok) {
            const data = await res.json();
            userTags = data.tags || [];
            questionTags = data.questionTags || {};
            localStorage.setItem(`user_tags_${workbookId}`, JSON.stringify(userTags));
            localStorage.setItem(`question_tags_${workbookId}`, JSON.stringify(questionTags));
        } else { throw new Error('API Error'); }
    } catch(e) {
        userTags = JSON.parse(localStorage.getItem(`user_tags_${workbookId}`)) || [];
        questionTags = JSON.parse(localStorage.getItem(`question_tags_${workbookId}`)) || {};
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

async function initFreshExam() {
    const filterConfigStr = sessionStorage.getItem('examFilterConfig');
    const optionConfigStr = sessionStorage.getItem('examOptionConfig');
    const isRevenge = sessionStorage.getItem('examRevengeMode') === 'true';

    const optionConfig = JSON.parse(optionConfigStr || '{"timeoutAction":"force_end", "timeLimitMinutes": 0, "qCountType":"default", "qCountValue":20}');

    if (isRevenge) {
        examQuestions = JSON.parse(sessionStorage.getItem('examRevengeQuestions'));
    } else {
        try {
            // ★ 変数名エラーを修正し、すべての fetch に getAuthHeaders() を付与
            const [resMcq, resDd, resHistory, resTags] = await Promise.all([
                fetch(`${API_BASE_URL}/questions/player?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
                fetch(`${API_BASE_URL}/dd-questions?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
                fetch(`${API_BASE_URL}/answer-history/summary?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
                fetch(`${API_BASE_URL}/tags?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false}))
            ]);
            
            const mcqData = resMcq.ok ? await resMcq.json() : [];
            const ddData = resDd.ok ? await resDd.json() : [];
            const mappedMcq = mcqData.map(q => ({ ...q, format: 'mcq' }));
            const mappedDd = ddData.map(q => ({ ...q, format: 'dd' }));
            
            let allQuestions = [...mappedMcq, ...mappedDd];

            const filterConfig = JSON.parse(filterConfigStr || '{}');

            if (filterConfig && Object.keys(filterConfig).length > 0) {
                let historyMap = {};
                if (resHistory.ok) {
                    const histories = await resHistory.json();
                    histories.forEach(h => { historyMap[h.questionFormat + '_' + h.questionId] = JSON.parse(h.historyJson); });
                }
                let questionTagsMap = {};
                if (resTags.ok) {
                    const tagData = await resTags.json();
                    questionTagsMap = tagData.questionTags || {};
                }

                if (filterConfig.statuses && filterConfig.statuses.length > 0) {
                    allQuestions = allQuestions.filter(q => {
                        const key = q.format + '_' + q.id;
                        const hArr = historyMap[key];
                        let status = 'bench';
                        if (hArr && hArr.length > 0) {
                            const len = hArr.length;
                            if (len >= 3 && hArr[len-1] && hArr[len-2] && hArr[len-3]) status = 'hat';
                            else if (hArr[len-1] === true) status = 'goal';
                            else if (len >= 2 && !hArr[len-1] && !hArr[len-2]) status = 'red';
                            else status = 'yellow';
                        }
                        return filterConfig.statuses.includes(status);
                    });
                }

                if (filterConfig.categories && filterConfig.categories.length > 0) {
                    allQuestions = allQuestions.filter(q => {
                        const majorVal = q.categoryMajorId ? `major_${q.categoryMajorId}` : 'unclassified';
                        const mediumVal = q.categoryMediumId ? `medium_${q.categoryMediumId}` : null;
                        const minorVal = q.categoryMinorId ? `minor_${q.categoryMinorId}` : null;

                        return filterConfig.categories.includes(majorVal) ||
                               (mediumVal && filterConfig.categories.includes(mediumVal)) ||
                               (minorVal && filterConfig.categories.includes(minorVal));
                    });
                }

                if (filterConfig.tags && filterConfig.tags.length > 0) {
                    allQuestions = allQuestions.filter(q => {
                        const key = q.format + '_' + q.id;
                        const tagsForQ = questionTagsMap[key] || [];
                        return filterConfig.tags.some(tId => tagsForQ.includes(tId));
                    });
                }

                if (filterConfig.hash) {
                    const hashLower = filterConfig.hash.toLowerCase();
                    allQuestions = allQuestions.filter(q => q.question.toLowerCase().includes(hashLower));
                }

                if (filterConfig.order === 'random') {
                    allQuestions.sort(() => 0.5 - Math.random());
                } else if (filterConfig.order === 'category') {
                    allQuestions.sort((a, b) => (a.categoryMajorId || 999999) - (b.categoryMajorId || 999999) || a.id - b.id);
                } else if (filterConfig.order === 'priority') {
                    const weight = { 'bench': 1, 'red': 2, 'yellow': 3, 'goal': 4, 'hat': 5 };
                    allQuestions.sort((a, b) => {
                        const getStat = (q) => {
                            const hArr = historyMap[q.format + '_' + q.id];
                            if (!hArr || hArr.length === 0) return 'bench';
                            const len = hArr.length;
                            if (len >= 3 && hArr[len-1] && hArr[len-2] && hArr[len-3]) return 'hat';
                            if (hArr[len-1] === true) return 'goal';
                            if (len >= 2 && !hArr[len-1] && !hArr[len-2]) return 'red';
                            return 'yellow';
                        };
                        const statA = getStat(a);
                        const statB = getStat(b);
                        if (weight[statA] !== weight[statB]) return weight[statA] - weight[statB];
                        return 0.5 - Math.random(); 
                    });
                }
            } else {
                allQuestions.sort(() => 0.5 - Math.random());
            }
            
            let count = allQuestions.length;
            if (optionConfig.qCountType === 'custom') count = optionConfig.qCountValue || 20;
            else if (optionConfig.qCountType === 'default') count = 20;
            
            examQuestions = allQuestions.slice(0, count);

        } catch (error) {
            console.error('問題データの取得エラー:', error);
            alert('問題データの取得に失敗しました。');
            return;
        }
    }

    if (!examQuestions || examQuestions.length === 0) {
        alert('出題する問題が見つかりません。フィルタ設定を見直すか、問題を作成してください。');
        window.location.href = `exam_filter?workbookId=${workbookId}`;
        return;
    }

    examQuestions.forEach(q => {
        userAnswers.push({ id: q.id, answered: false, selectedValues: [], ddAnswers: {}, flagged: false, isFavorite: false, timeSpent: 0 });
    });

    timeoutAction = optionConfig.timeoutAction;
    remainingSeconds = optionConfig.timeLimitMinutes > 0 ? optionConfig.timeLimitMinutes * 60 : 0;
    
    startTimer();
    showQuestion(0);
}

function restoreExam(data) {
    examQuestions = data.examQuestions;
    userAnswers = data.userAnswers;
    currentIndex = data.currentIndex;
    remainingSeconds = data.remainingSeconds;
    timeoutAction = data.timeoutAction;
    globalMemo = data.globalMemo || ""; 
    startTimer();
    showQuestion(currentIndex);
}

function saveProgress() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ examQuestions, userAnswers, currentIndex, remainingSeconds, timeoutAction, globalMemo }));
    const ind = document.getElementById('save-indicator');
    ind.style.opacity = '1';
    setTimeout(() => { ind.style.opacity = '0'; }, 1000);
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (remainingSeconds > 0) remainingSeconds--;
        updateTimerDisplay();
        if (userAnswers[currentIndex]) userAnswers[currentIndex].timeSpent += 1;
        if (remainingSeconds % 5 === 0) saveProgress();
        if (remainingSeconds === 60) document.getElementById('timer-display').classList.add('timer-warning');
        if (remainingSeconds <= 0 && timeoutAction === 'force_end') {
            clearInterval(timerInterval);
            document.getElementById('timer-display').innerText = '⏳ 00:00:00';
            alert('時間切れです！模試を強制終了します。');
            executeFinishExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    if (remainingSeconds <= 0 && timeoutAction !== 'force_end') {
        document.getElementById('timer-display').innerText = '⏳ 無制限';
        return;
    }
    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    const s = remainingSeconds % 60;
    const formatted = h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('timer-display').innerText = `⏳ ${formatted}`;
}

function showQuestion(index) {
    if (index < 0 || index >= examQuestions.length) return;
    currentIndex = index;
    const q = examQuestions[index];
    const ans = userAnswers[index];

    document.getElementById('progress-text').innerText = `問 ${index + 1} / ${examQuestions.length}`;
    document.getElementById('q-no-badge').innerText = `第 ${index + 1} 問`;
    document.getElementById('q-id-badge').innerText = `ID: ${q.id}`;
    document.getElementById('q-text').style.whiteSpace = 'pre-wrap';
    document.getElementById('q-text').innerText = q.question;
    
    const imgEl = document.getElementById('q-image');
    if (q.questionImageUrl) {
        imgEl.src = q.questionImageUrl;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    const flagInd = document.getElementById('q-flag-indicator');
    const favInd = document.getElementById('q-fav-indicator');
    flagInd.style.display = ans.flagged ? 'inline-block' : 'none';
    favInd.style.display = ans.isFavorite ? 'inline-block' : 'none';

    document.getElementById('btn-flag').innerText = ans.flagged ? '🚩 フラグ外す' : '🚩 フラグ';
    document.getElementById('btn-fav').innerText = ans.isFavorite ? '⭐ お気に入り済' : '⭐ お気に入り';

    document.getElementById('btn-prev-side').disabled = (index === 0);
    document.getElementById('btn-prev-bottom').disabled = (index === 0);
    document.getElementById('btn-next-side').disabled = (index === examQuestions.length - 1);
    document.getElementById('btn-next-bottom').disabled = (index === examQuestions.length - 1);

    const playArea = document.getElementById('play-area');
    playArea.innerHTML = '';

    if (q.format === 'mcq') renderMcqForExam(q, ans, playArea);
    else if (q.format === 'dd') renderDdForExam(q, ans, playArea);
    
    saveProgress(); 
}

function renderMcqForExam(q, ans, playArea) {
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

    const correctVals = getCorrectValues(q);
    const inputType = correctVals.length > 1 ? 'checkbox' : 'radio';
    if (correctVals.length > 1) {
        playArea.insertAdjacentHTML('beforeend', `<p style="font-weight: bold; color: var(--primary); margin-bottom: 10px;">※複数選択問題です</p>`);
    }

    let userVals = ans.selectedValues || (ans.selectedValue ? [ans.selectedValue] : []);

    let html = `<div class="mcq-options" style="display: flex; flex-direction: column; gap: 12px;">`;
    choices.forEach(c => {
        const isChecked = userVals.includes(c.id) ? 'checked' : '';
        const bgStyle = isChecked ? 'background-color: rgba(59, 130, 246, 0.05); border-color: var(--primary);' : 'background-color: var(--bg-card); border-color: var(--border);';
        const safeText = c.text.toString().replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
            <label class="mcq-label" style="display: flex; align-items: center; padding: 15px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s; ${bgStyle}">
                <input type="${inputType}" name="mcq-answer" value="${c.id}" ${isChecked} style="margin-right: 15px; transform: scale(1.3); cursor: pointer;">
                <span style="font-size: 1.1em; line-height: 1.4; white-space: pre-wrap;">${safeText}</span>
            </label>
        `;
    });
    html += `</div>`;
    playArea.innerHTML = html;

    const inputs = playArea.querySelectorAll('input[name="mcq-answer"]');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            const checkedInputs = Array.from(playArea.querySelectorAll('input:checked'));
            ans.selectedValues = checkedInputs.map(el => parseInt(el.value));
            ans.answered = ans.selectedValues.length > 0;

            playArea.querySelectorAll('.mcq-label').forEach(label => {
                const inp = label.querySelector('input');
                if (inp.checked) {
                    label.style.borderColor = 'var(--primary)';
                    label.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                } else {
                    label.style.borderColor = 'var(--border)';
                    label.style.backgroundColor = 'var(--bg-card)';
                }
            });
            saveProgress(); 
        });
    });
}

function renderDdForExam(q, ans, playArea) {
    if (!ans.ddAnswers) ans.ddAnswers = {};

    let html = `
        <div style="margin-bottom: 20px;">
            <p style="font-weight: bold; margin-bottom: 10px; color: var(--text-main);">👇 アイテムをドラッグして、正しい箱にドロップしてください。</p>
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
        let itemHtml = `<div id="drag-item-${index}" class="dd-drag-item" draggable="true" data-original-idx="${index}" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 10px 15px; cursor: grab; box-shadow: 0 2px 4px rgba(0,0,0,0.05); user-select: none;">`;
        if (item.imageUrl) itemHtml += `<img src="${item.imageUrl}" style="max-height: 50px; display: block; margin-bottom: 5px;">`;
        const safeText = text.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        itemHtml += `<span style="white-space: pre-wrap;">${safeText}</span></div>`;
        
        const savedZoneIdx = ans.ddAnswers[index] !== undefined ? ans.ddAnswers[index] : -1;
        let targetZone = sourceArea;
        if (savedZoneIdx !== -1) {
            const z = playArea.querySelector(`.dd-drop-zone[data-zone-index="${savedZoneIdx}"]`);
            if (z) targetZone = z;
        }
        targetZone.insertAdjacentHTML('beforeend', itemHtml);
    });

    setupDragAndDropForExam(ans, playArea);
}

function setupDragAndDropForExam(ans, playArea) {
    const draggables = playArea.querySelectorAll('.dd-drag-item');
    const dropZones = playArea.querySelectorAll('.dd-drop-zone');
    let selectedItem = null;

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            draggable.classList.add('dragging');
            e.dataTransfer.setData('text/plain', draggable.id);
            draggable.style.opacity = '0.5';
        });
        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
            draggable.style.opacity = '1';
        });
        draggable.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (selectedItem) {
                selectedItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                selectedItem.style.borderColor = 'var(--border)';
            }
            if (selectedItem === draggable) { selectedItem = null; return; }
            selectedItem = draggable;
            selectedItem.style.boxShadow = '0 0 0 3px var(--primary)';
            selectedItem.style.borderColor = 'var(--primary)';
        });
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        });
        zone.addEventListener('dragleave', () => { zone.style.backgroundColor = 'transparent'; });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.backgroundColor = 'transparent';
            const id = e.dataTransfer.getData('text/plain');
            const draggable = document.getElementById(id);
            if (draggable) {
                zone.appendChild(draggable);
                updateDdAnswer(draggable, zone, ans);
            }
        });
        zone.addEventListener('click', () => {
            if (selectedItem) {
                zone.appendChild(selectedItem);
                updateDdAnswer(selectedItem, zone, ans);
                selectedItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                selectedItem.style.borderColor = 'var(--border)';
                selectedItem = null;
            }
        });
    });
}

function updateDdAnswer(itemElem, zoneElem, ans) {
    const itemIdx = parseInt(itemElem.getAttribute('data-original-idx'));
    const zoneIdx = parseInt(zoneElem.getAttribute('data-zone-index'));
    if (!ans.ddAnswers) ans.ddAnswers = {};
    ans.ddAnswers[itemIdx] = zoneIdx;
    ans.answered = Object.values(ans.ddAnswers).some(z => z !== -1);
    saveProgress();
}

function nextQuestion() { if (currentIndex < examQuestions.length - 1) showQuestion(currentIndex + 1); }
function prevQuestion() { if (currentIndex > 0) showQuestion(currentIndex - 1); }
function toggleFlag() { userAnswers[currentIndex].flagged = !userAnswers[currentIndex].flagged; showQuestion(currentIndex); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openQuitModal() { document.getElementById('quit-modal').classList.remove('hidden'); }
function suspendExam() { saveProgress(); window.location.href = `player_menu?workbookId=${workbookId}`; }
function discardExam() { localStorage.removeItem(SAVE_KEY); window.location.href = `player_menu?workbookId=${workbookId}`; }

function showExamListModal() {
    const container = document.getElementById('list-container');
    container.innerHTML = '';
    examQuestions.forEach((q, i) => {
        const ans = userAnswers[i];
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.style.marginBottom = '8px';
        btn.innerText = `問${i + 1} - ${ans.answered ? '✅ 解答済' : '⬜ 未解答'}${ans.flagged ? ' 🚩' : ''}${ans.isFavorite ? ' ⭐' : ''}`;
        btn.onclick = () => { showQuestion(i); closeModal('list-modal'); };
        container.appendChild(btn);
    });
    document.getElementById('list-modal').classList.remove('hidden');
}

function finishExam() {
    const unansweredCount = userAnswers.filter(ans => !ans.answered).length;
    let confirmMsg = '模試を終了して全体の採点を行います。よろしいですか？';
    if (unansweredCount > 0) {
        confirmMsg = `⚠️ 未解答の問題が ${unansweredCount} 問あります！\n（未選択でも提出可能です）\n本当に終了して採点してもよろしいですか？`;
    }
    if (confirm(confirmMsg)) executeFinishExam();
}

function executeFinishExam() {
    clearInterval(timerInterval);
    localStorage.removeItem(SAVE_KEY);
    sessionStorage.removeItem('examRevengeMode');
    
    const resultData = { questions: examQuestions, answers: userAnswers };
    sessionStorage.setItem('examResults', JSON.stringify(resultData));
    window.location.href = `exam_result?workbookId=${workbookId}`;
}

function openMemoModal() {
    const textarea = document.getElementById('exam-memo-text');
    textarea.value = globalMemo;
    document.getElementById('memo-modal').classList.remove('hidden');
    textarea.focus();
}
function closeMemoModal() {
    const textarea = document.getElementById('exam-memo-text');
    globalMemo = textarea.value;
    saveProgress();
    document.getElementById('memo-modal').classList.add('hidden');
}

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
        container.innerHTML = '<p style="color: var(--text-sub);">タグが作成されていません。上のフォームから作成してください。</p>';
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
    const q = examQuestions[currentIndex];
    const checkedBoxes = document.querySelectorAll('input[name="quiz-active-tags"]:checked');
    const newTagIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    questionTags[`${q.format}_${q.id}`] = newTagIds;
    localStorage.setItem(`question_tags_${workbookId}`, JSON.stringify(questionTags));
    document.getElementById('quiz-tag-modal').classList.add('hidden');

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

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { closeAllModals(); if (document.activeElement) document.activeElement.blur(); return; }
    if (e.key === '?') { document.getElementById('shortcut-help-modal').classList.remove('hidden'); return; }
    if (document.querySelectorAll('.modal:not(.hidden)').length > 0) return;

    switch (e.key.toLowerCase()) {
        case 'arrowright': nextQuestion(); break;
        case 'arrowleft': prevQuestion(); break;
        case 'arrowup': e.preventDefault(); moveOptionFocus(-1); break;
        case 'arrowdown': e.preventDefault(); moveOptionFocus(1); break;
        case 'a':
        case ' ': if (typeof submitAnswer === 'function') { e.preventDefault(); submitAnswer(); } break;
        case 'f': toggleFlag(); break;
        case 'r': if (typeof toggleShuffle === 'function') toggleShuffle(); break;
        case 's': e.preventDefault(); openQuizTagModal(); break;
        case 'l': showExamListModal(); break;
        case 'm': e.preventDefault(); openMemoModal(); break;
        case 'b': suspendExam(); break;
        case 't': toggleTheme(); break;
    }
    if (e.key >= '0' && e.key <= '9') {
        let num = parseInt(e.key);
        if (num === 0) num = 10;
        selectOptionDirectly(num);
    }
});

function moveOptionFocus(direction) {
    const labels = document.querySelectorAll('.mcq-label');
    if (labels.length === 0) return;
    let currentIndex = -1;
    labels.forEach((label, index) => { if (label.querySelector('input').checked) currentIndex = index; });
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = labels.length - 1;
    if (nextIndex >= labels.length) nextIndex = 0;
    labels[nextIndex].querySelector('input').click();
}
function selectOptionDirectly(num) {
    const labels = document.querySelectorAll('.mcq-label');
    if (num > 0 && num <= labels.length) labels[num - 1].querySelector('input').click();
}