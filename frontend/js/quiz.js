// quiz.js
let originalQuestions = []; 
let currentQuestions = [];  
let currentIndex = 0;
let currentWorkbookId = new URLSearchParams(window.location.search).get('workbookId');

let userTags = [];
let questionTags = {};
let historyMap = {};
let categoryMaster = [];

const targetUserId = new URLSearchParams(window.location.search).get('targetUserId');
const targetUserName = new URLSearchParams(window.location.search).get('targetUserName');
const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === 'true' || new URLSearchParams(window.location.search).get('mode') === 'preview';

const isReadOnlyMode = !!targetUserId || isPreviewMode;

// ★ 追加：遷移用の共通パラメータ文字列を生成する関数
function getExtraParams() {
    let extra = '';
    if (targetUserId) extra += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreviewMode) extra += `&preview=true`;
    return extra;
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    if (!currentWorkbookId) { alert('問題集が指定されていません。'); return; }

    try {
        let historyUrl = `${API_BASE_URL}/answer-history/summary?workbookId=${currentWorkbookId}`;
        if (targetUserId) historyUrl += `&targetUserId=${targetUserId}`;

        let tagsUrl = `${API_BASE_URL}/tags?workbookId=${currentWorkbookId}`;
        if (targetUserId) tagsUrl += `&targetUserId=${targetUserId}`;

        const [resMcq, resDd, resHistory, resTags, resCat] = await Promise.all([
            fetch(`${API_BASE_URL}/questions/player?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/dd-questions?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(historyUrl, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(tagsUrl, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/categories?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false}))
        ]);
        
        const mcqData = resMcq.ok ? await resMcq.json() : [];
        const ddData = resDd.ok ? await resDd.json() : [];
        
        if (resHistory.ok) {
            const histories = await resHistory.json();
            histories.forEach(h => { historyMap[h.questionFormat + '_' + h.questionId] = JSON.parse(h.historyJson); });
        }

        if (resTags.ok) {
            const tagData = await resTags.json();
            userTags = tagData.tags || [];
            questionTags = tagData.questionTags || {};
            localStorage.setItem(`user_tags_${currentWorkbookId}`, JSON.stringify(userTags));
            localStorage.setItem(`question_tags_${currentWorkbookId}`, JSON.stringify(questionTags));
        } else {
            userTags = JSON.parse(localStorage.getItem(`user_tags_${currentWorkbookId}`)) || [];
            questionTags = JSON.parse(localStorage.getItem(`question_tags_${currentWorkbookId}`)) || {};
        }

        if (resCat.ok) {
            categoryMaster = await resCat.json();
        }

        const mappedMcq = mcqData.map(q => ({ ...q, format: 'mcq' }));
        const mappedDd = ddData.map(q => ({ ...q, format: 'dd' }));

        originalQuestions = [...mappedMcq, ...mappedDd].sort((a, b) => {
            const catA1 = a.categoryMajorId || 999999;
            const catB1 = b.categoryMajorId || 999999;
            if (catA1 !== catB1) return catA1 - catB1;
            const catA2 = a.categoryMediumId || 999999;
            const catB2 = b.categoryMediumId || 999999;
            if (catA2 !== catB2) return catA2 - catB2;
            const catA3 = a.categoryMinorId || 999999;
            const catB3 = b.categoryMinorId || 999999;
            if (catA3 !== catB3) return catA3 - catB3;
            return a.id - b.id;
        });

        const mode = new URLSearchParams(window.location.search).get('mode');
        if (mode === 'favorite') {
            const selectedTagIds = JSON.parse(sessionStorage.getItem('favoriteSelectedTags') || '[]');
            currentQuestions = originalQuestions.filter(q => {
                const tagsForThisQ = questionTags[`${q.format}_${q.id}`] || [];
                return selectedTagIds.some(id => tagsForThisQ.includes(id));
            });
            if (currentQuestions.length === 0) {
                alert('選択したタグが付いている問題が見つかりませんでした。\nタグ管理画面に戻ります。');
                // ★ 修正：遷移時にパラメータを引き継ぐ
                window.location.href = `favorite_filter?workbookId=${currentWorkbookId}` + getExtraParams();
                return;
            }
        } 
        else if (mode === 'weakness') {
            const weaknessKeys = JSON.parse(sessionStorage.getItem('weaknessQuestionKeys') || '[]');
            currentQuestions = originalQuestions.filter(q => weaknessKeys.includes(`${q.format}_${q.id}`));
            if (currentQuestions.length === 0) {
                alert('弱点問題が見つかりませんでした。成績画面に戻ります。');
                // ★ 修正：遷移時にパラメータを引き継ぐ
                window.location.href = `player_stats?workbookId=${currentWorkbookId}` + getExtraParams();
                return;
            }
        } else {
            currentQuestions = [...originalQuestions];
        }

        if (currentQuestions.length === 0) { alert('問題がありません。'); return; }
        showQuestion(0);
    } catch (e) {
        console.error(e);
        alert('データの読み込みに失敗しました。');
    }
});

function getCategoryName(catId) {
    if (!catId) return '未分類';
    const cat = categoryMaster.find(c => c.id === catId);
    return cat ? cat.name : `不明 (ID:${catId})`;
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
    if (index < 0 || index >= currentQuestions.length) return;
    currentIndex = index;
    const q = currentQuestions[index];

    document.getElementById('progress-text').innerText = `${index + 1} / ${currentQuestions.length}`;
    document.getElementById('q-id-badge').innerText = `ID: ${q.id} (${q.format === 'mcq' ? '四択' : 'D&D'})`;
    
    document.getElementById('q-category-badge').innerText = q.categoryMajorId ? `📁 ${getCategoryName(q.categoryMajorId)}` : '未分類';
    
    document.getElementById('q-text').innerText = q.question;
    
    const hist = historyMap[`${q.format}_${q.id}`] || [];
    const histBadge = document.getElementById('q-history-badge');
    if (hist.length > 0) {
        const marks = hist.map(val => val ? '⭕' : '❌').join('');
        histBadge.innerText = `過去5回: ${marks}`;
    } else {
        histBadge.innerText = `過去5回: 未挑戦`;
    }
    histBadge.style.display = 'inline-block';

    const imgEl = document.getElementById('q-image');
    if (q.questionImageUrl) {
        imgEl.src = q.questionImageUrl;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    const isFirst = (index === 0);
    const isLast = (index === currentQuestions.length - 1);
    document.getElementById('btn-prev-side').disabled = isFirst;
    document.getElementById('btn-prev-bottom').disabled = isFirst;
    document.getElementById('btn-next-side').disabled = isLast;
    document.getElementById('btn-next-bottom').disabled = isLast;

    document.getElementById('explanation-area').classList.add('hidden');
    document.getElementById('btn-submit').disabled = false;
    const playArea = document.getElementById('play-area');
    playArea.innerHTML = '';

    if (q.format === 'mcq') renderMcqPlayer(q, playArea);
    else if (q.format === 'dd') renderDdPlayer(q, playArea);
}

function renderMcqPlayer(q, playArea) {
    const choices = [];
    const arrayData = q.choices || q.options || q.items || null;
    if (Array.isArray(arrayData)) {
        arrayData.forEach((c, index) => {
            const text = typeof c === 'object' ? (c.text || c.content || c.name || '') : c;
            if (text) choices.push({ id: index + 1, text: text });
        });
    } else {
        let i = 1;
        while (q[`choice${i}`] || q[`option${i}`] || q[`selection${i}`]) {
            choices.push({ id: i, text: q[`choice${i}`] || q[`option${i}`] || q[`selection${i}`] });
            i++;
        }
    }
    if (choices.length === 0) { playArea.innerHTML = `<p style="color: var(--danger);">選択肢のデータが見つかりません。</p>`; return; }
    for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    const correctVals = getCorrectValues(q);
    const inputType = correctVals.length > 1 ? 'checkbox' : 'radio';
    if (correctVals.length > 1) {
        playArea.insertAdjacentHTML('beforeend', `<p style="font-weight: bold; color: var(--primary); margin-bottom: 10px;">※複数選択問題です</p>`);
    }

    let html = `<div class="mcq-options" style="display: flex; flex-direction: column; gap: 12px;">`;
    choices.forEach(c => {
        const safeText = c.text.toString().replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `
            <label class="mcq-label" style="display: flex; align-items: center; padding: 15px; border: 2px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: var(--bg-card);">
                <input type="${inputType}" name="mcq-answer" value="${c.id}" style="margin-right: 15px; transform: scale(1.3); cursor: pointer;">
                <span style="font-size: 1.1em; line-height: 1.4;">${safeText}</span>
            </label>
        `;
    });
    html += `</div>`;
    playArea.innerHTML = html;

    const inputs = playArea.querySelectorAll('input[name="mcq-answer"]');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            if (document.getElementById('btn-submit').disabled) return;
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
        });
    });
}

function nextQuestion() { if (currentIndex < currentQuestions.length - 1) showQuestion(currentIndex + 1); }
function prevQuestion() { if (currentIndex > 0) showQuestion(currentIndex - 1); }

function submitAnswer() {
    const q = currentQuestions[currentIndex];
    const expArea = document.getElementById('explanation-area');
    if (!expArea.classList.contains('hidden')) return;

    let isCorrect = false;

    if (q.format === 'mcq') {
        const userVals = Array.from(document.querySelectorAll('input[name="mcq-answer"]:checked')).map(el => parseInt(el.value));
        const correctVals = getCorrectValues(q);
        isCorrect = (userVals.length === correctVals.length) && userVals.every(v => correctVals.includes(v));

        const labels = document.querySelectorAll('.mcq-label');
        labels.forEach(label => {
            const input = label.querySelector('input');
            input.disabled = true;
            label.style.cursor = 'default';
            const val = parseInt(input.value);
            const isUserChecked = input.checked;
            const isThisCorrect = correctVals.includes(val);

            if (isThisCorrect) {
                label.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; 
                label.style.borderColor = 'var(--success)';
            } else if (isUserChecked && !isThisCorrect) {
                label.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; 
                label.style.borderColor = 'var(--danger)';
            }
        });
    } else if (q.format === 'dd') {
        let allCorrect = true; 
        const dropZones = document.querySelectorAll('.dd-drop-zone');
        dropZones.forEach(zone => {
            const zoneIndex = parseInt(zone.getAttribute('data-zone-index'));
            const items = zone.querySelectorAll('.dd-drag-item');
            items.forEach(item => {
                const correctZone = parseInt(item.getAttribute('data-correct-zone'));
                item.setAttribute('draggable', 'false');
                item.style.cursor = 'default';
                item.style.borderWidth = '2px';
                if (correctZone === zoneIndex) {
                    item.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                    item.style.borderColor = 'var(--success)';
                } else {
                    item.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    item.style.borderColor = 'var(--danger)';
                    allCorrect = false;
                }
            });
        });
        isCorrect = allCorrect; 
    }

    document.getElementById('btn-submit').disabled = true;

    const resTitle = document.getElementById('result-title');
    resTitle.innerText = isCorrect ? '⭕ 正解！' : '❌ 不正解...';
    resTitle.style.color = isCorrect ? 'var(--success)' : 'var(--danger)';
    
    saveAndSubmitSingleHistory(q.id, q.format, isCorrect);
    
    document.getElementById('exp-text').innerText = q.explanation || '解説はありません。';
    const expImg = document.getElementById('exp-image');
    if (q.explanationImageUrl) {
        expImg.src = q.explanationImageUrl;
        expImg.classList.remove('hidden');
    } else {
        expImg.classList.add('hidden');
    }
    
    expArea.classList.remove('hidden');
    expArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveAndSubmitSingleHistory(questionId, format, isCorrect) {
    if (isReadOnlyMode) {
        console.log('プレビューまたはレビューモードのため、解答履歴は保存されません。');
        return;
    }

    const key = `${format}_${questionId}`;
    if (!historyMap[key]) historyMap[key] = [];
    historyMap[key].push(isCorrect);
    if (historyMap[key].length > 5) historyMap[key].shift();
    
    const histBadge = document.getElementById('q-history-badge');
    const marks = historyMap[key].map(val => val ? '⭕' : '❌').join('');
    histBadge.innerText = `過去5回: ${marks}`;

    const payload = [{ workbookId: parseInt(currentWorkbookId), questionId: questionId, format: format, correct: isCorrect }];
    try {
        await fetch(`${API_BASE_URL}/answer-history/submit`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.warn('🔌 履歴の送信に失敗しました:', e);
    }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showListModal() {
    const container = document.getElementById('list-container');
    container.innerHTML = '';
    
    const tree = {};
    
    currentQuestions.forEach(q => {
        const majorId = q.categoryMajorId || 'unclassified';
        if (!tree[majorId]) tree[majorId] = { items: [], subs: {} };
        
        if (!q.categoryMediumId) {
            tree[majorId].items.push(q);
        } else {
            const mediumId = q.categoryMediumId;
            if (!tree[majorId].subs[mediumId]) tree[majorId].subs[mediumId] = { items: [], subs: {} };
            
            if (!q.categoryMinorId) {
                tree[majorId].subs[mediumId].items.push(q);
            } else {
                const minorId = q.categoryMinorId;
                if (!tree[majorId].subs[mediumId].subs[minorId]) tree[majorId].subs[mediumId].subs[minorId] = { items: [] };
                tree[majorId].subs[mediumId].subs[minorId].items.push(q);
            }
        }
    });

    function buildItemsHtml(itemsArray) {
        if (!itemsArray || itemsArray.length === 0) return '';
        let html = '<div style="margin-top: 5px; display: flex; flex-direction: column; gap: 6px;">';
        itemsArray.forEach(q => {
            const hist = historyMap[`${q.format}_${q.id}`] || [];
            let mark = '⬜'; 
            let borderColor = 'var(--border)';
            if (hist.length > 0) {
                if (hist[hist.length - 1]) { mark = '⭕'; borderColor = 'var(--success)'; } 
                else { mark = '❌'; borderColor = 'var(--danger)'; }
            }
            const snippet = q.question.length > 25 ? q.question.substring(0, 25) + '...' : q.question;
            
            html += `<button class="action-btn" style="width: 100%; text-align: left; padding: 6px 10px; font-size: 0.9em; font-weight: normal; border-left: 4px solid ${borderColor}; background: var(--bg-main);" onclick="jumpToQuestion('${q.format}', ${q.id})">
                ${mark} ID:${q.id} ${snippet}
            </button>`;
        });
        html += '</div>';
        return html;
    }

    let finalHtml = '';

    for (const majorId in tree) {
        const majorName = majorId === 'unclassified' ? '未分類 (カテゴリなし)' : getCategoryName(parseInt(majorId));
        const majorNode = tree[majorId];
        
        finalHtml += `
        <details style="margin-bottom: 10px; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px solid var(--border);">
            <summary style="padding: 10px; font-weight: bold; cursor: pointer; outline: none; font-size: 1.05em;">📁 ${majorName}</summary>
            <div style="padding: 10px; padding-top: 0; margin-left: 10px;">
                ${buildItemsHtml(majorNode.items)}
        `;

        for (const mediumId in majorNode.subs) {
            const mediumName = getCategoryName(parseInt(mediumId));
            const mediumNode = majorNode.subs[mediumId];
            
            finalHtml += `
            <details style="margin-top: 8px; border-left: 2px dashed var(--border); padding-left: 10px;">
                <summary style="padding: 5px; font-weight: bold; cursor: pointer; outline: none; color: var(--text-main);">📂 ${mediumName}</summary>
                <div style="padding-bottom: 5px;">
                    ${buildItemsHtml(mediumNode.items)}
            `;

            for (const minorId in mediumNode.subs) {
                const minorName = getCategoryName(parseInt(minorId));
                const minorNode = mediumNode.subs[minorId];
                
                finalHtml += `
                <details style="margin-top: 5px; border-left: 2px dashed var(--border); padding-left: 10px;">
                    <summary style="padding: 5px; font-weight: bold; cursor: pointer; outline: none; color: var(--text-sub);">📄 ${minorName}</summary>
                    <div style="padding-bottom: 5px;">
                        ${buildItemsHtml(minorNode.items)}
                    </div>
                </details>
                `;
            }
            finalHtml += `</div></details>`;
        }
        finalHtml += `</div></details>`;
    }

    container.innerHTML = finalHtml;
    document.getElementById('list-modal').classList.remove('hidden');
}

window.jumpToQuestion = function(format, id) {
    const targetIndex = currentQuestions.findIndex(cq => cq.id === id && cq.format === format);
    if (targetIndex !== -1) {
        showQuestion(targetIndex);
        closeModal('list-modal');
    }
};

let isShuffled = false; 
function toggleShuffle() {
    const btn = document.getElementById('btn-shuffle');
    if (!isShuffled) {
        if (confirm('問題をランダムに並び替えて最初から開始しますか？')) {
            for (let i = currentQuestions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentQuestions[i], currentQuestions[j]] = [currentQuestions[j], currentQuestions[i]];
            }
            isShuffled = true;
            btn.innerHTML = '⬇️ 元に戻す';
            btn.style.backgroundColor = 'var(--border)'; 
            showQuestion(0);
        }
    } else {
        if (confirm('元の出題順（カテゴリ・ID順）に戻して最初から開始しますか？')) {
            currentQuestions = [...originalQuestions];
            const mode = new URLSearchParams(window.location.search).get('mode');
            if (mode === 'favorite') {
                const selectedTagIds = JSON.parse(sessionStorage.getItem('favoriteSelectedTags') || '[]');
                currentQuestions = currentQuestions.filter(q => {
                    const tagsForThisQ = questionTags[`${q.format}_${q.id}`] || [];
                    return selectedTagIds.some(id => tagsForThisQ.includes(id));
                });
            } else if (mode === 'weakness') {
                const weaknessKeys = JSON.parse(sessionStorage.getItem('weaknessQuestionKeys') || '[]');
                currentQuestions = currentQuestions.filter(q => weaknessKeys.includes(`${q.format}_${q.id}`));
            }
            isShuffled = false;
            btn.innerHTML = '🔀 ランダム';
            btn.style.backgroundColor = 'var(--bg-main)'; 
            showQuestion(0);
        }
    }
}

function renderDdPlayer(q, playArea) {
    let html = `
        <div style="margin-bottom: 20px;">
            <p style="font-weight: bold; margin-bottom: 10px; color: var(--text-main);">👇 アイテムをドラッグして、正しい箱にドロップしてください。</p>
            <div id="dd-source-area" class="dd-drop-zone" data-zone-index="-1" style="min-height: 80px; padding: 15px; background: var(--bg-main); border: 2px dashed var(--border); border-radius: 8px; display: flex; flex-wrap: wrap; gap: 10px;">
            </div>
        </div>
        <div id="dd-zones-area" style="display: flex; flex-wrap: wrap; gap: 20px;"></div>
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
    let shuffledItems = [...items];
    for (let i = shuffledItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
    }

    shuffledItems.forEach((item, index) => {
        const correctZone = (item.correctZoneIndex !== undefined && item.correctZoneIndex !== null) ? item.correctZoneIndex : -1;
        const text = item.text || item.content || item.name || '';
        let itemHtml = `<div id="drag-item-${index}" class="dd-drag-item" draggable="true" data-correct-zone="${correctZone}" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 10px 15px; cursor: grab; box-shadow: 0 2px 4px rgba(0,0,0,0.05); user-select: none;">`;
        if (item.imageUrl) itemHtml += `<img src="${item.imageUrl}" style="max-height: 50px; display: block; margin-bottom: 5px;">`;
        itemHtml += `<span>${text}</span></div>`;
        sourceArea.insertAdjacentHTML('beforeend', itemHtml);
    });
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.dd-drag-item');
    const dropZones = document.querySelectorAll('.dd-drop-zone');
    let selectedItem = null;

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            if (document.getElementById('btn-submit').disabled) { e.preventDefault(); return; }
            draggable.classList.add('dragging');
            e.dataTransfer.setData('text/plain', draggable.id);
            draggable.style.opacity = '0.5';
        });
        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
            draggable.style.opacity = '1';
        });
        draggable.addEventListener('click', (e) => {
            if (document.getElementById('btn-submit').disabled) return;
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
            if (document.getElementById('btn-submit').disabled) return;
            zone.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        });
        zone.addEventListener('dragleave', () => { zone.style.backgroundColor = 'transparent'; });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (document.getElementById('btn-submit').disabled) return;
            zone.style.backgroundColor = 'transparent';
            const id = e.dataTransfer.getData('text/plain');
            const draggable = document.getElementById(id);
            if (draggable) zone.appendChild(draggable);
        });
        zone.addEventListener('click', () => {
            if (document.getElementById('btn-submit').disabled) return;
            if (selectedItem) {
                zone.appendChild(selectedItem);
                selectedItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                selectedItem.style.borderColor = 'var(--border)';
                selectedItem = null;
            }
        });
    });
}

