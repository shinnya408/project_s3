package com.example.quizapp.repository;

import com.example.quizapp.entity.SimAnswerHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SimAnswerHistoryRepository extends JpaRepository<SimAnswerHistory, Long> {
    // 特定ユーザー・問題集の履歴を取得するためのメソッド
    List<SimAnswerHistory> findByUserIdAndWorkbookIdAndDeletedFalseOrderByCreateAtDesc(Long userId, Long workbookId);
}