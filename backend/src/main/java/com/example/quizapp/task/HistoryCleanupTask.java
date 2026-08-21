package com.example.quizapp.task;

import com.example.quizapp.repository.QuestionAnswerHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Component
@RequiredArgsConstructor
public class HistoryCleanupTask {

    private final QuestionAnswerHistoryRepository historyRepository;
    
    // 削除の基準となる月数（例：6ヶ月）
    private static final int DELETE_THRESHOLD_MONTHS = 12;

    /**
     * 毎日深夜3時に自動で実行されるメソッド
     * 最終アクセス（updateAt）が指定月数より古いデータを削除します。
     */
    @Scheduled(cron = "0 0 3 * * *") // 毎日AM3:00に実行
    @Transactional
    public void cleanupOldHistory() {
        OffsetDateTime thresholdDate = OffsetDateTime.now().minusMonths(DELETE_THRESHOLD_MONTHS);
        System.out.println("🧹 古い解答履歴の自動削除バッチを開始します。基準日: " + thresholdDate);
        
        historyRepository.deleteByUpdateAtBefore(thresholdDate);
        
        System.out.println("✅ 古い解答履歴の自動削除バッチが完了しました。");
    }
}