// player_stats.js
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
const isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';

let allQuestionsCache = [];
let historyMapCache = {};
let categoryListCache = [];
let userTagsCache = [];
let questionTagsCache = {};

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
            titleEl.innerText = `📊 ${targetUserName} さんの成績`;
        }
    }

    loadRealStats();
});

async function loadRealStats() {
    try {
        let historyUrl = `${API_BASE_URL}/answer-history/summary?workbookId=${workbookId}`;
        if (targetUserId) historyUrl += `&targetUserId=${targetUserId}`;

        let tagsUrl = `${API_BASE_URL}/tags?workbookId=${workbookId}`;
        if (targetUserId) tagsUrl += `&targetUserId=${targetUserId}`;

        const [historyRes, mcqRes, ddRes, categoriesRes, tagsRes] = await Promise.all([
            fetch(historyUrl, { headers: getAuthHeaders() }),
            fetch(`${API_BASE_URL}/questions/player?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/dd-questions?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/categories?workbookId=${workbookId}`, { headers: getAuthHeaders() }),
            fetch(tagsUrl, { headers: getAuthHeaders() }).catch(()=>({ok:false}))
        ]);

        if (!historyRes.ok || !categoriesRes.ok) throw new Error('データ取得エラー');

        const histories = await historyRes.json();
        const categories = await categoriesRes.json();

        const mcqData = mcqRes.ok ? await mcqRes.json() : [];
        const ddData = ddRes.ok ? await ddRes.json() : [];
        const mappedMcq = mcqData.map(q => ({ ...q, format: 'mcq' }));
        const mappedDd = ddData.map(q => ({ ...q, format: 'dd' }));
        const questions = [...mappedMcq, ...mappedDd]; 

        if (tagsRes.ok) {
            const tagData = await tagsRes.json();
            userTagsCache = tagData.tags || [];
            questionTagsCache = tagData.questionTags || {};
        } else {
            userTagsCache = JSON.parse(localStorage.getItem(`user_tags_${workbookId}`)) || [];
            questionTagsCache = JSON.parse(localStorage.getItem(`question_tags_${workbookId}`)) || {};
        }

        allQuestionsCache = questions; 
        categoryListCache = categories;

        const overallStats = { red: 0, yellow: 0, goal: 0, hat: 0, bench: 0 };
        
        const catStatsMap = {
            'unclassified': { id: 'unclassified', name: '未分類 (カテゴリなし)', stats: { red: 0, yellow: 0, goal: 0, hat: 0, bench: 0 } }
        }; 
        categories.forEach(c => {
            catStatsMap[c.id] = { id: c.id, name: c.name, stats: { red: 0, yellow: 0, goal: 0, hat: 0, bench: 0 } };
        });
        
        const tagStatsMap = {};
        userTagsCache.forEach(t => {
            tagStatsMap[t.id] = { id: t.id, name: `# ${t.name}`, stats: { red: 0, yellow: 0, goal: 0, hat: 0, bench: 0 } };
        });

        historyMapCache = {};
        histories.forEach(h => {
            const key = h.questionFormat + '_' + h.questionId;
            historyMapCache[key] = JSON.parse(h.historyJson);
        });

        let totalAnswers = 0;

        questions.forEach(q => {
            const key = q.format + '_' + q.id;
            const hArr = historyMapCache[key];
            const status = determineStatus(hArr);
            
            if (hArr) {
                totalAnswers += hArr.length;
            }

            overallStats[status]++;

            const catId = q.categoryMajorId ? q.categoryMajorId : 'unclassified';
            if (catStatsMap[catId]) {
                catStatsMap[catId].stats[status]++;
            }

            // ★ 修正：q.id 単体ではなく複合キー (key) を使ってタグを取得する
            const tagsForQ = questionTagsCache[key] || [];
            tagsForQ.forEach(tId => {
                if (tagStatsMap[tId]) {
                    tagStatsMap[tId].stats[status]++;
                }
            });
        });

        const streak = calculateStreak(histories);

        document.getElementById('streak-days').innerText = `${streak} 日`;
        document.getElementById('total-answers').innerText = `${totalAnswers.toLocaleString()} 問`;

        renderStatBar('overall-stats-container', '総合ステータス', overallStats, false, 'overall', null);
        
        const categoryContainer = document.getElementById('category-stats-container');
        categoryContainer.innerHTML = '';
        Object.values(catStatsMap).forEach(cat => {
            if (cat.stats.red + cat.stats.yellow + cat.stats.goal + cat.stats.hat + cat.stats.bench > 0) {
                renderStatBar(categoryContainer, cat.name, cat.stats, true, 'category', cat.id);
            }
        });

        const tagContainer = document.getElementById('tag-stats-container');
        tagContainer.innerHTML = '';
        Object.values(tagStatsMap).forEach(tag => {
            if (tag.stats.red + tag.stats.yellow + tag.stats.goal + tag.stats.hat + tag.stats.bench > 0) {
                renderStatBar(tagContainer, tag.name, tag.stats, true, 'tag', tag.id);
            }
        });

    } catch (e) {
        console.error(e);
        document.getElementById('overall-stats-container').innerHTML = 
            '<p style="color: red;">成績データの取得に失敗しました。サーバーの接続を確認してください。</p>';
    }
}

function determineStatus(historyArr) {
    if (!historyArr || historyArr.length === 0) return 'bench';
    const len = historyArr.length;
    if (len >= 3 && historyArr[len-1] && historyArr[len-2] && historyArr[len-3]) return 'hat';
    if (historyArr[len-1] === true) return 'goal';
    if (len >= 2 && !historyArr[len-1] && !historyArr[len-2]) return 'red';
    return 'yellow';
}

