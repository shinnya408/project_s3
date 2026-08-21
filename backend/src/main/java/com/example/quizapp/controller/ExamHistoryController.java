package com.example.quizapp.controller;

import com.example.quizapp.dto.ExamHistoryDto;
import com.example.quizapp.entity.ExamHistory;
import com.example.quizapp.repository.ExamHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/history")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ExamHistoryController {

    private final ExamHistoryRepository historyRepository;
    
    // ※ ログイン機能実装までの仮のユーザーID
    private final Long MOCK_USER_ID = 1L;

    // 履歴の保存 (POST /api/history)
    @PostMapping
    @Transactional
    public String saveHistory(@RequestBody ExamHistoryDto dto) {
        ExamHistory history = new ExamHistory();
        history.setUserId(MOCK_USER_ID);
        history.setWorkbookId(dto.getWorkbookId());
        history.setCorrectCount(dto.getCorrect());
        history.setTotalCount(dto.getTotal());
        history.setScorePercent(dto.getPercent());
        history.setQuestionsJson(dto.getQuestions());
        history.setAnswersJson(dto.getAnswers());
        history.setDeleted(false);
        
        historyRepository.save(history);
        return "{\"status\": \"success\"}";
    }

    // 履歴の取得 (GET /api/history?workbookId=1)
    @GetMapping
    public List<ExamHistoryDto> getHistory(@RequestParam Long workbookId) {
        List<ExamHistory> entities = historyRepository
                .findByUserIdAndWorkbookIdAndDeletedFalseOrderByCreateAtDesc(MOCK_USER_ID, workbookId);

        return entities.stream().map(e -> {
            ExamHistoryDto dto = new ExamHistoryDto();
            dto.setId(e.getId());
            dto.setWorkbookId(e.getWorkbookId());
            dto.setCorrect(e.getCorrectCount());
            dto.setTotal(e.getTotalCount());
            dto.setPercent(e.getScorePercent());
            dto.setDate(e.getCreateAt());
            dto.setQuestions(e.getQuestionsJson());
            dto.setAnswers(e.getAnswersJson());
            return dto;
        }).collect(Collectors.toList());
    }

    // 履歴の論理削除 (DELETE /api/history/{id})
    @DeleteMapping("/{id}")
    @Transactional
    public String deleteHistory(@PathVariable Long id) {
        historyRepository.findById(id).ifPresent(h -> {
            h.setDeleted(true);
            historyRepository.save(h);
        });
        return "{\"status\": \"success\"}";
    }
}