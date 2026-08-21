package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dd_question")
@Getter
@Setter
public class DdQuestion extends BaseEntity {

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(name = "question_image_url", columnDefinition = "TEXT")
    private String questionImageUrl;

    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "explanation_image_url", columnDefinition = "TEXT")
    private String explanationImageUrl;

    @Column(name = "category_major_id")
    private Long categoryMajorId;

    @Column(name = "category_medium_id")
    private Long categoryMediumId;

    @Column(name = "category_minor_id")
    private Long categoryMinorId;
}