package com.example.quizapp.dto;

import lombok.Data;
import java.util.List;

@Data
public class SimQuestionDto {
    private Long id;
    private Long workbookId;
    private String question;
    private String questionImageUrl;
    private Long categoryMajorId;
    private Long categoryMediumId;
    private Long categoryMinorId;
    private String initialConfig;
    private List<SimTaskDto> tasks;

    @Data
    public static class SimTaskDto {
        private Long id;
        private Integer sequence;
        private String instruction;
        private String explanation;
        private List<SimRuleDto> rules;
    }

    @Data
    public static class SimRuleDto {
        private Long id;
        private String scope;
        private String condition;
        private Integer score;
    }
}