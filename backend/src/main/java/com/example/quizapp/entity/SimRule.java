package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "sim_rule")
public class SimRule extends BaseEntity {

    private Long simTaskId;

    private String scope;

    @Column(name = "rule_condition") // DB側のカラム名に合わせる
    private String condition;

    private Integer score;
}