package com.example.quizapp.dto;

import lombok.Data;
import java.time.OffsetDateTime;

@Data
public class ExamHistoryDto {
    private Long id;
    private Long workbookId;
    private Integer correct;
    private Integer total;
    private Integer percent;
    private OffsetDateTime date; // 保存日時
    
    // フロントエンドの exam_history.js がパースできるように文字列で送受信
    private String questions; 
    private String answers;
}