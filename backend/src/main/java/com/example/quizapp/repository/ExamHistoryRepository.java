package com.example.quizapp.repository;

import com.example.quizapp.entity.ExamHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExamHistoryRepository extends JpaRepository<ExamHistory, Long> {
    
    // 削除されておらず、指定ユーザー・指定問題集の履歴を作成日時の新しい順に取得
    List<ExamHistory> findByUserIdAndWorkbookIdAndDeletedFalseOrderByCreateAtDesc(Long userId, Long workbookId);
}