package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;

@Entity
@Table(name = "question_tag_relation", uniqueConstraints = {
    // ★ 修正：question_format をユニーク制約に追加
    @UniqueConstraint(name = "uq_user_question_tag_format", columnNames = {"user_id", "question_id", "tag_id", "question_format"})
})
@Getter
@Setter
public class QuestionTagRelation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    // ★ 追加：問題形式を保存するカラム
    @Column(name = "question_format", nullable = false)
    private String questionFormat;

    @Column(name = "tag_id", nullable = false)
    private Long tagId;

    @Column(name = "create_at", nullable = false, updatable = false)
    private OffsetDateTime createAt;

    @PrePersist
    protected void onCreate() {
        this.createAt = OffsetDateTime.now();
    }
}