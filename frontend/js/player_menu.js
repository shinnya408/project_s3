// =====================================
// player_menu.js
// =====================================
const urlParams = new URLSearchParams(window.location.search);
const workbookId = urlParams.get('workbookId');

// ページ読み込み時に実行（テーマ復元と問題集IDチェック）
document.addEventListener('DOMContentLoaded', async () => {
    // 1. テーマの初期化
    initTheme();

    if (!workbookId) {
        alert('問題集が指定されていません。');
        window.location.href = 'index.html';
        return;
    }

    const targetUserId = urlParams.get('targetUserId');
    const targetUserName = urlParams.get('targetUserName');
    const isPreview = urlParams.get('mode') === 'preview' || urlParams.get('preview') === 'true';

    // ★ 追加：問題集の名前をAPIから取得してタイトルにセットする
    let workbookName = `問題集 (ID: ${workbookId})`; // 取得できなかった場合のデフォルト表示
    try {
        const wbRes = await fetch(`${API_BASE_URL}/workbooks`, { headers: getAuthHeaders() });
        if (wbRes.ok) {
            const workbooks = await wbRes.json();
            const wb = workbooks.find(w => String(w.id) === String(workbookId));
            if (wb && wb.name) {
                workbookName = wb.name;
            }
        }
    } catch (e) {
        console.warn("問題集の名前の取得に失敗しました", e);
    }

    // ★ 修正：取得した問題集のタイトルを含めて、画面上部のタイトルを書き換える
    if (targetUserId) {
        document.getElementById('workbook-title').innerText = `📊 ${targetUserName} さんの成績確認 - ${workbookName}`;
    } else if (isPreview) {
        document.getElementById('workbook-title').innerText = `👀 ${workbookName} [プレビュー中]`;
    } else {
        document.getElementById('workbook-title').innerText = `${workbookName} のメニュー`;
    }

    const loadingElement = document.getElementById('loading');

    try {
        let questions = [];

        // 3. バックエンドAPIから最新の問題データの取得を試みる
        try {
            const response = await fetch(`${API_BASE_URL}/questions/player?workbookId=${workbookId}`, { headers: getAuthHeaders() });
            if (response.ok) {
                questions = await response.json();
                localStorage.setItem(`questions_${workbookId}`, JSON.stringify(questions));
                console.log('✅ サーバーから最新の問題データを同期しました');
            } else {
                console.warn('⚠️ サーバーからエラーが返されました。ローカルのキャッシュを使用します。');
                questions = JSON.parse(localStorage.getItem(`questions_${workbookId}`)) || [];
            }
        } catch (fetchError) {
            console.warn('🔌 オフライン、またはサーバーに接続できません。ローカルのキャッシュを使用します。');
            questions = JSON.parse(localStorage.getItem(`questions_${workbookId}`)) || [];
        }
        
        if (!questions || questions.length === 0) {
            questions = [];
            localStorage.setItem(`questions_${workbookId}`, JSON.stringify(questions));
        }

        if (!targetUserId && !isPreview) {
            const saveKey = `exam_progress_${workbookId}`;
            if (localStorage.getItem(saveKey)) {
                if (confirm('中断された模試のデータがあります。途中から再開しますか？\n（「キャンセル」を押すとデータは保持したままメニューを見ることができます）')) {
                    window.location.href = `exam_player.html?workbookId=${workbookId}`;
                }
            }
        }
    } catch (error) {
        console.error('データの読み込み中にエラーが発生しました:', error);
    } finally {
        if (loadingElement) {
            loadingElement.style.opacity = '0';
            setTimeout(() => {
                loadingElement.style.display = 'none';
            }, 300);
        }
    }
});

function goToMode(targetMode) {
    if (!workbookId) return;

    // クリック時にも最新のパラメータを取得
    const currentParams = new URLSearchParams(window.location.search);
    const targetUserId = currentParams.get('targetUserId');
    const targetUserName = currentParams.get('targetUserName');
    const isPreview = currentParams.get('mode') === 'preview' || currentParams.get('preview') === 'true';

    if ((targetUserId || isPreview) && targetMode === 'exam') {
        alert('プレビューモード、または他ユーザーの成績確認中は「模試モード」を利用できません。');
        return;
    }

    // パラメータの引き継ぎ文字列を作成
    let extraParams = '';
    if (targetUserId) extraParams += `&targetUserId=${targetUserId}&targetUserName=${encodeURIComponent(targetUserName || '')}`;
    if (isPreview) extraParams += `&preview=true`;

    if (targetMode === 'practice') {
        window.location.href = `quiz.html?workbookId=${workbookId}&mode=practice${extraParams}`;
    } 
    else if (targetMode === 'exam') {
        const saveKey = `exam_progress_${workbookId}`;
        if (localStorage.getItem(saveKey)) {
            if (confirm('中断された模試のデータがあります。途中から再開しますか？\n（「キャンセル」を押すと過去のデータを破棄して新しく開始します）')) {
                window.location.href = `exam_player.html?workbookId=${workbookId}`;
                return;
            } else {
                localStorage.removeItem(saveKey);
            }
        }
        window.location.href = `exam_filter.html?workbookId=${workbookId}`;
    }
    else if (targetMode === 'favorite') {
        window.location.href = `favorite_filter.html?workbookId=${workbookId}${extraParams}`;
    }
    else if (targetMode === 'stats') {
        window.location.href = `player_stats.html?workbookId=${workbookId}${extraParams}`;
    }
    else if (targetMode === 'history') {
        window.location.href = `exam_history.html?workbookId=${workbookId}${extraParams}`;
    }
}