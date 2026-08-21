package com.example.quizapp.repository;

import com.example.quizapp.entity.QuestionTagRelation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionTagRelationRepository extends JpaRepository<QuestionTagRelation, Long> {
    List<QuestionTagRelation> findByUserIdAndTagIdIn(Long userId, List<Long> tagIds);
    // ★ 修正：Formatを含めて削除する
    void deleteByUserIdAndQuestionIdAndQuestionFormat(Long userId, Long questionId, String format);
}