package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dd_drag_item")
@Getter
@Setter
public class DdDragItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dd_question_id", nullable = false)
    private Long ddQuestionId;

    @Column(name = "correct_zone_id")
    private Long correctZoneId; // ダミーの場合はnullになる

    @Column(name = "text", columnDefinition = "TEXT")
    private String text;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;
}