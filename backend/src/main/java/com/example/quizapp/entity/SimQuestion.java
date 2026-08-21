package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "sim_question")
public class SimQuestion extends BaseEntity {

    private Long workbookId;

    @Column(columnDefinition = "TEXT")
    private String question;

    private String questionImageUrl;

    private Long categoryMajorId;
    private Long categoryMediumId;
    private Long categoryMinorId;

    @Column(columnDefinition = "TEXT")
    private String initialConfig;
}