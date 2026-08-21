package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;

@Entity
@Table(name = "question_answer_history", uniqueConstraints = {
    // ★ 修正：question_format をユニーク制約に追加
    @UniqueConstraint(name = "uq_user_question_format", columnNames = {"user_id", "question_id", "question_format"})
})
@Getter
@Setter
public class QuestionAnswerHistory extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    // ★ 追加：問題形式を保存するカラム
    @Column(name = "question_format", nullable = false)
    private String questionFormat;

    @Column(name = "history_json", columnDefinition = "TEXT", nullable = false)
    private String historyJson;

    @Column(name = "update_at", nullable = false)
    private OffsetDateTime updateAt;

    @PrePersist
    @Override
    protected void onCreate() {
        super.onCreate();
        this.updateAt = OffsetDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateAt = OffsetDateTime.now();
    }
}