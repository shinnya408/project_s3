package com.example.quizapp.repository;

import com.example.quizapp.entity.Changelog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ChangelogRepository extends JpaRepository<Changelog, Long> {
    List<Changelog> findTop20ByDeletedFalseOrderByCreateAtDesc();
}