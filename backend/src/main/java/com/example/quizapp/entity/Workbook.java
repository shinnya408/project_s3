package com.example.quizapp.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "workbook")
public class Workbook extends BaseEntity {
    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String format;

    // Getters and Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }
}