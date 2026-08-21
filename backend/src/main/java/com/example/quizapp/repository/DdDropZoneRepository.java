package com.example.quizapp.repository;
import com.example.quizapp.entity.DdDropZone;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DdDropZoneRepository extends JpaRepository<DdDropZone, Long> {
    List<DdDropZone> findByDdQuestionIdOrderBySequenceAsc(Long ddQuestionId);
    void deleteByDdQuestionId(Long ddQuestionId); // 再編集用
}