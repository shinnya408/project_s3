package com.example.quizapp.dto;

import lombok.Data;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

@Data // Lombokのアノテーション。getter/setterを自動生成します
public class QuestionSaveRequest {
    private Long id; // 新規作成時はnull
    private Long workbookId;
    
    // カテゴリー
    private Long categoryMajorId;
    private Long categoryMediumId;
    private Long categoryMinorId;
    
    // 問題内容
    private String question;
    private String questionImageUrl;
    private String explanation;
    private String explanationImageUrl;
    
    // 選択肢のリスト
    private List<OptionDto> options;

    @Data
    public static class OptionDto {
        private Long id; // 新規追加時はnull
        private String text;
        private String imageUrl;

        // アノテーションを追加して、JSONのキー名を強制的に指定する
        @JsonProperty("isCorrect")
        private boolean isCorrect;
    }
}