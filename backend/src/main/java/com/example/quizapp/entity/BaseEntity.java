package com.example.quizapp.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@MappedSuperclass
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "create_at", nullable = false, updatable = false)
    private OffsetDateTime createAt;

    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @PrePersist
    protected void onCreate() {
        this.createAt = OffsetDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public OffsetDateTime getCreateAt() { return createAt; }
    public void setCreateAt(OffsetDateTime createAt) { this.createAt = createAt; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
}