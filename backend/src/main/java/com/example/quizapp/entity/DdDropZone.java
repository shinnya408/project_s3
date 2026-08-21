package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dd_drop_zone")
@Getter
@Setter
public class DdDropZone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dd_question_id", nullable = false)
    private Long ddQuestionId;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "sequence", nullable = false)
    private Integer sequence;
}