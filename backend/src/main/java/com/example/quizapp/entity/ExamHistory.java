package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "exam_history")
@Getter
@Setter
public class ExamHistory extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Long userId; // ※将来のログイン機能用。今回は 1 を固定で入れます

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(name = "correct_count", nullable = false)
    private Integer correctCount;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount;

    @Column(name = "score_percent", nullable = false)
    private Integer scorePercent;

    // 問題データと解答データをそのままJSON文字列として保存する
    @Column(name = "questions_json", columnDefinition = "TEXT", nullable = false)
    private String questionsJson;

    @Column(name = "answers_json", columnDefinition = "TEXT", nullable = false)
    private String answersJson;
}