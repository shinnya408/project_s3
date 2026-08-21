package com.example.quizapp.repository;

import com.example.quizapp.entity.SimQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SimQuestionRepository extends JpaRepository<SimQuestion, Long> {
    // 削除されていない特定の問題集のシミュレーション問題を取得する
    List<SimQuestion> findByWorkbookIdAndDeletedFalseOrderByIdAsc(Long workbookId);
}