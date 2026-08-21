package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "question_category", uniqueConstraints = {
    @UniqueConstraint(name = "uq_workbook_sequence", columnNames = {"workbook_id", "sequence"})
})
@Getter
@Setter
public class QuestionCategory extends BaseEntity {

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(name = "sequence", nullable = false)
    private Integer sequence;

    @Column(name = "name", nullable = false)
    private String name;
}