function openQuizTagModal() {
    document.getElementById('quiz-new-tag-input').value = ''; 
    renderQuizTagCheckboxes(); 
    document.getElementById('quiz-tag-modal').classList.remove('hidden');
}

function renderQuizTagCheckboxes(preserveChecked = false) {
    const q = currentQuestions[currentIndex];
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
            body: JSON.stringify({ workbookId: parseInt(currentWorkbookId), name: name })
        });
        
        if (res.ok) {
            const newTag = await res.json();
            userTags.push(newTag);
            
            const q = currentQuestions[currentIndex];
            const checkedBoxes = document.querySelectorAll('input[name="quiz-active-tags"]:checked');
            const activeIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
            activeIds.push(newTag.id);
            questionTags[`${q.format}_${q.id}`] = activeIds;
            
            localStorage.setItem(`user_tags_${currentWorkbookId}`, JSON.stringify(userTags));
            renderQuizTagCheckboxes(false);
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

    const q = currentQuestions[currentIndex];
    const checkedBoxes = document.querySelectorAll('input[name="quiz-active-tags"]:checked');
    const newTagIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    questionTags[`${q.format}_${q.id}`] = newTagIds;
    localStorage.setItem(`question_tags_${currentWorkbookId}`, JSON.stringify(questionTags));
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

// ★ 追加：HTML側にボタンがあれば呼ばれる戻る処理
function goBack() {
    window.location.href = `player_menu?workbookId=${currentWorkbookId}` + getExtraParams();
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { closeAllModals(); return; }
    if (e.key === '?') { document.getElementById('shortcut-help-modal').classList.remove('hidden'); return; }
    if (document.querySelectorAll('.modal:not(.hidden)').length > 0) return;

    switch (e.key.toLowerCase()) {
        case 'arrowright': nextQuestion(); break;
        case 'arrowleft': prevQuestion(); break;
        case 'arrowup': e.preventDefault(); moveOptionFocus(-1); break;
        case 'arrowdown': e.preventDefault(); moveOptionFocus(1); break;
        case 'a':
        case ' ': e.preventDefault(); submitAnswer(); break;
        case 'f': if (typeof toggleFlag === 'function') toggleFlag(); break;
        case 'r': toggleShuffle(); break;
        case 's': openQuizTagModal(); break;
        case 'l': showListModal(); break;
        // ★ 修正：戻る際にもパラメータを引き継ぐ
        case 'b': goBack(); break;
        case 't': toggleTheme(); break;
    }
    if (e.key >= '0' && e.key <= '9') {
        let num = parseInt(e.key);
        if (num === 0) num = 10; 
        selectOptionDirectly(num);
    }
});

function moveOptionFocus(direction) {
    if (document.getElementById('btn-submit').disabled) return; 
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
    if (document.getElementById('btn-submit').disabled) return;
    const labels = document.querySelectorAll('.mcq-label');
    if (num > 0 && num <= labels.length) labels[num - 1].querySelector('input').click();
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
}