package com.example.quizapp.controller;

import com.example.quizapp.entity.SimAnswerHistory;
import com.example.quizapp.repository.SimAnswerHistoryRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sim-answer-history")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimAnswerHistoryController {

    private final SimAnswerHistoryRepository simAnswerHistoryRepository;

    @PostMapping("/submit")
    public Map<String, String> submitSimAnswer(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody List<SimAnswerSubmitReq> requests) {

        for (SimAnswerSubmitReq req : requests) {
            SimAnswerHistory history = new SimAnswerHistory();
            history.setUserId(userId);
            history.setWorkbookId(req.getWorkbookId());
            history.setSimQuestionId(req.getQuestionId());
            history.setCorrect(req.isCorrect());
            history.setEarnedScore(req.getEarnedScore());
            history.setMaxScore(req.getMaxScore());
            history.setUserAnswerText(req.getUserAnswerText());
            
            simAnswerHistoryRepository.save(history);
        }

        return Map.of("status", "success");
    }

    // ★ 以下のGETメソッドをクラス内に追加してください
    @GetMapping
    public List<SimAnswerHistory> getSimHistory(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam Long workbookId) {
        
        // ユーザーIDと問題集IDに一致する履歴を新しい順に取得
        return simAnswerHistoryRepository.findByUserIdAndWorkbookIdAndDeletedFalseOrderByCreateAtDesc(userId, workbookId);
    }
}

@Data
class SimAnswerSubmitReq {
    private Long workbookId;
    private Long questionId;
    private boolean correct;
    private Integer earnedScore;
    private Integer maxScore;
    private String userAnswerText;
}