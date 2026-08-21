package com.example.quizapp.repository;

import com.example.quizapp.entity.UserTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserTagRepository extends JpaRepository<UserTag, Long> {
    List<UserTag> findByUserIdAndWorkbookIdOrderByIdAsc(Long userId, Long workbookId);
}