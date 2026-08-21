package com.example.quizapp.dto;

import lombok.Data;

@Data
public class MultipleChoiceSettingRequest {
    private Long workbookId;
    private Integer questionCount;
    private Integer timeLimiteSecond;
}