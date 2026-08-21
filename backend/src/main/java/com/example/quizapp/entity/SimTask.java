package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "sim_task")
public class SimTask extends BaseEntity {

    private Long simQuestionId;

    private Integer sequence;

    @Column(columnDefinition = "TEXT")
    private String instruction;

    @Column(columnDefinition = "TEXT")
    private String explanation;
}