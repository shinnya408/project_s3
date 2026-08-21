// ==========================================
// sim_player.js (Pro Edition)
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
let isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';
const isReadOnlyMode = !!targetUserId || isPreviewMode;

let simQuestions = [];
let currentQuestionIndex = 0;
let currentMode = urlParams.get('mode') || 'practice'; 

let devices = {};
let activeDevice = null;
let taskAchievementStatus = {}; 

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof initTheme === 'function') initTheme();

    if (!workbookId) {
        alert('エラー: 問題集が指定されていません。');
        window.location.href = 'index.html';
        return;
    }

    setupConsoleInput();
    initFreeDevices();
    
    // ★ 初回ロード時は確認ダイアログを出さないようにフラグ(true)を渡す
    switchMode(currentMode, true);
    await loadSimQuestions();
});

function getExtraParams() {
    let extra = '';
    if (targetUserId) extra += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreviewMode) extra += `&preview=true`;
    return extra;
}

// ------------------------------------------
// 初期化・データロード
// ------------------------------------------
async function loadSimQuestions() {
    if (urlParams.get('source') === 'local') {
        const localData = sessionStorage.getItem('simPreviewData');
        if (localData) {
            simQuestions = [JSON.parse(localData)]; // 1問だけの配列としてセット
            if (currentMode !== 'free') {
                showSimQuestion(0);
            }
            return; // API通信は行わずに終了
        } else {
            alert('プレビューデータが見つかりませんでした。');
        }
    }

    try {
        const res = await fetch(`${API_BASE_URL}/sim-questions?workbookId=${workbookId}`, {
            headers: getAuthHeaders()
        });

        if (res.ok) {
            simQuestions = await res.json();
        }

        if (simQuestions.length === 0) {
            alert('この問題集にはシミュレーション問題が登録されていません。\nフリーモード（サンドボックス）を起動します。');
            switchMode('free', true);
            return;
        }

        if (currentMode !== 'free') {
            showSimQuestion(0);
        }

    } catch (e) {
        console.error('通信エラー:', e);
        alert('問題データの読み込みに失敗しました。');
        switchMode('free', true);
    }
}

function initFreeDevices() {
    devices = {
        'Router1': new VirtualDevice('Router1'),
        'Switch1': new VirtualDevice('Switch1'),
        'Core_Router': new VirtualDevice('Core_Router')
    };
    activeDevice = devices['Router1'];
}

function showSimQuestion(index) {
    if (index < 0 || index >= simQuestions.length) return;
    currentQuestionIndex = index;
    const q = simQuestions[index];

    document.getElementById('question-progress-text').innerText = `問 ${index + 1} / ${simQuestions.length}`;
    document.getElementById('btn-prev-q').disabled = (index === 0);
    document.getElementById('btn-next-q').disabled = (index === simQuestions.length - 1);

    document.getElementById('scenario-text').innerText = q.question || 'シナリオが設定されていません。';
    
    const topoImgContainer = document.getElementById('topology-image-container');
    const topoImg = document.getElementById('topology-image');
    if (q.questionImageUrl) {
        topoImg.src = q.questionImageUrl;
        topoImgContainer.classList.remove('hidden');
    } else {
        topoImgContainer.classList.add('hidden');
    }

    activeDevice = new VirtualDevice("Router");
    devices = { ["Router"]: activeDevice };
    document.getElementById('cli-device-title').innerText = `Virtual Console (Question ID: ${q.id})`;

    if (q.initialConfig) {
        applyInitialConfig(activeDevice, q.initialConfig);
    }

    clearConsoleOutput();
    updateCliPrompt();
    renderTasksList(q.tasks || []);
    evaluateRunningConfig();
}

function applyInitialConfig(device, configText) {
    const lines = configText.split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('!')) {
            device.processCommand(trimmed);
        }
    });
    device.mode = "user"; 
}

