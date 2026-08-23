package com.example.quizapp.controller;

import com.example.quizapp.entity.MultipleChoiceQuestion;
import com.example.quizapp.repository.QuestionRepository;
import com.example.quizapp.dto.QuestionSaveRequest; 
import com.example.quizapp.dto.PlayerQuestionDto;
import com.example.quizapp.service.QuestionService; 


import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;


@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionRepository questionRepository;
    // ★ サービス層（処理の心臓部）を注入
    private final QuestionService questionService; 

    @GetMapping
    public List<MultipleChoiceQuestion> getQuestionsByWorkbookId(@RequestParam Long workbookId) {
        return questionRepository.findByWorkbookIdAndDeletedFalse(workbookId);
    }

    // ★ 以下のPOSTメソッドを丸ごと追記
    // 問題を保存・更新するAPI (POST /api/questions/bulk)
    @PostMapping("/bulk")
    public String saveQuestions(@RequestBody List<QuestionSaveRequest> requests) {
        // 実際の保存処理は Service クラスに任せる
        questionService.saveQuestions(requests);
        return "{\"status\": \"success\"}"; // 成功したらJSONでsuccessを返す
    }

    // 問題の論理削除 API (DELETE /api/questions/{id})
    @DeleteMapping("/{id}")
    public String deleteQuestion(@PathVariable Long id) {
        questionRepository.findById(id).ifPresent(q -> {
            q.setDeleted(true);
            questionRepository.save(q);
        });
        return "{\"status\": \"success\"}";
    }

    @GetMapping("/player")
    public List<PlayerQuestionDto> getPlayerQuestions(@RequestParam Long workbookId) {
        return questionService.getQuestionsForPlayer(workbookId);
    }
}