package com.example.quizapp.repository;

import com.example.quizapp.entity.MultipleChoiceQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<MultipleChoiceQuestion, Long> {
    // workbookId を指定して、削除されていない問題一覧を取得するメソッド
    List<MultipleChoiceQuestion> findByWorkbookIdAndDeletedFalse(Long workbookId);
}