function toYYYYMMDD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function calculateStreak(histories) {
    if (histories.length === 0) return 0;
    const dates = new Set();
    histories.forEach(h => {
        if(h.updateAt) dates.add(toYYYYMMDD(new Date(h.updateAt)));
    });
    
    let streak = 0;
    let checkDate = new Date();
    
    if (!dates.has(toYYYYMMDD(checkDate))) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (!dates.has(toYYYYMMDD(checkDate))) return 0;
    }
    
    while (dates.has(toYYYYMMDD(checkDate))) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
}

function renderStatBar(containerElementOrId, title, statsObj, enableWeaknessCheck = false, type = 'overall', targetId = null) {
    const container = typeof containerElementOrId === 'string' ? document.getElementById(containerElementOrId) : containerElementOrId;
    const total = statsObj.red + statsObj.yellow + statsObj.goal + statsObj.hat + statsObj.bench;
    if (total === 0) return; 

    const wrapper = document.createElement('div');
    wrapper.className = 'stat-bar-wrapper';

    let weaknessBtn = '';
    if (enableWeaknessCheck && total > 0) {
        const weakPercent = ((statsObj.red + statsObj.yellow) / total) * 100;
        if (weakPercent >= 40) {
            const safeTargetId = typeof targetId === 'string' ? `'${targetId}'` : targetId;
            weaknessBtn = `<button class="btn-weakness" onclick="startWeaknessMode('${title}', '${type}', ${safeTargetId})">⚠️ 弱点克服テスト</button>`;
        }
    }

    const header = document.createElement('div');
    header.className = 'stat-bar-header';
    header.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span class="stat-title">${title}</span>
            ${weaknessBtn}
        </div>
        <span class="stat-total">全 ${total} 問</span>
    `;
    wrapper.appendChild(header);

    const bar = document.createElement('div');
    bar.className = 'stat-bar';

    const segments = [
        { key: 'red', class: 'bg-red', label: '🟥 レッドカード' },
        { key: 'yellow', class: 'bg-yellow', label: '🟨 イエローカード' },
        { key: 'goal', class: 'bg-goal', label: '⚽ ゴール' },
        { key: 'hat', class: 'bg-hat', label: '🎩 ハットトリック' },
        { key: 'bench', class: 'bg-bench', label: '🪑 ベンチ (未着手)' }
    ];

    segments.forEach(seg => {
        const count = statsObj[seg.key];
        if (count > 0) {
            const percent = ((count / total) * 100).toFixed(1);
            const segmentDiv = document.createElement('div');
            segmentDiv.className = `stat-segment ${seg.class}`;
            segmentDiv.style.width = `${percent}%`;
            
            const tooltipText = `${seg.label}<br><span style="font-size:1.2em; font-weight:900;">${count} 問</span> (${percent}%)`;
            attachTooltipEvents(segmentDiv, tooltipText);

            bar.appendChild(segmentDiv);
        }
    });

    wrapper.appendChild(bar);
    container.appendChild(wrapper);
}

function startWeaknessMode(title, type, idParam) {
    const weaknessKeys = [];

    allQuestionsCache.forEach(q => {
        const key = `${q.format}_${q.id}`;
        const status = determineStatus(historyMapCache[key]);
        
        if (status === 'red' || status === 'yellow') {
            if (type === 'category') {
                const catId = q.categoryMajorId ? q.categoryMajorId : 'unclassified';
                if (String(catId) === String(idParam)) {
                    weaknessKeys.push(key); 
                }
            } 
            else if (type === 'tag') {
                // ★ 修正：ここでも複合キー (key) を使ってタグを取得する
                const tagsForQ = questionTagsCache[key] || [];
                if (tagsForQ.some(t => String(t) === String(idParam))) {
                    weaknessKeys.push(key); 
                }
            }
        }
    });

    if (weaknessKeys.length === 0) {
        alert(`「${title}」には弱点問題（レッド・イエローカード）が見つかりませんでした！`);
        return;
    }

    if (confirm(`「${title}」の弱点問題（レッド・イエロー）${weaknessKeys.length} 問を集中的に特訓しますか？`)) {
        sessionStorage.setItem('weaknessQuestionKeys', JSON.stringify(weaknessKeys));
        
        let url = `quiz.html?workbookId=${workbookId}&mode=weakness`;
        if (targetUserId) url += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName)}`;
        if (isPreviewMode) url += `&preview=true`;
        
        window.location.href = url;
    }
}

function attachTooltipEvents(element, text) {
    const tooltip = document.getElementById('stats-tooltip');
    element.addEventListener('mousemove', (e) => {
        tooltip.innerHTML = text;
        tooltip.style.left = e.clientX + 'px';
        tooltip.style.top = e.clientY + 'px';
        tooltip.classList.remove('hidden');
    });
    element.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    
    element.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        tooltip.innerHTML = text;
        tooltip.style.left = touch.clientX + 'px';
        tooltip.style.top = touch.clientY + 'px';
        tooltip.classList.remove('hidden');
    }, { passive: true });
}

document.addEventListener('touchstart', (e) => {
    if (!e.target.classList.contains('stat-segment')) {
        const tooltip = document.getElementById('stats-tooltip');
        if(tooltip) tooltip.classList.add('hidden');
    }
}, { passive: true });

function goBack() { 
    let url = `player_menu.html?workbookId=${workbookId}`;
    if (targetUserId) url += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName)}`;
    if (isPreviewMode) url += `&preview=true`;
    
    window.location.href = url;
}