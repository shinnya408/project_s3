package com.example.quizapp.controller;

import com.example.quizapp.entity.QuestionTagRelation;
import com.example.quizapp.entity.UserTag;
import com.example.quizapp.repository.QuestionTagRelationRepository;
import com.example.quizapp.repository.UserTagRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final UserTagRepository userTagRepository;
    private final QuestionTagRelationRepository relationRepository;

    @GetMapping
    public TagDataResponse getTags(
            @RequestParam Long workbookId,
            @RequestParam(required = false) Long targetUserId,
            @RequestHeader("X-User-Id") Long loginUserId,
            @RequestHeader(value = "X-User-Role", defaultValue = "USER") String role) {
        
        Long fetchUserId = (targetUserId != null && ("ADMIN".equals(role) || "MANAGER".equals(role))) 
                ? targetUserId : loginUserId;

        TagDataResponse response = new TagDataResponse();
        List<UserTag> tags = userTagRepository.findByUserIdAndWorkbookIdOrderByIdAsc(fetchUserId, workbookId);
        List<TagDto> tagDtos = tags.stream().map(t -> new TagDto(t.getId(), t.getName())).collect(Collectors.toList());
        response.setTags(tagDtos);

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
        response.setQuestionTags(relationsMap);
        return response;
    }

    @PostMapping
    public TagDto createTag(@RequestBody TagCreateRequest req, @RequestHeader("X-User-Id") Long userId) {
        UserTag tag = new UserTag();
        tag.setUserId(userId);
        tag.setWorkbookId(req.getWorkbookId());
        tag.setName(req.getName());
        userTagRepository.save(tag);
        return new TagDto(tag.getId(), tag.getName());
    }

    @PutMapping("/{id}")
    public TagDto updateTag(@PathVariable Long id, @RequestBody TagUpdateRequest req) {
        UserTag tag = userTagRepository.findById(id).orElseThrow();
        tag.setName(req.getName());
        userTagRepository.save(tag);
        return new TagDto(tag.getId(), tag.getName());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public String deleteTag(@PathVariable Long id) {
        userTagRepository.deleteById(id);
        return "{\"status\": \"success\"}";
    }

    @PostMapping("/questions")
    @Transactional
    public String updateQuestionTags(
            @RequestBody QuestionTagUpdateRequest req,
            @RequestHeader("X-User-Id") Long userId) {
        
        // 既存のタグ紐付けを削除
        relationRepository.deleteByUserIdAndQuestionIdAndQuestionFormat(userId, req.getQuestionId(), req.getFormat());
        
        // ★ JPAの実行順序問題（INSERTがDELETEより先に走る）を回避するため、直後にDBへ強制反映
        relationRepository.flush();

        // ★ 念のため、リクエストされたタグIDリストの重複を排除
        List<Long> distinctTagIds = req.getTagIds().stream().distinct().collect(Collectors.toList());

        // 新しいタグ紐付けを保存
        for (Long tagId : distinctTagIds) {
            QuestionTagRelation relation = new QuestionTagRelation();
            relation.setUserId(userId);
            relation.setQuestionId(req.getQuestionId());
            relation.setQuestionFormat(req.getFormat());
            relation.setTagId(tagId);
            relationRepository.save(relation);
        }
        return "{\"status\": \"success\"}";
    }
}

@Data class TagDataResponse { private List<TagDto> tags; private Map<String, List<Long>> questionTags; }
@Data class TagDto { private Long id; private String name; public TagDto(Long id, String name) { this.id = id; this.name = name; } }
@Data class TagCreateRequest { private Long workbookId; private String name; }
@Data class TagUpdateRequest { private String name; }
@Data class QuestionTagUpdateRequest { private Long questionId; private String format; private List<Long> tagIds; }