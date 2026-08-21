package com.example.quizapp.repository;

import com.example.quizapp.entity.Workbook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WorkbookRepository extends JpaRepository<Workbook, Long> {
    // 削除フラグ(deleted)がfalseのものだけを取得するメソッド
    List<Workbook> findByDeletedFalse();
}