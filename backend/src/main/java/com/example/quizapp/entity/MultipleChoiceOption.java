package com.example.quizapp.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "multiple_choice_option")
@Getter
@Setter
public class MultipleChoiceOption extends BaseEntity {

    // どの問題に属しているかの紐付け設定
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "multiple_choice_question_id", nullable = false)
    @JsonBackReference // データの無限ループを防ぐ
    private MultipleChoiceQuestion questionEntity;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "is_correct", nullable = false)
    private boolean isCorrect = false;
}