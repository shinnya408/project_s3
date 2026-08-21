package com.example.quizapp.repository;

import com.example.quizapp.entity.SimTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SimTaskRepository extends JpaRepository<SimTask, Long> {
    List<SimTask> findBySimQuestionIdOrderBySequenceAsc(Long simQuestionId);
    void deleteBySimQuestionId(Long simQuestionId);
}