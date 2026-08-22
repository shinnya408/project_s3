package com.example.quizapp.controller;

import com.example.quizapp.entity.SimQuestion;
import com.example.quizapp.entity.SimRule;
import com.example.quizapp.entity.SimTask;
import com.example.quizapp.repository.SimQuestionRepository;
import com.example.quizapp.repository.SimRuleRepository;
import com.example.quizapp.repository.SimTaskRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sim-questions")
@RequiredArgsConstructor
@CrossOrigin(origins = "https://question-app-3rn.pages.dev") // 開発用のCORS許可
public class SimQuestionController {

    private final SimQuestionRepository simQuestionRepository;
    private final SimTaskRepository simTaskRepository;
    private final SimRuleRepository simRuleRepository;

    // ① シミュレーション問題の取得 (GET)
    @GetMapping
    public List<SimQuestionSaveRequest> getSimQuestions(@RequestParam Long workbookId) {
        List<SimQuestion> questions = simQuestionRepository.findByWorkbookIdAndDeletedFalseOrderByIdAsc(workbookId);
        List<SimQuestionSaveRequest> responses = new ArrayList<>();

        for (SimQuestion q : questions) {
            SimQuestionSaveRequest res = new SimQuestionSaveRequest();
            res.setId(q.getId());
            res.setWorkbookId(q.getWorkbookId());
            res.setQuestion(q.getQuestion());
            res.setQuestionImageUrl(q.getQuestionImageUrl());
            res.setCategoryMajorId(q.getCategoryMajorId());
            res.setCategoryMediumId(q.getCategoryMediumId());
            res.setCategoryMinorId(q.getCategoryMinorId());
            res.setInitialConfig(q.getInitialConfig());

            // タスクの取得
            List<SimTask> tasks = simTaskRepository.findBySimQuestionIdOrderBySequenceAsc(q.getId());
            List<SimTaskReq> taskReqs = new ArrayList<>();

            for (SimTask t : tasks) {
                SimTaskReq tReq = new SimTaskReq();
                tReq.setSequence(t.getSequence());
                tReq.setInstruction(t.getInstruction());
                tReq.setExplanation(t.getExplanation());

                // ルールの取得
                List<SimRule> rules = simRuleRepository.findBySimTaskIdOrderByIdAsc(t.getId());
                List<SimRuleReq> ruleReqs = new ArrayList<>();
                for (SimRule r : rules) {
                    SimRuleReq rReq = new SimRuleReq();
                    rReq.setScope(r.getScope());
                    rReq.setCondition(r.getCondition());
                    rReq.setScore(r.getScore());
                    ruleReqs.add(rReq);
                }
                tReq.setRules(ruleReqs);
                taskReqs.add(tReq);
            }
            res.setTasks(taskReqs);
            responses.add(res);
        }
        return responses;
    }

    // ② シミュレーション問題の保存・更新 (POST)
    @PostMapping
    @Transactional
    public Map<String, String> saveSimQuestion(@RequestBody SimQuestionSaveRequest req) {
        SimQuestion q;
        if (req.getId() != null) {
            // 更新の場合：既存のタスクとルールを削除
            q = simQuestionRepository.findById(req.getId()).orElse(new SimQuestion());
            List<SimTask> oldTasks = simTaskRepository.findBySimQuestionIdOrderBySequenceAsc(q.getId());
            for (SimTask oldTask : oldTasks) {
                simRuleRepository.deleteBySimTaskId(oldTask.getId()); // ルールを削除
            }
            simTaskRepository.deleteBySimQuestionId(q.getId()); // タスクを削除
        } else {
            // 新規の場合
            q = new SimQuestion();
        }

        // 1. 問題本体を保存
        q.setWorkbookId(req.getWorkbookId());
        q.setQuestion(req.getQuestion());
        q.setQuestionImageUrl(req.getQuestionImageUrl());
        q.setCategoryMajorId(req.getCategoryMajorId());
        q.setCategoryMediumId(req.getCategoryMediumId());
        q.setCategoryMinorId(req.getCategoryMinorId());
        q.setInitialConfig(req.getInitialConfig());
        q.setDeleted(false);
        simQuestionRepository.save(q);

        // 2. タスクとルールを保存
        if (req.getTasks() != null) {
            for (SimTaskReq tReq : req.getTasks()) {
                SimTask t = new SimTask();
                t.setSimQuestionId(q.getId());
                t.setSequence(tReq.getSequence());
                t.setInstruction(tReq.getInstruction());
                t.setExplanation(tReq.getExplanation());
                simTaskRepository.save(t); // タスクを保存してIDを発番

                if (tReq.getRules() != null) {
                    for (SimRuleReq rReq : tReq.getRules()) {
                        SimRule r = new SimRule();
                        r.setSimTaskId(t.getId());
                        r.setScope(rReq.getScope());
                        r.setCondition(rReq.getCondition());
                        r.setScore(rReq.getScore());
                        simRuleRepository.save(r); // ルールを保存
                    }
                }
            }
        }
        return Map.of("status", "success");
    }

    // ③ シミュレーション問題の論理削除 (DELETE)
    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, String> deleteSimQuestion(@PathVariable Long id) {
        SimQuestion q = simQuestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("問題が見つかりません"));
        q.setDeleted(true);
        simQuestionRepository.save(q);
        return Map.of("status", "success");
    }
}

// ===============================================
// リクエスト＆レスポンス用のDTOクラス（コントローラーの下部などに記述）
// ===============================================

@Data
class SimQuestionSaveRequest {
    private Long id;
    private Long workbookId;
    private String question;
    private String questionImageUrl;
    private Long categoryMajorId;
    private Long categoryMediumId;
    private Long categoryMinorId;
    private String initialConfig;
    private List<SimTaskReq> tasks;
}

@Data
class SimTaskReq {
    private Integer sequence;
    private String instruction;
    private String explanation;
    private List<SimRuleReq> rules;
}

@Data
class SimRuleReq {
    private String scope;
    private String condition;
    private Integer score;
}