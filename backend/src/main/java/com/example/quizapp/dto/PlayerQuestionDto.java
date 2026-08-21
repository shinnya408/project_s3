package com.example.quizapp.dto;

import lombok.Data;
import java.util.List;

@Data
public class PlayerQuestionDto {
    private Long id;
    private Long workbookId;
    private String question;
    private String questionImageUrl;
    private String explanation;
    private String explanationImageUrl;
    
    // カテゴリ連携用（必要に応じてMedium, Minorも追加可能）
    private Long categoryMajorId;
    private Long categoryMediumId;
    private Long categoryMinorId;
    
    private List<PlayerOptionDto> options;

    @Data
    public static class PlayerOptionDto {
        private Long id;
        private String text;
        private String imageUrl;
        private boolean isCorrect;
    }
}