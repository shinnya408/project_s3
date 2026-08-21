// question_editor.js
if (localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
}

let currentWorkbookId = null;
let currentQuestions = []; 
let currentCategories = []; 

// ==========================================
// カテゴリの完全同期機能
// ==========================================
function updateDatalists() {
    const selects = document.querySelectorAll('.category-select');
    selects.forEach(select => {
        const currentVal = select.value; 
        
        const firstOption = select.options.length > 0 ? select.options[0] : new Option("未設定", "");
        if (firstOption.value !== "") {
            firstOption.value = "";
            firstOption.textContent = "未設定";
        }
        
        select.innerHTML = '';
        select.appendChild(firstOption);

        currentCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id; 
            opt.textContent = cat.name; 
            select.appendChild(opt);
        });
        
        select.value = currentVal; 
    });
}

async function loadCategories() {
    if (!currentWorkbookId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/categories?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() });
        if (res.ok) {
            currentCategories = await res.json();
            updateDatalists();
            renderCategoryManager();
        }
    } catch (e) {
        console.error("カテゴリ取得エラー:", e);
    }
}

function renderCategoryManager() {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (currentCategories.length === 0) {
        container.innerHTML = '<p style="color: var(--format-text);">カテゴリが登録されていません。</p>';
    }

    currentCategories.forEach((cat) => {
        addCategoryUI(cat.name, cat.id);
    });
}

function addCategoryUI(name = '', catId = null) {
    const container = document.getElementById('category-list-container');
    if (container.querySelector('p')) container.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'option-item category-row';
    div.dataset.id = catId || ''; 
    div.innerHTML = `
        <span style="font-weight:bold; color:var(--format-text); cursor: grab;" class="drag-handle">↕</span>
        <input type="text" class="cat-name-input" value="${name}" placeholder="カテゴリ名を入力" style="flex:1;">
        <button class="btn btn-outline" onclick="moveCategory(this, -1)">↑</button>
        <button class="btn btn-outline" onclick="moveCategory(this, 1)">↓</button>
        <button class="btn btn-danger" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(div);
}

function moveCategory(btn, direction) {
    const row = btn.parentElement;
    const container = row.parentElement;
    const rows = Array.from(container.children);
    const index = rows.indexOf(row);
    
    if (direction === -1 && index > 0) {
        container.insertBefore(row, rows[index - 1]);
    } else if (direction === 1 && index < rows.length - 1) {
        container.insertBefore(row, rows[index + 2] || null);
    }
}

async function saveCategories() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");

    const rows = document.querySelectorAll('.category-row');
    const newCategories = [];
    
    rows.forEach(row => {
        const idVal = row.dataset.id;
        const nameVal = row.querySelector('.cat-name-input').value.trim();
        if (nameVal) {
            newCategories.push({ 
                id: idVal ? parseInt(idVal) : null,
                name: nameVal 
            });
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/categories/bulk?workbookId=${currentWorkbookId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newCategories)
        });

        if (!response.ok) throw new Error('保存エラー');
        alert('カテゴリを保存しました！');
        loadQuestions(); 
    } catch (e) {
        alert('カテゴリの保存に失敗しました。');
    }
}

// ==========================================
// 初期化と問題集管理
// ==========================================
async function init() {
    try {
        const res = await fetch(`${API_BASE_URL}/workbooks`, { headers: getAuthHeaders() });
        const workbooks = await res.json();
        
        const select = document.getElementById('workbook-select');
        select.innerHTML = '<option value="">-- 選択してください --</option>';
        workbooks.forEach(wb => {
            const opt = document.createElement('option');
            opt.value = wb.id;
            opt.textContent = wb.name;
            opt.dataset.format = wb.format;
            select.appendChild(opt);
        });
    } catch (e) {
        document.getElementById('workbook-select').innerHTML = '<option value="">エラー: APIを起動してください</option>';
    }
}

function showNewWorkbookForm() {
    document.getElementById('new-workbook-form').style.display = 'block';
    document.getElementById('new-workbook-name').value = '';
}
function hideNewWorkbookForm() {
    document.getElementById('new-workbook-form').style.display = 'none';
}

async function saveNewWorkbook() {
    const name = document.getElementById('new-workbook-name').value.trim();
    const format = document.getElementById('new-workbook-format').value;

    if (!name) return alert('問題集の名前を入力してください。');
    
    try {
        const response = await fetch(`${API_BASE_URL}/workbooks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name: name, format: format }) 
        });

        if (!response.ok) throw new Error('保存エラー');
        alert(`「${name}」を作成しました！`);
        hideNewWorkbookForm();
        init();
    } catch (error) {
        alert('問題集の作成に失敗しました。');
    }
}

