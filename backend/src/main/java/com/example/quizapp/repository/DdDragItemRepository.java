package com.example.quizapp.repository;
import com.example.quizapp.entity.DdDragItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DdDragItemRepository extends JpaRepository<DdDragItem, Long> {
    List<DdDragItem> findByDdQuestionIdOrderByIdAsc(Long ddQuestionId);
    void deleteByDdQuestionId(Long ddQuestionId);
}