// ------------------------------------------
// UI モード制御
// ------------------------------------------
// ★ isInit フラグを追加して初期化時の挙動を制御
function switchMode(mode, isInit = false) {
    if (!isInit && currentMode === mode) return; // 同じモードが押された場合は何もしない

    // ★ モード切り替え時に確認し、入力内容を完全にリセットする
    if (!isInit) {
        if (!confirm('モードを切り替えると、現在入力中の設定やコンソールはすべてリセットされます。よろしいですか？')) {
            return; // キャンセルされたら切り替えない
        }
    }

    currentMode = mode;
    document.querySelectorAll('.mode-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-btn-${mode}`).classList.add('active');

    const probPanel = document.getElementById('problem-panel-content');
    const freePanel = document.getElementById('free-panel-content');

    if (mode === 'free') {
        probPanel.classList.add('hidden');
        freePanel.classList.remove('hidden');
        
        // ★ フリーモードのデバイスも完全に初期化する
        initFreeDevices();
        changeFreeDevice();
        clearConsoleOutput();
        
        document.getElementById('sim-title').innerText = '🧪 サンドボックス';
    } else {
        probPanel.classList.remove('hidden');
        freePanel.classList.add('hidden');
        document.getElementById('sim-title').innerText = mode === 'practice' ? '📖 練習モード' : '🎯 模試モード';
        
        // ★ 問題を表示し直すことで、初期コンフィグ状態にリセットされる
        if (simQuestions.length > 0) showSimQuestion(currentQuestionIndex);
    }
}

function changeFreeDevice() {
    const selectedName = document.getElementById('free-device-select').value;
    activeDevice = devices[selectedName];
    document.getElementById('cli-device-title').innerText = `Virtual Console (${selectedName})`;
    updateCliPrompt();
    appendConsoleOutput(`\n*** Session established to ${selectedName} ***\n`);
}

// ------------------------------------------
// CLI コンソール制御
// ------------------------------------------
function setupConsoleInput() {
    const inputEl = document.getElementById('cli-input');
    
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = inputEl.value;
            inputEl.value = '';
            executeCommand(command);
        } else if (e.key === 'Tab') {
            // ★ Tab補完
            e.preventDefault();
            if (activeDevice) {
                inputEl.value = activeDevice.getCompletion(inputEl.value);
            }
        } else if (e.key === '?') {
            // ★ ? ヘルプ
            e.preventDefault();
            if (activeDevice) {
                const currentVal = inputEl.value;
                // 現在入力中の文字と「?」をコンソール履歴に印字
                appendConsoleOutput(`${activeDevice.getPrompt()} ${currentVal}?`);
                // ヘルプテキストを取得して印字
                const helpText = activeDevice.getHelp(currentVal);
                if (helpText) {
                    appendConsoleOutput(helpText);
                }
                // （入力欄の値はそのまま維持されるので、続けて入力可能）
            }
        }
    });
}

function focusConsoleInput(event) {
    // ユーザーがテキストを選択（ドラッグコピー）している最中はフォーカス移動しない
    if (window.getSelection().toString()) return;
    
    const ev = event || window.event;
    if (ev) {
        const terminal = document.getElementById('cli-terminal');
        // クリックした位置がスクロールバーの上ならフォーカス移動をキャンセル
        if (terminal && ev.offsetX > terminal.clientWidth) return;
    }

    const inputEl = document.getElementById('cli-input');
    if (inputEl) {
        // preventScroll: true でフォーカス時のガタつきを防ぐ
        inputEl.focus({ preventScroll: true }); 
    }
}

function executeCommand(commandStr) {
    appendConsoleOutput(`${activeDevice.getPrompt()} ${commandStr}`);
    if (commandStr.trim()) {
        const result = activeDevice.processCommand(commandStr);
        if (result) appendConsoleOutput(result);
    }
    updateCliPrompt();

    if (currentMode !== 'free') {
        evaluateRunningConfig();
    }
}