// ==========================================
// 問題データの読み込みとリスト生成
// ==========================================
async function loadQuestions() {
    const selectEl = document.getElementById('workbook-select');
    currentWorkbookId = selectEl.value;
    
    const examTab = document.getElementById('tab-exam-setting');

    if (!currentWorkbookId) {
        currentQuestions = [];
        currentCategories = [];
        updateDatalists();
        renderCategoryManager();
        if (typeof renderQuestionList === 'function') renderQuestionList();
        if (examTab) examTab.style.display = 'none'; // ★ 未選択時は隠す
        return;
    }

    await loadCategories();

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const format = (selectedOption.dataset.format || '').toUpperCase(); 

    // タブの表示制御を整理
    document.getElementById('tab-mcq-edit').style.display = 'none';
    document.getElementById('tab-mcq-manual').style.display = 'none';
    document.getElementById('tab-mcq-paste').style.display = 'none';
    document.getElementById('tab-dd-edit').style.display = 'none';
    document.getElementById('tab-sim-edit').style.display = 'none';
    if (examTab) examTab.style.display = 'none'; // ★ いったん隠す

    try {
        if (format.includes('SIM') || format === 'SIMULATION') {
            document.getElementById('tab-sim-edit').style.display = 'inline-block';
            
            const res = await fetch(`${API_BASE_URL}/sim-questions?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            const simData = await res.json();
            currentQuestions = simData.map(q => ({ ...q, type: 'sim' }));
            
            prepareNewSim(); 

        } else {
            document.getElementById('tab-mcq-edit').style.display = 'inline-block';
            document.getElementById('tab-mcq-manual').style.display = 'inline-block';
            document.getElementById('tab-mcq-paste').style.display = 'inline-block';
            document.getElementById('tab-dd-edit').style.display = 'inline-block';
            
            // ★ 選択問題・D&D問題の時は模試設定タブを表示する
            if (examTab) examTab.style.display = 'inline-block';
            
            const resMcq = await fetch(`${API_BASE_URL}/questions?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() });
            const mcqData = resMcq.ok ? await resMcq.json() : [];
            
            const resDd = await fetch(`${API_BASE_URL}/dd-questions?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() });
            const ddData = resDd.ok ? await resDd.json() : [];
            
            const mappedMcq = mcqData.map(q => ({ ...q, type: 'mcq' }));
            const mappedDd = ddData.map(q => ({ ...q, type: 'dd' }));
            
            currentQuestions = [...mappedMcq, ...mappedDd].sort((a, b) => a.id - b.id);
            
            prepareNewMcq(); 
        }

        if (typeof renderQuestionList === 'function') renderQuestionList(); 
        
    } catch (error) {
        console.error('問題読み込みエラー:', error);
        alert('問題の読み込みに失敗しました。サーバーが起動しているか確認してください。');
    }
}

function renderQuestionList() {
    const listEl = document.getElementById('question-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const sortedQuestions = getSortedQuestions();

    sortedQuestions.forEach(q => {
        const div = document.createElement('div');
        div.className = 'question-item';
        div.style.padding = '10px';
        div.style.borderBottom = '1px solid var(--border-color, #e2e8f0)'; 
        div.style.cursor = 'pointer';

        let badgeHtml = '';
        if (q.type === 'mcq') badgeHtml = `<span style="background-color: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 8px; font-weight: bold;">四択</span>`;
        else if (q.type === 'dd') badgeHtml = `<span style="background-color: #ede9fe; color: #7c3aed; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 8px; font-weight: bold;">D&D</span>`;
        else if (q.type === 'sim') badgeHtml = `<span style="background-color: #fef08a; color: #a16207; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 8px; font-weight: bold;">Sim</span>`;

        div.innerHTML = `
            <div style="font-size: 0.85em; color: var(--format-text, #64748b); margin-bottom: 6px; display: flex; align-items: center;">
                ${badgeHtml}<span>ID:${q.id}</span>
            </div>
            <div style="font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${q.question || '（問題文なし）'}
            </div>
        `;
        div.onclick = () => openEditor(q);
        listEl.appendChild(div);
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    const targetMode = document.getElementById(`${tabId}-mode`);
    if(targetMode) targetMode.style.display = 'block';
    
    if (tabId === 'bulk-category') {
        renderCategoryTargetList();
    }
    // ★ 追加: 模試設定タブが開かれたらDBから読み込む
    if (tabId === 'exam-setting') {
        loadExamSetting();
    }
}

function openEditor(q) {
    if (q.type === 'sim') {
        restoreSimEditor(q);
    } else if (q.type === 'dd') {
        restoreDdEditor(q);
    } else {
        switchTab('edit');
        document.getElementById('edit-form').style.display = 'block';
        document.getElementById('edit-title').style.display = 'none';

        document.getElementById('q-id').value = q.id;
        document.getElementById('q-text').value = q.question;
        document.getElementById('q-image-url').value = q.questionImageUrl || '';
        document.getElementById('q-explanation').value = q.explanation || '';
        document.getElementById('q-exp-image-url').value = q.explanationImageUrl || '';
        
        previewImage('q-image-url', 'q-image-preview');
        previewImage('q-exp-image-url', 'q-exp-image-preview');

        if(document.getElementById('q-major')) document.getElementById('q-major').value = q.categoryMajorId || '';
        if(document.getElementById('q-medium')) document.getElementById('q-medium').value = q.categoryMediumId || '';
        if(document.getElementById('q-minor')) document.getElementById('q-minor').value = q.categoryMinorId || '';

        const container = document.getElementById('options-container');
        container.innerHTML = '';
        
        if (q.options && q.options.length > 0) {
            q.options.forEach(opt => {
                addOptionUI();
                const optItems = document.querySelectorAll('#options-container .option-item');
                const lastGroup = optItems[optItems.length - 1];
                
                const isCorrect = opt.correct !== undefined ? opt.correct : opt.isCorrect;
                lastGroup.querySelector('.opt-correct').checked = isCorrect;
                lastGroup.querySelector('.opt-text').value = opt.text || '';
                
                const imgInput = lastGroup.querySelector('.opt-image-url');
                if (imgInput) {
                    imgInput.value = opt.imageUrl || '';
                    if(opt.imageUrl) imgInput.dispatchEvent(new Event('input'));
                }
            });
        } else {
            addOptionUI();
        }
    }
}

function getSortedQuestions() {
    const searchVal = document.getElementById('search-id-input')?.value.trim() || "";
    const sortVal = document.getElementById('sort-select')?.value || "id-asc";
    
    let filtered = searchVal 
        ? currentQuestions.filter(q => String(q.id).includes(searchVal))
        : [...currentQuestions];

    const getCatSeq = (catId) => {
        if (!catId) return 9999;
        const cat = currentCategories.find(c => c.id === catId);
        return cat ? cat.sequence : 9999;
    };

    filtered.sort((a, b) => {
        if (sortVal === "id-asc") return a.id - b.id;
        if (sortVal === "id-desc") return b.id - a.id;
        if (sortVal === "major-asc") {
            const diff = getCatSeq(a.categoryMajorId) - getCatSeq(b.categoryMajorId);
            return diff !== 0 ? diff : a.id - b.id;
        }
        if (sortVal === "medium-asc") {
            const diff = getCatSeq(a.categoryMediumId) - getCatSeq(b.categoryMediumId);
            return diff !== 0 ? diff : a.id - b.id;
        }
        if (sortVal === "minor-asc") {
            const diff = getCatSeq(a.categoryMinorId) - getCatSeq(b.categoryMinorId);
            return diff !== 0 ? diff : a.id - b.id;
        }
        return 0;
    });
    return filtered;
}

function previewImage(inputId, previewId) {
    const url = document.getElementById(inputId).value;
    const img = document.getElementById(previewId);
    img.style.display = (url && url.startsWith('http')) ? 'block' : 'none';
    img.src = url;
}

async function uploadImage(fileInput, targetInputId, targetPreviewId) {
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    const inputEl = document.getElementById(targetInputId);
    inputEl.value = "アップロード中...";

    try {
        const headers = getAuthHeaders();
        delete headers['Content-Type'];

        const res = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        if (!res.ok) throw new Error('アップロード失敗');
        const data = await res.json();
        inputEl.value = data.url;
        previewImage(targetInputId, targetPreviewId);
    } catch (e) {
        alert("画像のアップロードに失敗しました。");
        inputEl.value = "";
    } finally {
        fileInput.value = "";
    }
}

async function sendQuestionsToBackend(questionsArray) {
    try {
        const response = await fetch(`${API_BASE_URL}/questions/bulk`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(questionsArray)
        });
        if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
        alert('保存に成功しました！');
        loadQuestions();
    } catch (error) {
        alert('保存に失敗しました。バックエンドが起動しているか確認してください。');
    }
}

// ==========================================
// 模試設定の読み込み・保存処理
// ==========================================
async function loadExamSetting() {
    if (!currentWorkbookId) return;
    try {
        const res = await fetch(`${API_BASE_URL}/multiple-choice-settings?workbookId=${currentWorkbookId}`, { headers: getAuthHeaders() });
        if (res.ok) {
            const settings = await res.json();
            const setting = Array.isArray(settings) ? settings[0] : settings;
            if (setting) {
                document.getElementById('exam-setting-count').value = setting.questionCount || setting.question_count || 20;
                document.getElementById('exam-setting-time').value = setting.timeLimiteSecond || setting.time_limite_second || 3600;
            } else {
                document.getElementById('exam-setting-count').value = 20;
                document.getElementById('exam-setting-time').value = 3600;
            }
        }
    } catch (e) {
        console.error("模試設定取得エラー:", e);
    }
}

async function saveExamSetting() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");
    
    const count = parseInt(document.getElementById('exam-setting-count').value) || 20;
    const time = parseInt(document.getElementById('exam-setting-time').value) || 3600;

    const requestData = {
        workbookId: currentWorkbookId,
        questionCount: count,
        timeLimiteSecond: time
    };

    try {
        const response = await fetch(`${API_BASE_URL}/multiple-choice-settings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(requestData)
        });
        if (!response.ok) throw new Error('保存エラー');
        alert('模試設定を保存しました！');
    } catch (error) {
        alert('模試設定の保存に失敗しました。');
    }
}

