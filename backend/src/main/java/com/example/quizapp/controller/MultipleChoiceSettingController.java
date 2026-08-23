package com.example.quizapp.controller;

import com.example.quizapp.dto.MultipleChoiceSettingRequest;
import com.example.quizapp.entity.MultipleChoiceSetting;
import com.example.quizapp.repository.MultipleChoiceSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/multiple-choice-settings")
@RequiredArgsConstructor
public class MultipleChoiceSettingController {

    private final MultipleChoiceSettingRepository settingRepository;

    // 模試設定の取得 (GET /api/multiple-choice-settings?workbookId=X)
    @GetMapping
    public MultipleChoiceSetting getSetting(@RequestParam Long workbookId) {
        // 設定が存在すればそれを返し、なければnullを返す（フロント側でデフォルト値を適用させるため）
        return settingRepository.findByWorkbookIdAndDeletedFalse(workbookId)
                .orElse(null);
    }

    // 模試設定の保存・更新 (POST /api/multiple-choice-settings)
    @PostMapping
    public String saveSetting(@RequestBody MultipleChoiceSettingRequest req) {
        // 既存の設定があるか確認
        Optional<MultipleChoiceSetting> existingOpt = settingRepository.findByWorkbookIdAndDeletedFalse(req.getWorkbookId());

        MultipleChoiceSetting setting;
        if (existingOpt.isPresent()) {
            // 既存の設定があれば上書き (UPDATE)
            setting = existingOpt.get();
            setting.setQuestionCount(req.getQuestionCount());
            setting.setTimeLimiteSecond(req.getTimeLimiteSecond());
        } else {
            // なければ新規作成 (INSERT)
            setting = new MultipleChoiceSetting();
            setting.setWorkbookId(req.getWorkbookId());
            setting.setQuestionCount(req.getQuestionCount());
            setting.setTimeLimiteSecond(req.getTimeLimiteSecond());
        }

        // DBに保存
        settingRepository.save(setting);
        return "{\"status\": \"success\"}";
    }
}