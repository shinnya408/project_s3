package com.example.quizapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Entity
@Table(name = "changelog")
@Data
@EqualsAndHashCode(callSuper = true)
public class Changelog extends BaseEntity {
    @Column(nullable = false)
    private String target; // 変更箇所
    
    @Column(nullable = false)
    private String type; // 変更種別
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content; // 変更内容
}