// ==========================================
// 四択問題エディタ処理
// ==========================================
function prepareNewMcq() {
    switchTab('edit');
    document.getElementById('edit-form').style.display = 'block';
    document.getElementById('edit-title').style.display = 'none';
    document.getElementById('q-id').value = '';
    document.getElementById('q-text').value = '';
    document.getElementById('q-image-url').value = '';
    document.getElementById('q-image-preview').style.display = 'none';
    document.getElementById('q-explanation').value = '';
    document.getElementById('q-exp-image-url').value = '';
    document.getElementById('q-exp-image-preview').style.display = 'none';
    document.getElementById('q-major').value = '';
    document.getElementById('q-medium').value = '';
    document.getElementById('q-minor').value = '';
    document.getElementById('options-container').innerHTML = '';
    addOptionUI();
}

function addOptionUIToContainer(text = '', isCorrect = false, imageUrl = '') {
    const optContainer = document.getElementById('options-container');
    const index = optContainer.children.length + 1;
    const uniqueId = `opt-img-${Date.now()}-${index}`; 
    
    const div = document.createElement('div');
    div.className = 'option-item';
    div.style.flexDirection = 'column'; 
    div.style.alignItems = 'stretch';
    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%;">
            <span style="font-weight:bold; color:var(--format-text);">選択肢${index}</span>
            <input type="text" class="opt-text" value="${text}" placeholder="選択肢の文章">
            <label class="is-correct-label"><input type="checkbox" class="opt-correct" ${isCorrect ? 'checked' : ''}> 正解</label>
            <button class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">削除</button>
        </div>
        <div style="margin-top: 10px; width:100%;">
            <input type="text" id="${uniqueId}-input" class="opt-image-url" value="${imageUrl}" placeholder="選択肢の画像URL (任意)" oninput="previewImage('${uniqueId}-input', '${uniqueId}-preview')">
            <img id="${uniqueId}-preview" class="image-preview" style="display: ${imageUrl ? 'block' : 'none'};" src="${imageUrl}">
        </div>
    `;
    optContainer.appendChild(div);
    if(imageUrl) document.getElementById(`${uniqueId}-preview`).src = imageUrl;
}

function addOptionUI() { addOptionUIToContainer(); }

function saveQuestion() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");

    const questionIdStr = document.getElementById('q-id').value;
    const questionId = questionIdStr ? parseInt(questionIdStr) : null;

    const options = [];
    document.querySelectorAll('#options-container .option-item').forEach(item => {
        const text = item.querySelector('.opt-text').value.trim();
        const isCorrect = item.querySelector('.opt-correct').checked;
        const imageUrl = item.querySelector('.opt-image-url').value.trim();
        if (text || imageUrl) options.push({ text, isCorrect, imageUrl });
    });

    if (options.length === 0) return alert("最低1つの選択肢を入力してください。");

    const requestData = [{
        id: questionId,
        workbookId: currentWorkbookId,
        categoryMajorId: document.getElementById('q-major').value ? parseInt(document.getElementById('q-major').value) : null,
        categoryMediumId: document.getElementById('q-medium').value ? parseInt(document.getElementById('q-medium').value) : null,
        categoryMinorId: document.getElementById('q-minor').value ? parseInt(document.getElementById('q-minor').value) : null,
        question: document.getElementById('q-text').value.trim(),
        questionImageUrl: document.getElementById('q-image-url').value.trim(),
        explanation: document.getElementById('q-explanation').value.trim(),
        explanationImageUrl: document.getElementById('q-exp-image-url').value.trim(),
        options: options
    }];

    sendQuestionsToBackend(requestData);
}

async function deleteQuestion() {
    const id = document.getElementById('q-id').value;
    if (!id) return; 
    
    if (!confirm(`問題ID: ${id} を削除しますか？`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/questions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        if (!response.ok) throw new Error('削除エラー');
        alert('問題を削除しました。');
        document.getElementById('edit-form').style.display = 'none';
        document.getElementById('edit-title').textContent = '問題を選択してください';
        loadQuestions();
    } catch (error) {
        alert('削除に失敗しました。');
    }
}

// ==========================================
// 手動複数登録 (Manual Bulk) 処理
// ==========================================
let manualBulkCount = 0;
function addManualBulkUI() {
    manualBulkCount++;
    const blockId = `mb-${manualBulkCount}`;
    const container = document.getElementById('manual-bulk-container');
    const div = document.createElement('div');
    div.className = 'option-item'; 
    div.style.borderLeft = '3px solid var(--success-color)';
    div.style.flexDirection = 'column';
    div.style.alignItems = 'stretch';
    div.style.marginBottom = '25px';
    div.style.padding = '15px';
    
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
            <h4 style="margin:0;">新規問題 (手動) ${manualBulkCount}</h4>
            <button class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">この問題を削除</button>
        </div>
        
        <div class="row-group form-group">
            <div><label>大項目</label><select class="category-select major-select"><option value="">未設定</option></select></div>
            <div><label>中項目</label><select class="category-select medium-select"><option value="">未設定</option></select></div>
            <div><label>小項目</label><select class="category-select minor-select"><option value="">未設定</option></select></div>
        </div>

        <div class="form-group"><label>問題文</label><textarea rows="3"></textarea></div>
        <div class="form-group">
            <label>問題画像URL</label>
            <input type="text" id="${blockId}-q-img" oninput="previewImage('${blockId}-q-img', '${blockId}-q-prev')">
            <img id="${blockId}-q-prev" class="image-preview" style="display:none;">
        </div>

        <div class="form-group"><label>解説</label><textarea rows="2"></textarea></div>
        <div class="form-group">
            <label>解説画像URL</label>
            <input type="text" id="${blockId}-exp-img" oninput="previewImage('${blockId}-exp-img', '${blockId}-exp-prev')">
            <img id="${blockId}-exp-prev" class="image-preview" style="display:none;">
        </div>

        <div class="options-header" style="margin-top: 15px;">
            <label style="font-weight:bold; color:var(--heading-color);">選択肢 (複数正解可)</label>
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.9em;" onclick="addOptionToManualBlock('${blockId}-options')">+ 選択肢を追加</button>
        </div>
        <div class="options-container" id="${blockId}-options" style="margin-top: 10px; border-left: 2px solid var(--border-color); padding-left: 10px;"></div>
    `;
    container.appendChild(div);

    for(let i = 0; i < 4; i++) {
        addOptionToManualBlock(`${blockId}-options`);
    }

    updateDatalists();
}

