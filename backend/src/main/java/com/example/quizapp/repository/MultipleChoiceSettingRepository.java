package com.example.quizapp.repository;

import com.example.quizapp.entity.MultipleChoiceSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MultipleChoiceSettingRepository extends JpaRepository<MultipleChoiceSetting, Long> {
    // 問題集IDを条件に、削除フラグがfalseのものを1件取得する
    Optional<MultipleChoiceSetting> findByWorkbookIdAndDeletedFalse(Long workbookId);
}