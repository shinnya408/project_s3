package com.example.quizapp.repository;
import com.example.quizapp.entity.DdQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DdQuestionRepository extends JpaRepository<DdQuestion, Long> {
    List<DdQuestion> findByWorkbookIdAndDeletedFalseOrderByIdAsc(Long workbookId);
}