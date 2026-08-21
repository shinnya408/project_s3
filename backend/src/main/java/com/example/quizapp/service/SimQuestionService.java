package com.example.quizapp.service;

import com.example.quizapp.dto.SimQuestionDto;
import com.example.quizapp.entity.SimQuestion;
import com.example.quizapp.entity.SimRule;
import com.example.quizapp.entity.SimTask;
import com.example.quizapp.repository.SimQuestionRepository;
import com.example.quizapp.repository.SimRuleRepository;
import com.example.quizapp.repository.SimTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SimQuestionService {

    private final SimQuestionRepository simQuestionRepository;
    private final SimTaskRepository simTaskRepository;
    private final SimRuleRepository simRuleRepository;

    // 問題取得
    public List<SimQuestionDto> getQuestionsByWorkbookId(Long workbookId) {
        List<SimQuestion> questions = simQuestionRepository.findByWorkbookIdAndDeletedFalseOrderByIdAsc(workbookId);
        
        return questions.stream().map(q -> {
            SimQuestionDto dto = new SimQuestionDto();
            dto.setId(q.getId());
            dto.setWorkbookId(q.getWorkbookId());
            dto.setQuestion(q.getQuestion());
            dto.setQuestionImageUrl(q.getQuestionImageUrl());
            dto.setCategoryMajorId(q.getCategoryMajorId());
            dto.setCategoryMediumId(q.getCategoryMediumId());
            dto.setCategoryMinorId(q.getCategoryMinorId());
            dto.setInitialConfig(q.getInitialConfig());

            // タスクの取得とマッピング
            List<SimTask> tasks = simTaskRepository.findBySimQuestionIdOrderBySequenceAsc(q.getId());
            List<SimQuestionDto.SimTaskDto> taskDtos = tasks.stream().map(t -> {
                SimQuestionDto.SimTaskDto tDto = new SimQuestionDto.SimTaskDto();
                tDto.setId(t.getId());
                tDto.setSequence(t.getSequence());
                tDto.setInstruction(t.getInstruction());
                tDto.setExplanation(t.getExplanation());

                // ルールの取得とマッピング
                List<SimRule> rules = simRuleRepository.findBySimTaskIdOrderByIdAsc(t.getId());
                List<SimQuestionDto.SimRuleDto> ruleDtos = rules.stream().map(r -> {
                    SimQuestionDto.SimRuleDto rDto = new SimQuestionDto.SimRuleDto();
                    rDto.setId(r.getId());
                    rDto.setScope(r.getScope());
                    rDto.setCondition(r.getCondition());
                    rDto.setScore(r.getScore());
                    return rDto;
                }).collect(Collectors.toList());
                tDto.setRules(ruleDtos);

                return tDto;
            }).collect(Collectors.toList());
            dto.setTasks(taskDtos);

            return dto;
        }).collect(Collectors.toList());
    }

    // 問題の保存（登録・更新）
    @Transactional
    public void saveSimQuestion(SimQuestionDto dto) {
        SimQuestion question;
        if (dto.getId() != null) {
            question = simQuestionRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Question not found"));
            // 更新時は既存のタスクとルールを一度削除して作り直す（簡易的なリセット更新）
            simTaskRepository.findBySimQuestionIdOrderBySequenceAsc(question.getId()).forEach(task -> {
                simRuleRepository.deleteBySimTaskId(task.getId());
            });
            simTaskRepository.deleteBySimQuestionId(question.getId());
        } else {
            question = new SimQuestion();
        }

        question.setWorkbookId(dto.getWorkbookId());
        question.setQuestion(dto.getQuestion());
        question.setQuestionImageUrl(dto.getQuestionImageUrl());
        question.setCategoryMajorId(dto.getCategoryMajorId());
        question.setCategoryMediumId(dto.getCategoryMediumId());
        question.setCategoryMinorId(dto.getCategoryMinorId());
        question.setInitialConfig(dto.getInitialConfig());

        SimQuestion savedQuestion = simQuestionRepository.save(question);

        if (dto.getTasks() != null) {
            for (SimQuestionDto.SimTaskDto taskDto : dto.getTasks()) {
                SimTask task = new SimTask();
                task.setSimQuestionId(savedQuestion.getId());
                task.setSequence(taskDto.getSequence());
                task.setInstruction(taskDto.getInstruction());
                task.setExplanation(taskDto.getExplanation());
                SimTask savedTask = simTaskRepository.save(task);

                if (taskDto.getRules() != null) {
                    for (SimQuestionDto.SimRuleDto ruleDto : taskDto.getRules()) {
                        SimRule rule = new SimRule();
                        rule.setSimTaskId(savedTask.getId());
                        rule.setScope(ruleDto.getScope());
                        rule.setCondition(ruleDto.getCondition());
                        rule.setScore(ruleDto.getScore());
                        simRuleRepository.save(rule);
                    }
                }
            }
        }
    }

    // 問題の論理削除
    @Transactional
    public void deleteSimQuestion(Long id) {
        simQuestionRepository.findById(id).ifPresent(q -> {
            q.setDeleted(true);
            simQuestionRepository.save(q);
        });
    }
}