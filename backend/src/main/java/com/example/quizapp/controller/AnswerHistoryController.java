package com.example.quizapp.controller;

import com.example.quizapp.entity.QuestionAnswerHistory;
import com.example.quizapp.repository.QuestionAnswerHistoryRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/answer-history")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AnswerHistoryController {

    private final QuestionAnswerHistoryRepository historyRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/submit")
    @Transactional
    public String submitAnswers(
            @RequestBody List<AnswerSubmitRequest> requests,
            @RequestHeader("X-User-Id") Long userId) { // ★ 仮IDを廃止しヘッダーから取得
        
        for (AnswerSubmitRequest req : requests) {
            Optional<QuestionAnswerHistory> existingOpt = historyRepository
                    .findByUserIdAndQuestionIdAndQuestionFormat(userId, req.getQuestionId(), req.getFormat());

            QuestionAnswerHistory history;
            List<Boolean> recentResults = new ArrayList<>();

            try {
                if (existingOpt.isPresent()) {
                    history = existingOpt.get();
                    recentResults = objectMapper.readValue(history.getHistoryJson(), new TypeReference<List<Boolean>>(){});
                } else {
                    history = new QuestionAnswerHistory();
                    history.setUserId(userId);
                    history.setWorkbookId(req.getWorkbookId());
                    history.setQuestionId(req.getQuestionId());
                    history.setQuestionFormat(req.getFormat());
                    history.setDeleted(false);
                }

                recentResults.add(req.isCorrect());
                if (recentResults.size() > 5) recentResults.remove(0);

                history.setHistoryJson(objectMapper.writeValueAsString(recentResults));
                historyRepository.save(history);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return "{\"status\": \"success\"}";
    }

    @GetMapping("/summary")
    public List<QuestionAnswerHistory> getSummary(
            @RequestParam Long workbookId,
            @RequestParam(required = false) Long targetUserId,
            @RequestHeader("X-User-Id") Long loginUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String role) {
        
        // ★ 管理者・マネージャーでターゲットが指定されていれば、そのユーザーのIDを使用
        Long fetchUserId = (targetUserId != null && ("ADMIN".equals(role) || "MANAGER".equals(role))) 
                ? targetUserId : loginUserId;

        return historyRepository.findByUserIdAndWorkbookId(fetchUserId, workbookId);
    }
}

@Data
class AnswerSubmitRequest {
    private Long workbookId;
    private Long questionId;
    private String format;
    private boolean correct;
}