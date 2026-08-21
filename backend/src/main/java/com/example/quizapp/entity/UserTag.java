package com.example.quizapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;

@Entity
@Table(name = "user_tag")
@Getter
@Setter
public class UserTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "workbook_id", nullable = false)
    private Long workbookId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "create_at", nullable = false, updatable = false)
    private OffsetDateTime createAt;

    @PrePersist
    protected void onCreate() {
        this.createAt = OffsetDateTime.now();
    }
}