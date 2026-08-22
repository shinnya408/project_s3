// =====================================
// exam_filter.js
// =====================================
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

// ★ URLからターゲットIDやプレビューフラグを取得
const targetUserId = urlParams.get('targetUserId');
const targetUserName = urlParams.get('targetUserName');
const isPreviewMode = urlParams.get('preview') === 'true' || urlParams.get('mode') === 'preview';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // ★ プレビューモード・他人のデータ閲覧中は模試フィルタ画面に入れないようにブロック
    if (isPreviewMode || targetUserId) {
        alert('プレビューモード、または他ユーザーの成績確認中は「模試モード」を利用できません。');
        window.location.href = `player_menu?workbookId=${workbookId}`;
        return;
    }

    loadFilterData();
});

async function loadFilterData() {
    if (!workbookId) return;

    try {
        // ★ すべての fetch に { headers: getAuthHeaders() } を付与
        const [tagsRes, catRes, mcqRes, ddRes] = await Promise.all([
            fetch(`${API_BASE_URL}/tags?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/categories?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/questions/player?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false})),
            fetch(`${API_BASE_URL}/dd-questions?workbookId=${workbookId}`, { headers: getAuthHeaders() }).catch(()=>({ok:false}))
        ]);
        
        // --- タグの描画 ---
        const tagContainer = document.getElementById('tag-container');
        if (tagsRes.ok) {
            const tagData = await tagsRes.json();
            const tags = tagData.tags || [];
            tagContainer.innerHTML = '';
            if (tags.length === 0) {
                tagContainer.innerHTML = '<p style="color: var(--text-sub); font-size: 0.9em;">作成されたタグはありません。</p>';
            } else {
                tags.forEach(t => {
                    tagContainer.insertAdjacentHTML('beforeend', `
                        <label class="check-label"><input type="checkbox" name="tags" value="${t.id}"> # ${t.name}</label>
                    `);
                });
            }
        } else {
            tagContainer.innerHTML = '<p style="color: var(--danger); font-size: 0.9em;">通信エラー</p>';
        }

        // --- カテゴリの描画（大・中・小の階層アコーディオン化） ---
        const catContainer = document.getElementById('category-container');
        if (catRes.ok) {
            const categories = await catRes.json();
            const mcqData = mcqRes.ok ? await mcqRes.json() : [];
            const ddData = ddRes.ok ? await ddRes.json() : [];
            const allQuestions = [...mcqData, ...ddData];

            catContainer.innerHTML = '';
            
            if (categories.length === 0 && allQuestions.length === 0) {
                catContainer.innerHTML = '<p style="color: var(--text-sub); font-size: 0.9em;">データがありません。</p>';
                return;
            }

            const catNameMap = {};
            categories.forEach(c => catNameMap[c.id] = c.name);
            const getCatName = (id) => catNameMap[id] || `不明なカテゴリ (ID:${id})`;

            // 問題データからツリー構造を生成 (問題が登録されているカテゴリだけが抽出される)
            const tree = {};
            allQuestions.forEach(q => {
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

            // 直下にある問題のIDリストを生成する関数
            function buildQuestionHints(itemsArray) {
                if (!itemsArray || itemsArray.length === 0) return '';
                let html = '<div style="margin-left: 25px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; border-left: 2px solid var(--primary); padding-left: 10px;">';
                itemsArray.forEach(q => {
                    const snippet = q.question.length > 25 ? q.question.substring(0, 25) + '...' : q.question;
                    html += `<span style="font-size: 0.85em; color: var(--text-sub);">📄 ID:${q.id} ${snippet}</span>`;
                });
                html += '</div>';
                return html;
            }

            let catHtml = '';

            // 大項目の展開
            for (const majorId in tree) {
                const majorName = majorId === 'unclassified' ? '未分類 (カテゴリなし)' : getCatName(parseInt(majorId));
                const majorVal = majorId === 'unclassified' ? 'unclassified' : `major_${majorId}`;
                const majorNode = tree[majorId];

                catHtml += `
                <details style="background: rgba(59, 130, 246, 0.05); padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 12px;">
                    <summary style="cursor: pointer; font-weight: bold; outline: none; display: flex; align-items: center; gap: 8px; font-size: 1.05em;">
                        <input type="checkbox" name="categories" value="${majorVal}" onclick="event.stopPropagation();">
                        📁 ${majorName}
                    </summary>
                    <div class="category-indent" style="margin-top: 10px; padding-left: 15px; display: flex; flex-direction: column;">
                        ${buildQuestionHints(majorNode.items)}
                `;

                // 中項目の展開
                for (const mediumId in majorNode.subs) {
                    const mediumName = getCatName(parseInt(mediumId));
                    const mediumNode = majorNode.subs[mediumId];

                    catHtml += `
                    <details style="padding: 5px 0; border-left: 2px dashed var(--border); margin-left: 10px; padding-left: 10px; margin-bottom: 8px;">
                        <summary style="cursor: pointer; font-weight: bold; outline: none; display: flex; align-items: center; gap: 8px; color: var(--text-main);">
                            <input type="checkbox" name="categories" value="medium_${mediumId}" onclick="event.stopPropagation();">
                            📂 ${mediumName}
                        </summary>
                        <div class="category-indent" style="margin-top: 8px; padding-left: 10px; display: flex; flex-direction: column;">
                            ${buildQuestionHints(mediumNode.items)}
                    `;

                    // 小項目の展開
                    for (const minorId in mediumNode.subs) {
                        const minorName = getCatName(parseInt(minorId));
                        const minorNode = mediumNode.subs[minorId];

                        catHtml += `
                        <details style="padding: 5px 0; border-left: 2px dashed var(--border); margin-left: 10px; padding-left: 10px; margin-bottom: 5px;">
                            <summary style="cursor: pointer; font-weight: bold; outline: none; display: flex; align-items: center; gap: 8px; color: var(--text-sub);">
                                <input type="checkbox" name="categories" value="minor_${minorId}" onclick="event.stopPropagation();">
                                📃 ${minorName}
                            </summary>
                            <div class="category-indent" style="margin-top: 5px; padding-left: 10px; display: flex; flex-direction: column;">
                                ${buildQuestionHints(minorNode.items)}
                            </div>
                        </details>
                        `;
                    }
                    catHtml += `</div></details>`;
                }
                catHtml += `</div></details>`;
            }
            
            catContainer.insertAdjacentHTML('beforeend', catHtml);

        } else {
            catContainer.innerHTML = '<p style="color: var(--danger); font-size: 0.9em;">通信エラー</p>';
        }
    } catch (e) {
        console.error(e);
    }
}

function goBack() { 
    window.location.href = `player_menu?workbookId=${workbookId}`; 
}

function goToNext() {
    const checkedStatuses = Array.from(document.querySelectorAll('input[name="status"]:checked')).map(cb => cb.value);
    if (checkedStatuses.length === 0) { 
        alert('対象ステータスを少なくとも1つ選択してください。'); 
        return; 
    }

    const checkedTags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => parseInt(cb.value));
    const checkedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(cb => cb.value);

    const filterConfig = {
        order: document.getElementById('filter-order').value,
        hash: document.getElementById('filter-hash').value.trim(),
        statuses: checkedStatuses,
        tags: checkedTags,
        categories: checkedCategories
    };

    sessionStorage.setItem('examFilterConfig', JSON.stringify(filterConfig));
    window.location.href = `exam_options?workbookId=${workbookId}`;
}