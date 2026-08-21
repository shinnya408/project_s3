package com.example.quizapp.repository;

import com.example.quizapp.entity.QuestionAnswerHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionAnswerHistoryRepository extends JpaRepository<QuestionAnswerHistory, Long> {
    Optional<QuestionAnswerHistory> findByUserIdAndQuestionIdAndQuestionFormat(Long userId, Long questionId, String format);
    List<QuestionAnswerHistory> findByUserIdAndWorkbookId(Long userId, Long workbookId);
    void deleteByUpdateAtBefore(OffsetDateTime targetDate);
    
    // ★ 追加：ユーザー削除時に履歴も一括削除するためのメソッド
    void deleteByUserId(Long userId);
}