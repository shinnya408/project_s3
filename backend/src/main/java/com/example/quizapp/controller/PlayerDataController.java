package com.example.quizapp.controller;

import com.example.quizapp.entity.*;
import com.example.quizapp.repository.*;
import com.example.quizapp.service.QuestionService;
import com.example.quizapp.dto.PlayerQuestionDto;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/player-data")
@RequiredArgsConstructor
public class PlayerDataController {

    private final QuestionService questionService;
    private final DdQuestionRepository ddQuestionRepository;
    private final DdDropZoneRepository ddDropZoneRepository;
    private final DdDragItemRepository ddDragItemRepository;
    private final QuestionAnswerHistoryRepository historyRepository;
    private final UserTagRepository userTagRepository;
    private final QuestionTagRelationRepository relationRepository;
    private final QuestionCategoryRepository categoryRepository;

    @GetMapping
    public PlayerDataResponse getPlayerData(
            @RequestParam Long workbookId,
            @RequestParam(required = false) Long targetUserId,
            @RequestHeader("X-User-Id") Long loginUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String role) {

        // 閲覧対象のユーザーIDを決定（管理者プレビュー対応）
        Long fetchUserId = (targetUserId != null && ("ADMIN".equals(role) || "MANAGER".equals(role))) 
                ? targetUserId : loginUserId;

        PlayerDataResponse response = new PlayerDataResponse();

        // 1. 四択問題データの取得
        response.setMcq(questionService.getQuestionsForPlayer(workbookId));

        // 2. D&D問題データの取得と組み立て
        List<DdQuestion> ddQuestions = ddQuestionRepository.findByWorkbookIdAndDeletedFalseOrderByIdAsc(workbookId);
        List<DdQuestionSaveRequest> ddResponses = new ArrayList<>();
        for (DdQuestion q : ddQuestions) {
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
            ddResponses.add(res);
        }
        response.setDd(ddResponses);

        // 3. 解答履歴データの取得[cite: 26]
        List<QuestionAnswerHistory> histories = historyRepository.findByUserIdAndWorkbookId(fetchUserId, workbookId);
        List<HistoryDto> historyDtos = histories.stream().map(h -> {
            HistoryDto d = new HistoryDto();
            d.setQuestionId(h.getQuestionId());
            d.setQuestionFormat(h.getQuestionFormat());
            d.setHistoryJson(h.getHistoryJson());
            d.setUpdateAt(h.getUpdateAt());
            return d;
        }).collect(Collectors.toList());
        response.setHistory(historyDtos);

        // 4. タグデータの取得と組み立て
        TagDataResponse tagsRes = new TagDataResponse();
        List<UserTag> tags = userTagRepository.findByUserIdAndWorkbookIdOrderByIdAsc(fetchUserId, workbookId);
        List<TagDto> tagDtos = tags.stream().map(t -> new TagDto(t.getId(), t.getName())).collect(Collectors.toList());
        tagsRes.setTags(tagDtos);

        Map<String, List<Long>> relationsMap = new HashMap<>();
        if (!tags.isEmpty()) {
            List<Long> tagIds = tags.stream().map(UserTag::getId).collect(Collectors.toList());
            List<QuestionTagRelation> relations = relationRepository.findByUserIdAndTagIdIn(fetchUserId, tagIds);
            for (QuestionTagRelation r : relations) {
                String compositeKey = r.getQuestionFormat() + "_" + r.getQuestionId();
                relationsMap.putIfAbsent(compositeKey, new ArrayList<>());
                relationsMap.get(compositeKey).add(r.getTagId());
            }
        }
        tagsRes.setQuestionTags(relationsMap);
        response.setTags(tagsRes);

        // 5. カテゴリデータの取得
        response.setCategories(categoryRepository.findByWorkbookIdAndDeletedFalseOrderBySequenceAsc(workbookId));

        return response;
    }
}

// レスポンス用のDTO
@Data
class PlayerDataResponse {
    private List<PlayerQuestionDto> mcq;
    private List<DdQuestionSaveRequest> dd;
    private List<HistoryDto> history;
    private TagDataResponse tags;
    private List<QuestionCategory> categories;
}

@Data
class HistoryDto {
    private Long questionId;
    private String questionFormat;
    private String historyJson;
    private java.time.OffsetDateTime updateAt;
}