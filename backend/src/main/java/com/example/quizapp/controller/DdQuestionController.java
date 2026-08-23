package com.example.quizapp.controller;

import com.example.quizapp.entity.DdDragItem;
import com.example.quizapp.entity.DdDropZone;
import com.example.quizapp.entity.DdQuestion;
import com.example.quizapp.repository.DdDragItemRepository;
import com.example.quizapp.repository.DdDropZoneRepository;
import com.example.quizapp.repository.DdQuestionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/dd-questions")
@RequiredArgsConstructor
public class DdQuestionController {

    private final DdQuestionRepository ddQuestionRepository;
    private final DdDropZoneRepository ddDropZoneRepository;
    private final DdDragItemRepository ddDragItemRepository;

    // ★ 追加：D&D問題の取得API
    @GetMapping
    public List<DdQuestionSaveRequest> getDdQuestions(@RequestParam Long workbookId) {
        List<DdQuestion> questions = ddQuestionRepository.findByWorkbookIdAndDeletedFalseOrderByIdAsc(workbookId);
        List<DdQuestionSaveRequest> responses = new ArrayList<>();

        for (DdQuestion q : questions) {
            DdQuestionSaveRequest res = new DdQuestionSaveRequest();
            res.setId(q.getId());
            res.setWorkbookId(q.getWorkbookId());
            res.setQuestion(q.getQuestion());
            res.setQuestionImageUrl(q.getQuestionImageUrl());
            res.setExplanation(q.getExplanation());
            res.setExplanationImageUrl(q.getExplanationImageUrl());
            res.setCategoryMajorId(q.getCategoryMajorId());
            res.setCategoryMediumId(q.getCategoryMediumId());
            res.setCategoryMinorId(q.getCategoryMinorId());
            
            // 箱とアイテムを取得してDTOに詰める
            List<DdDropZone> zones = ddDropZoneRepository.findByDdQuestionIdOrderBySequenceAsc(q.getId());
            List<DdDragItem> items = ddDragItemRepository.findByDdQuestionIdOrderByIdAsc(q.getId());
            
            List<DropZoneReq> zoneReqs = new ArrayList<>();
            for (DdDropZone z : zones) {
                DropZoneReq zr = new DropZoneReq();
                zr.setId(z.getId());
                zr.setName(z.getName());
                zr.setSequence(z.getSequence());
                zoneReqs.add(zr);
            }
            res.setDropZones(zoneReqs);

            List<DragItemReq> itemReqs = new ArrayList<>();
            for (DdDragItem i : items) {
                DragItemReq ir = new DragItemReq();
                ir.setText(i.getText());
                ir.setImageUrl(i.getImageUrl());
                // 正解の箱IDから、配列のインデックスを逆算する
                if (i.getCorrectZoneId() != null) {
                    for (int idx = 0; idx < zones.size(); idx++) {
                        if (zones.get(idx).getId().equals(i.getCorrectZoneId())) {
                            ir.setCorrectZoneIndex(idx);
                            break;
                        }
                    }
                }
                itemReqs.add(ir);
            }
            res.setDragItems(itemReqs);
            responses.add(res);
        }
        return responses;
    }

    @PostMapping
    @Transactional
    public String saveDdQuestion(@RequestBody DdQuestionSaveRequest req) {
        DdQuestion q;
        if (req.getId() != null) {
            // 更新の場合：既存データを取得し、関連するアイテムと箱を一旦全削除
            q = ddQuestionRepository.findById(req.getId()).orElse(new DdQuestion());
            ddDragItemRepository.deleteByDdQuestionId(q.getId());
            ddDropZoneRepository.deleteByDdQuestionId(q.getId());
        } else {
            // 新規の場合
            q = new DdQuestion();
        }

        q.setWorkbookId(req.getWorkbookId());
        q.setQuestion(req.getQuestion());
        q.setQuestionImageUrl(req.getQuestionImageUrl());
        q.setExplanation(req.getExplanation());
        q.setExplanationImageUrl(req.getExplanationImageUrl());
        q.setCategoryMajorId(req.getCategoryMajorId());
        q.setCategoryMediumId(req.getCategoryMediumId());
        q.setCategoryMinorId(req.getCategoryMinorId());
        q.setDeleted(false);
        ddQuestionRepository.save(q);

        List<DdDropZone> savedZones = new ArrayList<>();
        if (req.getDropZones() != null) {
            for (DropZoneReq dzReq : req.getDropZones()) {
                DdDropZone dz = new DdDropZone();
                dz.setDdQuestionId(q.getId());
                dz.setName(dzReq.getName());
                dz.setSequence(dzReq.getSequence());
                ddDropZoneRepository.save(dz);
                savedZones.add(dz);
            }
        }

        if (req.getDragItems() != null) {
            for (DragItemReq diReq : req.getDragItems()) {
                DdDragItem di = new DdDragItem();
                di.setDdQuestionId(q.getId());
                di.setText(diReq.getText());
                di.setImageUrl(diReq.getImageUrl());
                if (diReq.getCorrectZoneIndex() != null && diReq.getCorrectZoneIndex() < savedZones.size()) {
                    di.setCorrectZoneId(savedZones.get(diReq.getCorrectZoneIndex()).getId());
                }
                ddDragItemRepository.save(di);
            }
        }
        return "{\"status\": \"success\"}";
    }

    @DeleteMapping("/{id}")
    @Transactional
    public String deleteDdQuestion(@PathVariable Long id) {
        DdQuestion q = ddQuestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("問題が見つかりません: " + id));
        q.setDeleted(true); // 論理削除フラグを立てる
        ddQuestionRepository.save(q);
        return "{\"status\": \"success\"}";
    }
}

@Data
class DdQuestionSaveRequest {
    private Long id;
    private Long workbookId;
    private String question;
    private String questionImageUrl;
    private String explanation;
    private String explanationImageUrl;
    private Long categoryMajorId;
    private Long categoryMediumId;
    private Long categoryMinorId;
    private List<DropZoneReq> dropZones;
    private List<DragItemReq> dragItems;
}

@Data
class DropZoneReq {
    private Long id;
    private String name;
    private Integer sequence;
}

@Data
class DragItemReq {
    private String text;
    private String imageUrl;
    private Integer correctZoneIndex;
}