function appendConsoleOutput(text) {
    const outputEl = document.getElementById('cli-output');
    const div = document.createElement('div');
    div.innerText = text;
    outputEl.appendChild(div);
    const terminal = document.getElementById('cli-terminal');
    terminal.scrollTop = terminal.scrollHeight;
}

function clearConsoleOutput() { document.getElementById('cli-output').innerHTML = ''; }
function updateCliPrompt() { if (activeDevice) document.getElementById('cli-prompt').innerText = activeDevice.getPrompt(); }

function resetActiveDevice() {
    if (!confirm('現在の設定をすべて初期化しますか？')) return;
    if (currentMode === 'free') {
        const name = activeDevice.hostname;
        devices[name] = new VirtualDevice(name);
        activeDevice = devices[name];
        appendConsoleOutput(`\n*** System Reset: ${name} ***\n`);
    } else {
        showSimQuestion(currentQuestionIndex);
    }
    updateCliPrompt();
}

function showRunningConfig() { executeCommand('show running-config'); }

// ------------------------------------------
// 自動採点エンジン連携
// ------------------------------------------
function renderTasksList(tasks) {
    const container = document.getElementById('tasks-list-container');
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = '<p class="text-sub">タスクが設定されていません。</p>';
        return;
    }

    tasks.forEach((task, idx) => {
        const taskBox = document.createElement('div');
        taskBox.id = `task-card-${idx}`;
        taskBox.className = 'task-card';

        const showExp = (currentMode === 'practice' && task.explanation);
        const expHtml = showExp ? `
            <details class="task-exp-details">
                <summary>💡 模範解答を開く</summary>
                <pre class="task-exp-code">${escapeHtml(task.explanation)}</pre>
            </details>
        ` : '';

        taskBox.innerHTML = `
            <div class="task-card-header">
                <span id="task-status-icon-${idx}" class="task-status-badge unaccomplished">⬜ 未達成</span>
                <span class="task-number">Task ${idx + 1}</span>
            </div>
            <p class="task-instruction-text">${escapeHtml(task.instruction || '')}</p>
            ${expHtml}
        `;
        container.appendChild(taskBox);
    });
}

function evaluateRunningConfig() {
    if (!simQuestions[currentQuestionIndex]) return;
    const q = simQuestions[currentQuestionIndex];
    const tasks = q.tasks || [];

    let grandTotalScore = 0;
    let grandEarnedScore = 0;

    tasks.forEach((task, idx) => {
        const rules = task.rules || [];
        let taskMaxScore = 0;
        let taskEarnedScore = 0;
        let taskUnmetRules = []; 

        rules.forEach(rule => {
            const ruleScore = rule.score || 10;
            taskMaxScore += ruleScore;
            
            if (checkRuleCondition(activeDevice, rule.scope, rule.condition)) {
                taskEarnedScore += ruleScore;
            } else {
                taskUnmetRules.push({ scope: rule.scope, condition: rule.condition });
            }
        });

        const isPassed = (taskMaxScore > 0 && taskEarnedScore === taskMaxScore);
        taskAchievementStatus[idx] = { passed: isPassed, score: taskEarnedScore, total: taskMaxScore, unmetRules: taskUnmetRules };

        grandTotalScore += taskMaxScore;
        grandEarnedScore += taskEarnedScore;

        const iconEl = document.getElementById(`task-status-icon-${idx}`);
        const cardEl = document.getElementById(`task-card-${idx}`);

        if (iconEl && cardEl) {
            if (currentMode === 'exam') {
                iconEl.innerText = '❓ 採点待ち';
                iconEl.className = 'task-status-badge exam-hidden';
                cardEl.classList.remove('passed');
            } else {
                if (isPassed) {
                    iconEl.innerText = '⭕ 達成！';
                    iconEl.className = 'task-status-badge accomplished';
                    cardEl.classList.add('passed');
                } else {
                    iconEl.innerText = '⬜ 未達成';
                    iconEl.className = 'task-status-badge unaccomplished';
                    cardEl.classList.remove('passed');
                }
            }
        }
    });

    const percentage = grandTotalScore > 0 ? Math.round((grandEarnedScore / grandTotalScore) * 100) : 0;
    
    const totalBadge = document.getElementById('total-score-badge');
    if (currentMode === 'exam') {
        totalBadge.innerText = '模試モード実行中';
        totalBadge.style.background = '#fef3c7';
        totalBadge.style.color = '#b45309';
    } else {
        totalBadge.innerText = `達成度: ${percentage}%`;
        totalBadge.style.background = percentage === 100 ? '#d1fae5' : '#e0f2fe';
        totalBadge.style.color = percentage === 100 ? '#047857' : '#0284c7';
    }
}