function addOptionToManualBlock(containerId) {
    const optContainer = document.getElementById(containerId);
    const index = optContainer.children.length + 1;
    const uniqueId = `mb-opt-${Date.now()}-${Math.floor(Math.random()*1000)}`; 
    
    const div = document.createElement('div');
    div.className = 'option-item';
    div.style.flexDirection = 'column'; 
    div.style.alignItems = 'stretch';
    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%;">
            <span style="font-weight:bold; color:var(--format-text);">選択肢${index}</span>
            <input type="text" class="opt-text" placeholder="選択肢の文章">
            <label class="is-correct-label"><input type="checkbox" class="opt-correct"> 正解</label>
            <button class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">削除</button>
        </div>
        <div style="margin-top: 5px; width:100%;">
            <input type="text" id="${uniqueId}-input" class="opt-image-url" placeholder="選択肢の画像URL (任意)" oninput="previewImage('${uniqueId}-input', '${uniqueId}-preview')">
            <img id="${uniqueId}-preview" class="image-preview" style="display:none;">
        </div>
    `;
    optContainer.appendChild(div);
}

function saveManualBulk() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");
    const requestData = [];
    
    document.querySelectorAll('#manual-bulk-container > .option-item').forEach(block => {
        const major = block.querySelector('.major-select').value;
        const medium = block.querySelector('.medium-select').value;
        const minor = block.querySelector('.minor-select').value;
        
        const questionText = block.querySelectorAll('textarea')[0].value.trim(); 
        const questionImg = block.querySelector('[id$="-q-img"]').value.trim(); 
        const explanation = block.querySelectorAll('textarea')[1].value.trim(); 
        const expImg = block.querySelector('[id$="-exp-img"]').value.trim();

        const options = [];
        block.querySelector('.options-container').querySelectorAll('.option-item').forEach(optItem => {
            const text = optItem.querySelector('.opt-text').value.trim();
            const isCorrect = optItem.querySelector('.opt-correct').checked;
            const imageUrl = optItem.querySelector('.opt-image-url').value.trim();
            if (text || imageUrl) options.push({ text, isCorrect, imageUrl });
        });

        if (questionText) {
            requestData.push({
                workbookId: currentWorkbookId,
                categoryMajorId: major ? parseInt(major) : null,
                categoryMediumId: medium ? parseInt(medium) : null,
                categoryMinorId: minor ? parseInt(minor) : null,
                question: questionText,
                questionImageUrl: questionImg,
                explanation: explanation,
                explanationImageUrl: expImg,
                options: options
            });
        }
    });

    if (requestData.length === 0) return alert("保存する問題データが入力されていません。");
    sendQuestionsToBackend(requestData);
}

// ==========================================
// コピペ一括登録・カテゴリ一括設定
// ==========================================
document.getElementById('tsv-input')?.addEventListener('input', function() {
    const text = this.value.trim();
    if (!text) { document.getElementById('bulk-preview').textContent = ''; return; }
    document.getElementById('bulk-preview').textContent = `現在 ${text.split('\n').length} 件の問題が認識されています。`;
});

function savePasteBulk() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");
    const text = document.getElementById('tsv-input').value.trim();
    if (!text) return alert("データが入力されていません。");

    const lines = text.split('\n');
    const requestData = [];

    for (let i = 0; i < lines.length; i++) {
        const columns = lines[i].split('\t');
        if (columns.length < 5) return alert(`${i + 1}行目のデータが不足しています。\nエラー行: ${lines[i]}`);

        const questionText = columns[0].trim();
        const imageUrl = columns[1].trim();
        const explanation = columns[2].trim();
        const correctIndices = columns[3].trim().split(',').map(s => s.trim());

        const options = [];
        for (let j = 4; j < columns.length; j++) {
            const optionText = columns[j].trim();
            if (optionText) {
                options.push({ text: optionText, isCorrect: correctIndices.includes(String(j - 3)) });
            }
        }
        requestData.push({ workbookId: currentWorkbookId, question: questionText, questionImageUrl: imageUrl, explanation: explanation, options: options });
    }
    
    document.getElementById('tsv-input').value = '';
    document.getElementById('bulk-preview').textContent = '';
    sendQuestionsToBackend(requestData);
}

function renderCategoryTargetList() {
    const list = document.getElementById('category-target-list');
    list.innerHTML = '';
    const sortedQuestions = getSortedQuestions();

    if (sortedQuestions.length === 0) {
        list.innerHTML = '<p style="color: var(--format-text);">問題がありません。</p>';
        return;
    }
    
    const getCatName = (catId) => {
        const cat = currentCategories.find(c => c.id === catId);
        return cat ? cat.name : '未設定';
    };

    sortedQuestions.forEach(q => {
        const div = document.createElement('div');
        div.className = 'checkbox-list-item';
        const snippet = q.question.length > 20 ? q.question.substring(0, 20) + '...' : q.question;
        const catStr = q.categoryMajorId ? ` [大: ${getCatName(q.categoryMajorId)}]` : '';

        div.innerHTML = `
            <input type="checkbox" class="category-target-cb" value="${q.id}" id="cb-${q.id}">
            <label for="cb-${q.id}" style="cursor:pointer;">ID:${q.id}${catStr} - ${snippet}</label>
        `;
        list.appendChild(div);
    });
}

function selectAllForCategory(check) {
    document.querySelectorAll('.category-target-cb').forEach(cb => cb.checked = check);
}

function saveBulkCategory() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");

    const selectedIds = Array.from(document.querySelectorAll('.category-target-cb:checked')).map(cb => parseInt(cb.value));
    if (selectedIds.length === 0) return alert('対象の問題がチェックされていません。');
    
    const majorVal = document.getElementById('bulk-major').value;
    const mediumVal = document.getElementById('bulk-medium').value;
    const minorVal = document.getElementById('bulk-minor').value;

    if (!majorVal && !mediumVal && !minorVal) {
        return alert("一括設定するカテゴリを1つ以上選択してください。（すべて「変更しない」の場合は保存できません）");
    }
    
    const requestData = [];
    selectedIds.forEach(id => {
        const existingQ = currentQuestions.find(q => q.id === id);
        if (existingQ) {
            const newMajorId = majorVal ? parseInt(majorVal) : existingQ.categoryMajorId;
            const newMediumId = mediumVal ? parseInt(mediumVal) : existingQ.categoryMediumId;
            const newMinorId = minorVal ? parseInt(minorVal) : existingQ.categoryMinorId;
            
            const formattedOptions = (existingQ.options || []).map(opt => ({
                id: opt.id, text: opt.text, imageUrl: opt.imageUrl, isCorrect: opt.correct !== undefined ? opt.correct : opt.isCorrect
            }));

            requestData.push({
                id: existingQ.id,
                workbookId: existingQ.workbookId || currentWorkbookId,
                categoryMajorId: newMajorId,
                categoryMediumId: newMediumId,
                categoryMinorId: newMinorId,
                question: existingQ.question,
                questionImageUrl: existingQ.questionImageUrl,
                explanation: existingQ.explanation,
                explanationImageUrl: existingQ.explanationImageUrl,
                options: formattedOptions
            });
        }
    });

    if (requestData.length > 0) sendQuestionsToBackend(requestData);
}

// ==========================================
// ドラッグ＆ドロップ(D&D) エディタ処理
// ==========================================
function prepareNewDd() {
    switchTab('dd-edit');
    document.getElementById('dd-editor-title').innerHTML = '✨ D&D問題の新規作成';
    document.getElementById('dd-btn-to-new').style.display = 'none';
    document.getElementById('dd-btn-save').innerHTML = '新規問題として保存する';
    document.getElementById('dd-btn-delete').style.display = 'none';
    
    document.getElementById('dd-q-id').value = '';
    document.getElementById('dd-q-text').value = '';
    document.getElementById('dd-q-image-url').value = '';
    document.getElementById('dd-q-image-preview').style.display = 'none';
    document.getElementById('dd-explanation').value = '';
    document.getElementById('dd-exp-image-url').value = '';
    document.getElementById('dd-exp-image-preview').style.display = 'none';
    
    if (document.getElementById('dd-q-major')) document.getElementById('dd-q-major').value = '';
    if (document.getElementById('dd-q-medium')) document.getElementById('dd-q-medium').value = '';
    if (document.getElementById('dd-q-minor')) document.getElementById('dd-q-minor').value = '';

    document.getElementById('dd-zones-container').innerHTML = '';
    document.getElementById('dd-dummies-container').innerHTML = '';
    
    addDropZoneUI();
    addDummyItemUI();
}

function restoreDdEditor(q) {
    switchTab('dd-edit');
    document.getElementById('dd-editor-title').innerHTML = `📝 D&D問題の編集 (ID: ${q.id})`;
    document.getElementById('dd-btn-to-new').style.display = 'inline-block';
    document.getElementById('dd-btn-save').innerHTML = '変更を上書き保存する';
    document.getElementById('dd-btn-delete').style.display = 'inline-block';

    document.getElementById('dd-q-id').value = q.id;
    document.getElementById('dd-q-text').value = q.question || '';
    document.getElementById('dd-q-image-url').value = q.questionImageUrl || '';
    document.getElementById('dd-explanation').value = q.explanation || '';
    document.getElementById('dd-exp-image-url').value = q.explanationImageUrl || '';
    
    if (document.getElementById('dd-q-major')) document.getElementById('dd-q-major').value = q.categoryMajorId || '';
    if (document.getElementById('dd-q-medium')) document.getElementById('dd-q-medium').value = q.categoryMediumId || '';
    if (document.getElementById('dd-q-minor')) document.getElementById('dd-q-minor').value = q.categoryMinorId || '';

    previewImage('dd-q-image-url', 'dd-q-image-preview');
    previewImage('dd-exp-image-url', 'dd-exp-image-preview');

    const allDragItems = q.dragItems || q.draggables || [];

    document.getElementById('dd-zones-container').innerHTML = '';
    if (q.dropZones) {
        q.dropZones.forEach((z, index) => {
            const itemsForThisZone = allDragItems.filter(item => item.correctZoneIndex === index);
            addDropZoneUI({ ...z, correctItems: itemsForThisZone });
        });
    }
    
    document.getElementById('dd-dummies-container').innerHTML = '';
    const dummyItems = allDragItems.filter(item => item.correctZoneIndex === null || item.correctZoneIndex === undefined);
    if (dummyItems.length > 0) dummyItems.forEach(d => addDummyItemUI(d));
}

function addDropZoneUI(zoneData = null) {
    const container = document.getElementById('dd-zones-container');
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'dd-zone-box';
    zoneDiv.style.border = '2px solid #cbd5e1';
    zoneDiv.style.borderRadius = '8px';
    zoneDiv.style.padding = '15px';
    zoneDiv.style.marginBottom = '15px';
    zoneDiv.style.backgroundColor = '#f8fafc';

    const zoneName = zoneData ? (zoneData.zoneName || zoneData.name || zoneData.title || '') : '';
    const safeZoneName = zoneName.toString().replace(/"/g, '&quot;');

    zoneDiv.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
            <span style="font-weight: bold; color: #475569;">ゾーン名:</span>
            <input type="text" class="zone-name-input" placeholder="例: ネットワーク層" value="${safeZoneName}" style="flex: 1; border: 1px solid #94a3b8; padding: 5px; border-radius: 4px;">
            <button class="btn btn-danger" onclick="this.parentElement.parentElement.remove()" style="padding: 5px 10px;">箱ごと削除</button>
        </div>
        <div class="drag-items-container" style="margin-left: 20px; border-left: 2px solid #cbd5e1; padding-left: 15px;"></div>
        <button class="btn btn-outline" onclick="addDragItemUI(this)" style="margin-left: 20px; margin-top: 10px; padding: 5px 15px; font-size: 0.9em;">+ この箱に入る正解アイテムを追加</button>
    `;
    container.appendChild(zoneDiv);
    
    const btnElement = zoneDiv.querySelector('button.btn-outline');
    if (zoneData) {
        const items = zoneData.correctItems || zoneData.items || zoneData.dragItems || zoneData.draggables || [];
        if (items.length > 0) items.forEach(item => addDragItemUI(btnElement, item));
    } else {
        addDragItemUI(btnElement);
    }
}

