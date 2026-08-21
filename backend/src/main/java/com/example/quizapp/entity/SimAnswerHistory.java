package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "sim_answer_history")
public class SimAnswerHistory extends BaseEntity {

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long workbookId;

    @Column(nullable = false)
    private Long simQuestionId;

    @Column(nullable = false)
    private boolean correct; // 満点の場合は true

    private Integer earnedScore; // 獲得スコア
    private Integer maxScore;    // 満点スコア

    @Column(columnDefinition = "TEXT")
    private String userAnswerText; // 提出時の最終コンフィグ(テキスト)
}