function checkRuleCondition(device, scope, conditionStr) {
    if (!device || !device.runningConfig) return false;
    const conf = device.runningConfig;

    const targetScope = (scope || 'global').toLowerCase().trim();
    const cond = (conditionStr || '').toLowerCase().trim();

    // ==========================================
    // 1. グローバル設定の判定
    // ==========================================
    if (targetScope === 'global') {
        if (cond.startsWith('hostname ')) {
            const expected = cond.replace('hostname ', '').trim();
            return conf.hostname.toLowerCase() === expected;
        }
        if (cond.startsWith('ip route ')) {
            // 例: ip route 192.168.2.0 255.255.255.0 10.0.0.2
            const parts = cond.replace('ip route ', '').trim().split(/\s+/);
            if (parts.length < 3) return false;
            const [net, mask, nextHop] = parts;
            return conf.routes && conf.routes.some(r => 
                r.network === net && r.mask === mask && r.nextHop === nextHop
            );
        }
    } 
    // ==========================================
    // 2. インターフェース設定の判定
    // ==========================================
    else if (targetScope.startsWith('interface ')) {
        const rawIfName = targetScope.replace('interface ', '').trim();
        const expectedIfName = device._normalizeInterfaceName(rawIfName).toLowerCase();
        
        const matchedIfKey = Object.keys(conf.interfaces || {}).find(k => k.toLowerCase() === expectedIfName);
        if (!matchedIfKey) return false;

        const ifConf = conf.interfaces[matchedIfKey];

        if (cond === 'no shutdown') {
            return ifConf.shutdown === false;
        } else if (cond.startsWith('ip address ')) {
            const parts = cond.replace('ip address ', '').trim().split(/\s+/);
            return (ifConf.ip === parts[0] && (!parts[1] || ifConf.subnet === parts[1]));
        } else if (cond.startsWith('switchport mode ')) {
            const mode = cond.replace('switchport mode ', '').trim();
            return (ifConf.switchportMode && ifConf.switchportMode.toLowerCase() === mode);
        } else if (cond.startsWith('switchport access vlan ')) {
            const vlan = cond.replace('switchport access vlan ', '').trim();
            return (ifConf.accessVlan && String(ifConf.accessVlan) === vlan);
        }
    }
    // ==========================================
    // 3. VLAN設定の判定
    // ==========================================
    else if (targetScope.startsWith('vlan ')) {
        const vlanId = targetScope.replace('vlan ', '').trim();
        if (!conf.vlans || !conf.vlans[vlanId]) return false;

        const vlanConf = conf.vlans[vlanId];
        if (cond.startsWith('name ')) {
            const expectedName = cond.replace('name ', '').trim();
            return (vlanConf.name && vlanConf.name.toLowerCase() === expectedName);
        }
    }
    // ==========================================
    // 4. OSPF設定の判定
    // ==========================================
    else if (targetScope.startsWith('router ospf ')) {
        const processId = targetScope.replace('router ospf ', '').trim();
        if (!conf.ospf || String(conf.ospf.processId) !== processId) return false;

        if (cond.startsWith('network ')) {
            // 例: network 192.168.1.0 0.0.0.255 area 0
            const parts = cond.replace('network ', '').trim().split(/\s+/);
            if (parts.length < 4 || parts[2] !== 'area') return false;
            const [net, wildcard, , area] = parts;

            return conf.ospf.networks.some(n => 
                n.network === net && n.wildcard === wildcard && String(n.area) === area
            );
        }
    }

    return false;
}

