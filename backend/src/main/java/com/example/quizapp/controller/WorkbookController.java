package com.example.quizapp.controller;

import com.example.quizapp.entity.Workbook;
import com.example.quizapp.repository.WorkbookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workbooks")
@RequiredArgsConstructor
public class WorkbookController {

    private final WorkbookRepository workbookRepository;

    // 問題集一覧を返すAPI
    @GetMapping
    public List<Workbook> getAllWorkbooks() {
        // ★ 修正: ID順に並べたものを取得するメソッドに変更
        return workbookRepository.findByDeletedFalseOrderByIdAsc();
    }

    @PostMapping
    public String createWorkbook(@RequestBody com.example.quizapp.entity.Workbook workbook) {
        workbook.setDeleted(false);
        workbookRepository.save(workbook);
        return "{\"status\": \"success\"}";
    }
}