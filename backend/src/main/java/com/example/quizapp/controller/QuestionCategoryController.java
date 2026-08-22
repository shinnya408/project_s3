package com.example.quizapp.controller;

import com.example.quizapp.entity.QuestionCategory;
import com.example.quizapp.repository.QuestionCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/categories")
@CrossOrigin(origins = "https://question-app-3rn.pages.dev")
@RequiredArgsConstructor
public class QuestionCategoryController {

    private final QuestionCategoryRepository categoryRepository;

    @GetMapping
    public List<QuestionCategory> getCategories(@RequestParam Long workbookId) {
        return categoryRepository.findByWorkbookIdAndDeletedFalseOrderBySequenceAsc(workbookId);
    }

    @PostMapping("/bulk")
    @Transactional
    public String saveCategories(@RequestParam Long workbookId, @RequestBody List<QuestionCategory> incomingCategories) {
        
        // ★ 削除済みも含めて、この問題集の全カテゴリを取得する
        List<QuestionCategory> allExisting = categoryRepository.findByWorkbookId(workbookId);

        // 重複回避のため、一旦すべての一時シーケンス（10000番台）をセットして退避させる
        int tempSeq = 10000;
        for (QuestionCategory ext : allExisting) {
            ext.setSequence(tempSeq++);
        }
        categoryRepository.flush(); // ここで一旦データベースに反映して場所を空ける

        // 入力されたデータを一つずつ保存・更新
        for (int i = 0; i < incomingCategories.size(); i++) {
            QuestionCategory incoming = incomingCategories.get(i);
            
            if (incoming.getId() != null) {
                // 既存カテゴリの更新
                Optional<QuestionCategory> extOpt = allExisting.stream()
                        .filter(c -> c.getId().equals(incoming.getId()))
                        .findFirst();
                if (extOpt.isPresent()) {
                    QuestionCategory ext = extOpt.get();
                    ext.setName(incoming.getName());
                    ext.setSequence(i + 1); // 新しい順番（1, 2, 3...）をセット
                    ext.setDeleted(false);
                }
            } else {
                // 新規作成
                QuestionCategory newCat = new QuestionCategory();
                newCat.setWorkbookId(workbookId);
                newCat.setName(incoming.getName());
                newCat.setSequence(i + 1);
                newCat.setDeleted(false);
                categoryRepository.save(newCat);
            }
        }

        // 画面から消された（送られてこなかった）既存カテゴリを論理削除
        for (QuestionCategory ext : allExisting) {
            boolean stillExists = incomingCategories.stream()
                    .anyMatch(c -> c.getId() != null && c.getId().equals(ext.getId()));
            
            if (!stillExists) {
                ext.setDeleted(true);
                // ★ 削除済みのものは、今後の邪魔にならないようにマイナス値（自身のID×-1）にして永続退避
                ext.setSequence(ext.getId() != null ? -ext.getId().intValue() : -tempSeq);
            }
        }

        return "{\"status\": \"success\"}";
    }
}