function addDragItemUI(btnElement, itemData = null) {
    const itemsContainer = btnElement.parentElement.querySelector('.drag-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'drag-item-row';
    itemDiv.style.display = 'flex';
    itemDiv.style.flexDirection = 'column';
    itemDiv.style.gap = '5px';
    itemDiv.style.marginBottom = '10px';
    itemDiv.style.padding = '10px';
    itemDiv.style.border = '1px dashed #cbd5e1';
    itemDiv.style.borderRadius = '4px';
    itemDiv.style.backgroundColor = '#fff';

    const uniqueId = 'drag-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const itemText = itemData ? (itemData.text || itemData.content || itemData.name || itemData.word || '') : '';
    const safeItemText = itemText.toString().replace(/"/g, '&quot;');
    const itemUrl = itemData ? (itemData.imageUrl || itemData.image || itemData.url || '') : '';
    const displayStyle = itemUrl ? 'block' : 'none';

    itemDiv.innerHTML = `
        <div style="display: flex; gap: 10px;">
            <span style="color: #64748b; padding-top: 5px;">⇒</span>
            <input type="text" class="drag-item-text" placeholder="テキスト (例: OSPF)" value="${safeItemText}" style="flex: 1; padding: 5px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <button class="btn btn-outline" onclick="this.parentElement.parentElement.remove()" style="padding: 2px 8px; color: #ef4444; border-color: #ef4444;">×</button>
        </div>
        <div style="display: flex; gap: 10px; padding-left: 25px;">
            <input type="text" class="drag-item-img-url" id="url-${uniqueId}" value="${itemUrl}" oninput="previewImage('url-${uniqueId}', 'prev-${uniqueId}')" placeholder="画像URL (任意)" style="flex: 1; font-size: 0.85em; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <label class="btn btn-outline" style="cursor: pointer; padding: 2px 8px; font-size: 0.85em; display: flex; align-items: center;">
                📁 画像を選択
                <input type="file" style="display: none;" accept="image/*" onchange="uploadImage(this, 'url-${uniqueId}', 'prev-${uniqueId}')">
            </label>
        </div>
        <img id="prev-${uniqueId}" class="image-preview" src="${itemUrl}" style="display: ${displayStyle}; max-width: 150px; margin-left: 25px;">
    `;
    itemsContainer.appendChild(itemDiv);
}

function addDummyItemUI(dummyData = null) {
    const container = document.getElementById('dd-dummies-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'dummy-item-row';
    itemDiv.style.display = 'flex';
    itemDiv.style.flexDirection = 'column';
    itemDiv.style.gap = '5px';
    itemDiv.style.marginBottom = '10px';
    itemDiv.style.padding = '10px';
    itemDiv.style.border = '1px dashed #cbd5e1';
    itemDiv.style.borderRadius = '4px';
    itemDiv.style.backgroundColor = '#fff';

    const uniqueId = 'dummy-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const itemText = dummyData ? (dummyData.text || dummyData.content || dummyData.name || dummyData.word || '') : '';
    const safeItemText = itemText.toString().replace(/"/g, '&quot;');
    const itemUrl = dummyData ? (dummyData.imageUrl || dummyData.image || dummyData.url || '') : '';
    const displayStyle = itemUrl ? 'block' : 'none';

    itemDiv.innerHTML = `
        <div style="display: flex; gap: 10px;">
            <span style="color: #64748b; padding-top: 5px;">👻</span>
            <input type="text" class="dummy-item-text" placeholder="テキスト (例: Macアドレス)" value="${safeItemText}" style="flex: 1; padding: 5px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <button class="btn btn-outline" onclick="this.parentElement.parentElement.remove()" style="padding: 2px 8px; color: #ef4444; border-color: #ef4444;">×</button>
        </div>
        <div style="display: flex; gap: 10px; padding-left: 25px;">
            <input type="text" class="dummy-item-img-url" id="url-${uniqueId}" value="${itemUrl}" oninput="previewImage('url-${uniqueId}', 'prev-${uniqueId}')" placeholder="画像URL (任意)" style="flex: 1; font-size: 0.85em; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px;">
            <label class="btn btn-outline" style="cursor: pointer; padding: 2px 8px; font-size: 0.85em; display: flex; align-items: center;">
                📁 画像を選択
                <input type="file" style="display: none;" accept="image/*" onchange="uploadImage(this, 'url-${uniqueId}', 'prev-${uniqueId}')">
            </label>
        </div>
        <img id="prev-${uniqueId}" class="image-preview" src="${itemUrl}" style="display: ${displayStyle}; max-width: 150px; margin-left: 25px;">
    `;
    container.appendChild(itemDiv);
}

async function saveDdQuestion() { 
    if (!currentWorkbookId) return alert("問題集を選択してください。");
    const questionText = document.getElementById('dd-q-text').value.trim();
    if (!questionText) return alert("問題文を入力してください。");

    const dropZones = [];
    const dragItems = [];

    document.querySelectorAll('.dd-zone-box').forEach((box, zoneIndex) => {
        const zoneName = box.querySelector('.zone-name-input').value.trim();
        if (zoneName) {
            dropZones.push({ name: zoneName, sequence: zoneIndex + 1 });
            box.querySelectorAll('.drag-item-row').forEach(row => {
                const itemText = row.querySelector('.drag-item-text').value.trim();
                const itemImg = row.querySelector('.drag-item-img-url').value.trim();
                if (itemText || itemImg) {
                    dragItems.push({ text: itemText, imageUrl: itemImg, correctZoneIndex: dropZones.length - 1 });
                }
            });
        }
    });

    document.querySelectorAll('.dummy-item-row').forEach(row => {
        const itemText = row.querySelector('.dummy-item-text').value.trim();
        const itemImg = row.querySelector('.dummy-item-img-url').value.trim();
        if (itemText || itemImg) {
            dragItems.push({ text: itemText, imageUrl: itemImg, correctZoneIndex: null });
        }
    });

    if (dropZones.length === 0) return alert("少なくとも1つのドロップゾーン（箱）を作成してください。");

    const qIdStr = document.getElementById('dd-q-id').value;
    const requestData = {
        id: qIdStr ? parseInt(qIdStr) : null, 
        workbookId: currentWorkbookId,
        question: questionText,
        questionImageUrl: document.getElementById('dd-q-image-url').value.trim(),
        explanation: document.getElementById('dd-explanation').value.trim(),
        explanationImageUrl: document.getElementById('dd-exp-image-url').value.trim(),
        categoryMajorId: document.getElementById('dd-q-major').value ? parseInt(document.getElementById('dd-q-major').value) : null,
        categoryMediumId: document.getElementById('dd-q-medium').value ? parseInt(document.getElementById('dd-q-medium').value) : null,
        categoryMinorId: document.getElementById('dd-q-minor').value ? parseInt(document.getElementById('dd-q-minor').value) : null,
        dropZones: dropZones,
        dragItems: dragItems
    };

    try {
        const saveBtn = event.target;
        saveBtn.disabled = true;
        saveBtn.textContent = "保存中...";
        const response = await fetch(`${API_BASE_URL}/dd-questions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(requestData)
        });
        if (!response.ok) throw new Error('保存エラー');
        alert('ドラッグ＆ドロップ問題を保存しました！');
        prepareNewDd();
        loadQuestions();
    } catch (error) { 
        alert('D&D問題の保存に失敗しました。'); 
    } finally {
        const saveBtn = document.querySelector('#dd-edit-mode .btn-primary');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "保存する"; }
    }
}

// ==========================================
// シミュレーション問題 エディタ処理
// ==========================================
function formatInitialConfig(configText) {
    if (!configText) return '';
    const lines = configText.split('\n');
    let formatted = [];
    let currentMode = 'global';
    
    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('!')) {
            formatted.push(line);
            continue;
        }
        
        const lower = trimmed.toLowerCase();
        const isModeCommand = lower.startsWith('interface ') || lower.startsWith('vlan ') || lower.startsWith('router ospf ');
        
        if (isModeCommand) {
            if (currentMode !== 'global') {
                formatted.push(' exit');
            }
            formatted.push(line);
            currentMode = 'sub';
        } else if (lower === 'exit' || lower === 'end') {
            formatted.push(line);
            currentMode = 'global';
        } else {
            formatted.push(line);
        }
    }
    return formatted.join('\n');
}

function prepareNewSim() {
    switchTab('sim-edit');
    document.getElementById('sim-editor-title').innerHTML = '✨ シミュレーション問題の新規作成';
    document.getElementById('sim-btn-to-new').style.display = 'none'; 
    document.getElementById('sim-btn-save').innerHTML = '新規問題として保存する';
    document.getElementById('sim-btn-delete').style.display = 'none'; 
    
    document.getElementById('sim-q-id').value = '';
    document.getElementById('sim-q-text').value = '';
    document.getElementById('sim-q-image-url').value = '';
    const preview = document.getElementById('sim-q-image-preview');
    if (preview) preview.style.display = 'none';
    document.getElementById('sim-initial-config').value = '';
    
    if(document.getElementById('sim-q-major')) document.getElementById('sim-q-major').value = '';
    if(document.getElementById('sim-q-medium')) document.getElementById('sim-q-medium').value = '';
    if(document.getElementById('sim-q-minor')) document.getElementById('sim-q-minor').value = '';

    const tasksContainer = document.getElementById('sim-tasks-container');
    if (tasksContainer) tasksContainer.innerHTML = '';
    if (typeof addSimTaskUI === 'function') addSimTaskUI(); 
    if (typeof resetEditorConsole === 'function') resetEditorConsole();
}

function restoreSimEditor(q) {
    switchTab('sim-edit');
    document.getElementById('sim-editor-title').innerHTML = `📝 シミュレーション問題の編集 (ID: ${q.id})`;
    document.getElementById('sim-btn-to-new').style.display = 'inline-block'; 
    document.getElementById('sim-btn-save').innerHTML = '変更を上書き保存する';
    document.getElementById('sim-btn-delete').style.display = 'inline-block'; 

    document.getElementById('sim-q-id').value = q.id;
    document.getElementById('sim-q-text').value = q.question || '';
    document.getElementById('sim-q-image-url').value = q.questionImageUrl || '';
    document.getElementById('sim-initial-config').value = q.initialConfig || '';
    
    if(document.getElementById('sim-q-major')) document.getElementById('sim-q-major').value = q.categoryMajorId || '';
    if(document.getElementById('sim-q-medium')) document.getElementById('sim-q-medium').value = q.categoryMediumId || '';
    if(document.getElementById('sim-q-minor')) document.getElementById('sim-q-minor').value = q.categoryMinorId || '';

    previewImage('sim-q-image-url', 'sim-q-image-preview');

    const tasksContainer = document.getElementById('sim-tasks-container');
    tasksContainer.innerHTML = '';
    
    if (q.tasks && q.tasks.length > 0) {
        q.tasks.forEach(task => { if(typeof addSimTaskUI === 'function') addSimTaskUI(task); });
    } else {
        if(typeof addSimTaskUI === 'function') addSimTaskUI();
    }
    if(typeof resetEditorConsole === 'function') resetEditorConsole();
}

let editorDevice = null;
function resetEditorConsole() {
    if (typeof VirtualDevice !== 'undefined') {
        editorDevice = new VirtualDevice("Device");
        
        const initialConfig = document.getElementById('sim-initial-config').value;
        if (initialConfig.trim()) {
            const lines = initialConfig.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('!')) {
                    editorDevice.processCommand(trimmed);
                }
            });
            editorDevice.mode = "user"; 
        }

        document.getElementById('sim-console-output').innerHTML = '';
        document.getElementById('sim-console-prompt').textContent = editorDevice.getPrompt();
        document.getElementById('sim-console-input').value = '';
    }
}

document.getElementById('sim-console-input')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        if (!editorDevice && typeof VirtualDevice !== 'undefined') resetEditorConsole();
        const cmd = this.value;
        const outDiv = document.getElementById('sim-console-output');
        outDiv.innerHTML += `<div><span style="color:#fbbf24;">${editorDevice ? editorDevice.getPrompt() : '>'}</span> ${cmd}</div>`;
        
        if (editorDevice) {
            const output = editorDevice.processCommand(cmd);
            if (output) {
                const safeOutput = output.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                outDiv.innerHTML += `<div style="color:#f87171;">${safeOutput}</div>`;
            }
            document.getElementById('sim-console-prompt').textContent = editorDevice.getPrompt();
        }
        this.value = '';
        outDiv.scrollTop = outDiv.scrollHeight;
    }
});

function addSimTaskUI(task = null) {
    const container = document.getElementById('sim-tasks-container');
    const taskIndex = container.children.length + 1;
    const taskDiv = document.createElement('div');
    taskDiv.className = 'sim-task-box';
    taskDiv.style.border = '2px solid #fde047';
    taskDiv.style.borderRadius = '8px';
    taskDiv.style.padding = '15px';
    taskDiv.style.marginBottom = '20px';
    taskDiv.style.backgroundColor = 'transparent';

    taskDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #fde047; padding-bottom: 8px;">
            <span style="font-weight: bold; color: #a16207;" class="task-label">タスク ${taskIndex}</span>
            <button class="btn btn-danger" onclick="this.closest('.sim-task-box').remove()" style="padding: 2px 10px; font-size: 0.85em;">削除</button>
        </div>
        <div class="form-group">
            <label>タスクの指示</label>
            <input type="text" class="task-instruction" placeholder="例: ホスト名を CoreSW に設定してください。" value="${task?.instruction || ''}" style="width: 100%; padding: 8px;">
        </div>
        <div class="form-group">
            <label>解説・解答例 (練習モードで表示されます)</label>
            <textarea class="task-explanation" rows="2" placeholder="例: enable &#10;conf t &#10;hostname CoreSW" style="width: 100%; padding: 8px; font-family: monospace;">${task?.explanation || ''}</textarea>
        </div>
        
        <div style="background: transparent; border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <label style="margin:0; color: #0284c7; font-weight: bold;">✅ このタスクの採点ルール</label>
                <button class="btn btn-outline" onclick="generateRulesForTask(this)" style="padding: 4px 10px; font-size: 0.85em; border-color: #fbbf24; color: #fbbf24; background: transparent;">↓ 上のコンソールから抽出</button>
            </div>
            <div class="task-rules-container"></div>
            <button class="btn btn-outline full-width" onclick="addSimRuleUI(this.previousElementSibling)" style="border-color: var(--border-color, #e5e7eb); margin-top: 5px;">+ ルールを手動追加</button>
        </div>
    `;
    container.appendChild(taskDiv);

    if (task && task.rules) {
        const rulesContainer = taskDiv.querySelector('.task-rules-container');
        task.rules.forEach(r => addSimRuleUI(rulesContainer, r.scope, r.condition, r.score));
    }
}

function addSimRuleUI(container, scope = 'global', condition = '', score = 10) {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'sim-rule-box option-item';
    ruleDiv.style.borderLeft = '3px solid #0284c7';
    ruleDiv.style.marginBottom = '5px';
    ruleDiv.style.padding = '5px 10px';
    
    const scopeOptions = [
        { val: 'global', label: '🌍 グローバル (global / static等)' },
        { val: 'interface GigabitEthernet0/0', label: '🔌 IF: GigabitEthernet0/0' },
        { val: 'interface GigabitEthernet0/1', label: '🔌 IF: GigabitEthernet0/1' },
        { val: 'interface GigabitEthernet0/2', label: '🔌 IF: GigabitEthernet0/2' },
        { val: 'interface FastEthernet0/0', label: '🔌 IF: FastEthernet0/0' },
        { val: 'interface FastEthernet0/1', label: '🔌 IF: FastEthernet0/1' },
        { val: 'interface Serial0/0/0', label: '🔌 IF: Serial0/0/0' },
        { val: 'interface Serial0/0/1', label: '🔌 IF: Serial0/0/1' },
        { val: 'interface vlan 1', label: '🌐 仮想IF: VLAN 1' },
        { val: 'interface vlan 10', label: '🌐 仮想IF: VLAN 10' },
        { val: 'interface vlan 20', label: '🌐 仮想IF: VLAN 20' },
        { val: 'router ospf 1', label: '🔄 OSPF: プロセス 1' },
        { val: 'vlan 10', label: '🏢 VLAN設定: 10' },
        { val: 'vlan 20', label: '🏢 VLAN設定: 20' }
    ];
    
    if (!scopeOptions.find(o => o.val === scope)) {
        scopeOptions.push({ val: scope, label: `⚙️ カスタム: ${scope}` });
    }

    let selectHtml = `<select class="rule-scope form-control" style="flex: 1.5; padding: 4px; font-size: 0.9em; min-width: 200px;">`;
    scopeOptions.forEach(opt => {
        const selected = (opt.val === scope) ? 'selected' : '';
        selectHtml += `<option value="${opt.val}" ${selected}>${opt.label}</option>`;
    });
    selectHtml += `</select>`;

    ruleDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; width:100%;">
            ${selectHtml}
            <input type="text" class="rule-condition" placeholder="必須設定 (hostname R1, ip route... 等)" value="${condition}" style="flex:2; padding: 4px 8px; font-size: 0.9em; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;">
            <input type="number" class="rule-score" placeholder="配点" value="${score}" style="width:70px; padding: 4px 8px; font-size: 0.9em; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px;" min="0">
            <button class="btn btn-danger" onclick="this.parentElement.parentElement.remove()" style="padding:4px 10px; font-weight:bold;">×</button>
        </div>
    `;
    container.appendChild(ruleDiv);
}

function generateRulesForTask(btn) {
    if (!editorDevice) return alert("まずはコンソールでコマンドを実行してください。");
    const container = btn.closest('div').nextElementSibling; 
    const conf = editorDevice.runningConfig;
    
    if (conf.hostname && conf.hostname !== 'Router' && conf.hostname !== 'Device') {
        addSimRuleUI(container, 'global', `hostname ${conf.hostname}`);
    }
    
    if (conf.routes && conf.routes.length > 0) {
        conf.routes.forEach(r => {
            addSimRuleUI(container, 'global', `ip route ${r.network} ${r.mask} ${r.nextHop}`);
        });
    }

    if (conf.vlans) {
        for (const [vlanId, vlanConf] of Object.entries(conf.vlans)) {
            if (vlanConf.name && !vlanConf.name.startsWith('VLAN')) {
                addSimRuleUI(container, `vlan ${vlanId}`, `name ${vlanConf.name}`);
            }
        }
    }

    if (conf.ospf) {
        const ospfScope = `router ospf ${conf.ospf.processId}`;
        conf.ospf.networks.forEach(net => {
            addSimRuleUI(container, ospfScope, `network ${net.network} ${net.wildcard} area ${net.area}`);
        });
    }

    for (const [ifName, ifConf] of Object.entries(conf.interfaces)) {
        const scope = `interface ${ifName}`;
        if (ifConf.ip) addSimRuleUI(container, scope, `ip address ${ifConf.ip} ${ifConf.subnet}`);
        if (ifConf.shutdown === false) addSimRuleUI(container, scope, 'no shutdown');
        if (ifConf.switchportMode) addSimRuleUI(container, scope, `switchport mode ${ifConf.switchportMode}`);
        if (ifConf.accessVlan) addSimRuleUI(container, scope, `switchport access vlan ${ifConf.accessVlan}`);
    }
    
    alert('現在のコンフィグからこのタスクにルールを抽出しました！\n（※他のタスクと重複したルールがあれば×ボタンで消してください）');
}

async function saveSimQuestion() {
    if (!currentWorkbookId) return alert("問題集を選択してください。");

    const rawConfig = document.getElementById('sim-initial-config').value;
    const formattedConfig = formatInitialConfig(rawConfig);
    document.getElementById('sim-initial-config').value = formattedConfig;

    const tasks = [];
    document.querySelectorAll('.sim-task-box').forEach((box, index) => {
        const rules = [];
        box.querySelectorAll('.sim-rule-box').forEach((rBox) => {
            const scope = rBox.querySelector('.rule-scope').value.trim();
            const cond = rBox.querySelector('.rule-condition').value.trim();
            const score = parseInt(rBox.querySelector('.rule-score').value) || 0;
            if (scope && cond) rules.push({ scope, condition: cond, score });
        });

        tasks.push({
            sequence: index + 1,
            instruction: box.querySelector('.task-instruction').value.trim(),
            explanation: box.querySelector('.task-explanation').value.trim(),
            rules: rules
        });
    });

    if (tasks.length === 0) return alert("少なくとも1つのタスクを作成してください。");

    const requestData = {
        id: document.getElementById('sim-q-id').value ? parseInt(document.getElementById('sim-q-id').value) : null,
        workbookId: currentWorkbookId,
        question: document.getElementById('sim-q-text').value.trim(),
        questionImageUrl: document.getElementById('sim-q-image-url').value.trim(),
        categoryMajorId: document.getElementById('sim-q-major').value ? parseInt(document.getElementById('sim-q-major').value) : null,
        categoryMediumId: document.getElementById('sim-q-medium').value ? parseInt(document.getElementById('sim-q-medium').value) : null,
        categoryMinorId: document.getElementById('sim-q-minor').value ? parseInt(document.getElementById('sim-q-minor').value) : null,
        initialConfig: formattedConfig, 
        tasks: tasks 
    };

    try {
        const response = await fetch(`${API_BASE_URL}/sim-questions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(requestData)
        });
        if (!response.ok) throw new Error('保存エラー');
        alert('シミュレーション問題を保存しました！');
        loadQuestions();
        prepareNewSim();
    } catch (e) { alert('保存に失敗しました。'); }
}

async function deleteSimQuestion() {
    const id = document.getElementById('sim-q-id').value;
    if (!id) return; 
    if (!confirm(`シミュレーション問題ID: ${id} を削除しますか？`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/sim-questions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        if (!response.ok) throw new Error('削除エラー');
        alert('シミュレーション問題を削除しました。');
        prepareNewSim();
        loadQuestions();
    } catch (error) { alert('削除に失敗しました。'); }
}

function previewSimQuestion() {
    const rawConfig = document.getElementById('sim-initial-config').value;
    const formattedConfig = typeof formatInitialConfig === 'function' ? formatInitialConfig(rawConfig) : rawConfig;
    document.getElementById('sim-initial-config').value = formattedConfig;

    const tasks = [];
    document.querySelectorAll('.sim-task-box').forEach((box, index) => {
        const rules = [];
        box.querySelectorAll('.sim-rule-box').forEach((rBox) => {
            const scope = rBox.querySelector('.rule-scope').value.trim();
            const cond = rBox.querySelector('.rule-condition').value.trim();
            const score = parseInt(rBox.querySelector('.rule-score').value) || 0;
            if (scope && cond) rules.push({ scope, condition: cond, score });
        });

        tasks.push({
            sequence: index + 1,
            instruction: box.querySelector('.task-instruction').value.trim(),
            explanation: box.querySelector('.task-explanation').value.trim(),
            rules: rules
        });
    });

    if (tasks.length === 0) return alert("プレビューするには、少なくとも1つのタスクを作成してください。");

    const previewData = {
        id: 'Preview', 
        question: document.getElementById('sim-q-text').value.trim(),
        questionImageUrl: document.getElementById('sim-q-image-url').value.trim(),
        initialConfig: formattedConfig,
        tasks: tasks 
    };

    sessionStorage.setItem('simPreviewData', JSON.stringify(previewData));
    window.open('sim_player.html?workbookId=preview&mode=practice&preview=true&source=local', '_blank');
}

init();