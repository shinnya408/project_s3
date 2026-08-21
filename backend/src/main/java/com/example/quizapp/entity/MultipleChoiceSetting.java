package com.example.quizapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "multiple_choice_setting")
public class MultipleChoiceSetting extends BaseEntity {

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;

    @Column(name = "time_limite_second", nullable = false)
    private Integer timeLimiteSecond;

    // Getters and Setters
    public Long getWorkbookId() { return workbookId; }
    public void setWorkbookId(Long workbookId) { this.workbookId = workbookId; }

    public Integer getQuestionCount() { return questionCount; }
    public void setQuestionCount(Integer questionCount) { this.questionCount = questionCount; }

    public Integer getTimeLimiteSecond() { return timeLimiteSecond; }
    public void setTimeLimiteSecond(Integer timeLimiteSecond) { this.timeLimiteSecond = timeLimiteSecond; }
}