// ------------------------------------------
// 採点・提出
// ------------------------------------------
async function submitSimExam() {
    evaluateRunningConfig();

    let totalEarned = 0;
    let totalMax = 0;

    const missingContainer = document.getElementById('modal-missing-settings');
    const missingList = document.getElementById('modal-missing-list');
    missingList.innerHTML = '';
    let hasMissing = false;

    Object.keys(taskAchievementStatus).forEach(taskIdx => {
        const st = taskAchievementStatus[taskIdx];
        totalEarned += st.score;
        totalMax += st.total;

        if (st.unmetRules && st.unmetRules.length > 0) {
            hasMissing = true;
            st.unmetRules.forEach(rule => {
                const li = document.createElement('li');
                li.innerText = `[Task ${parseInt(taskIdx) + 1}] ${rule.scope} > ${rule.condition}`;
                missingList.appendChild(li);
            });
        }
    });

    if (hasMissing) {
        missingContainer.classList.remove('hidden');
    } else {
        missingContainer.classList.add('hidden');
    }

    const percent = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

    document.getElementById('modal-score-percent').innerText = `${percent}%`;
    document.getElementById('modal-score-detail').innerText = `${totalEarned} / ${totalMax} 点`;
    
    const msgEl = document.getElementById('modal-score-message');
    if (percent === 100) msgEl.innerText = '🎉 完璧です！全タスククリア！';
    else if (percent >= 70) msgEl.innerText = '👍 合格ライン！見落としをチェックしましょう。';
    else msgEl.innerText = '💪 もう一息！不足箇所を確認して再挑戦しましょう。';

    document.getElementById('sim-result-modal').classList.remove('hidden');

    // ★ プレビュー・閲覧モードでなければバックエンドへ成績を送信
    if (!isReadOnlyMode) {
        const q = simQuestions[currentQuestionIndex];
        
        // エンジンから最終的なコンフィグをプレーンテキストで抽出
        const finalConfigText = activeDevice.generateRunningConfig();

        const payload = [{
            workbookId: parseInt(workbookId),
            questionId: q.id,
            correct: (percent === 100),
            earnedScore: totalEarned,         // 獲得スコアを追加
            maxScore: totalMax,               // 満点スコアを追加
            userAnswerText: finalConfigText   // 最終コンフィグを追加
        }];

        try {
            // ★ 新しく作成したシミュレーション専用のAPIへ送信
            await fetch(`${API_BASE_URL}/sim-answer-history/submit`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn('履歴送信エラー:', e);
        }
    }
}

function nextQuestionAfterSubmit() {
    closeModal('sim-result-modal');
    if (currentQuestionIndex < simQuestions.length - 1) {
        showSimQuestion(currentQuestionIndex + 1);
    } else {
        alert('すべての問題が終了しました！メニューに戻ります。');
        goBack();
    }
}

function nextQuestion() { 
    if (confirm('現在の入力内容は破棄されます。次の問題へ進みますか？')) {
        if (currentQuestionIndex < simQuestions.length - 1) showSimQuestion(currentQuestionIndex + 1); 
    }
}

function prevQuestion() { 
    if (confirm('現在の入力内容は破棄されます。前の問題へ戻りますか？')) {
        if (currentQuestionIndex > 0) showSimQuestion(currentQuestionIndex - 1); 
    }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function goBack() { 
    if (urlParams.get('source') === 'local') {
        window.close();
        return;
    }
    window.location.href = `sim_menu.html?workbookId=${workbookId}${getExtraParams()}`; 
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}