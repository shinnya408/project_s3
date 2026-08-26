package com.example.quizapp.repository;

import com.example.quizapp.entity.SimRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SimRuleRepository extends JpaRepository<SimRule, Long> {
    List<SimRule> findBySimTaskIdOrderByIdAsc(Long simTaskId);
    void deleteBySimTaskId(Long simTaskId);
    List<SimRule> findBySimTaskIdInOrderByIdAsc(List<Long> simTaskIds);
}