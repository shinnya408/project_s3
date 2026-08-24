package com.example.quizapp.repository;

import com.example.quizapp.entity.MultipleChoiceQuestion;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<MultipleChoiceQuestion, Long> {
    
    // ★ 修正：@EntityGraph を追加して、問題取得時に選択肢(options)も1回の通信でまとめて取得する（N+1問題の解消）
    @EntityGraph(attributePaths = {"options"})
    List<MultipleChoiceQuestion> findByWorkbookIdAndDeletedFalse(Long workbookId);
}