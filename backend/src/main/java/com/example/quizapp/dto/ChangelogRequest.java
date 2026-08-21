package com.example.quizapp.dto;
import lombok.Data;

@Data
public class ChangelogRequest {
    private String target;
    private String type;
    private String content;
}