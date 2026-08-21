package com.example.quizapp.repository;

import com.example.quizapp.entity.QuestionCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionCategoryRepository extends JpaRepository<QuestionCategory, Long> {
    List<QuestionCategory> findByWorkbookIdAndDeletedFalseOrderBySequenceAsc(Long workbookId);
    
    // ★ 以下の一行を追加（削除済みも含めて全件取得する用）
    List<QuestionCategory> findByWorkbookId(Long workbookId);
}