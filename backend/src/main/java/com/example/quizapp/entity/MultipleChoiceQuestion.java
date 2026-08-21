package com.example.quizapp.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Entity
@Table(name = "multiple_choice_question")
@Getter
@Setter
public class MultipleChoiceQuestion extends BaseEntity {

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String question;

    @Column(name = "question_image_url")
    private String questionImageUrl;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "explanation_image_url")
    private String explanationImageUrl;

    // 選択肢のテーブルと「1対多」で紐付ける設定
    @OneToMany(mappedBy = "questionEntity", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference // データの無限ループ（JSON変換エラー）を防ぐ魔法のアノテーション
    private List<MultipleChoiceOption> options;

    @Column(name = "category_major_id")
    private Long categoryMajorId;

    @Column(name = "category_medium_id")
    private Long categoryMediumId;

    @Column(name = "category_minor_id")
    private Long categoryMinorId;
}