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


    // 問題集一覧を返すAPI (GET /api/workbooks)
    @GetMapping
    public List<Workbook> getAllWorkbooks() {
        return workbookRepository.findByDeletedFalse();
    }

    @PostMapping
    public String createWorkbook(@RequestBody com.example.quizapp.entity.Workbook workbook) {
        workbook.setDeleted(false);
        workbookRepository.save(workbook);
        return "{\"status\": \"success\"}";
    }
}