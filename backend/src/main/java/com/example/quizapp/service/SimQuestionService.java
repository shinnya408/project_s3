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
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SimQuestionService {

    private final SimQuestionRepository simQuestionRepository;
    private final SimTaskRepository simTaskRepository;
    private final SimRuleRepository simRuleRepository;

    // ★ 修正: N+1問題を解消した爆速な問題取得メソッド
    public List<SimQuestionDto> getQuestionsByWorkbookId(Long workbookId) {
        // 1. 指定した問題集のシミュレーション問題を一括取得 (1回目の通信)
        List<SimQuestion> questions = simQuestionRepository.findByWorkbookIdAndDeletedFalseOrderByIdAsc(workbookId);
        
        if (questions.isEmpty()) {
            return new ArrayList<>();
        }

        // 取得した問題のIDリストを作成
        List<Long> questionIds = questions.stream().map(SimQuestion::getId).collect(Collectors.toList());

        // 2. その問題に関連する全タスクを一括取得 (2回目の通信)
        List<SimTask> allTasks = simTaskRepository.findBySimQuestionIdInOrderBySequenceAsc(questionIds);
        
        // 取得したタスクのIDリストを作成
        List<Long> taskIds = allTasks.stream().map(SimTask::getId).collect(Collectors.toList());
        
        // 3. そのタスクに関連する全ルールを一括取得 (3回目の通信)
        List<SimRule> allRules = new ArrayList<>();
        if (!taskIds.isEmpty()) {
            allRules = simRuleRepository.findBySimTaskIdInOrderByIdAsc(taskIds);
        }

        // --- ここからはJava上のメモリ処理なので一瞬で終わります ---

        // ルールを taskId ごとにグループ化
        Map<Long, List<SimRule>> rulesByTaskId = allRules.stream()
                .collect(Collectors.groupingBy(SimRule::getSimTaskId));

        // タスクを questionId ごとにグループ化（DTOに変換しながら）
        Map<Long, List<SimQuestionDto.SimTaskDto>> taskDtosByQuestionId = allTasks.stream().map(t -> {
            SimQuestionDto.SimTaskDto tDto = new SimQuestionDto.SimTaskDto();
            tDto.setId(t.getId());
            tDto.setSequence(t.getSequence());
            tDto.setInstruction(t.getInstruction());
            tDto.setExplanation(t.getExplanation());
            // グループ化しておいたルールをセット
            List<SimRule> rules = rulesByTaskId.getOrDefault(t.getId(), new ArrayList<>());
            List<SimQuestionDto.SimRuleDto> ruleDtos = rules.stream().map(r -> {
                SimQuestionDto.SimRuleDto rDto = new SimQuestionDto.SimRuleDto();
                rDto.setId(r.getId());
                rDto.setScope(r.getScope());
                rDto.setCondition(r.getCondition());
                rDto.setScore(r.getScore());
                return rDto;
            }).collect(Collectors.toList());
            tDto.setRules(ruleDtos);
            
            // 処理用のテンポラリ情報を保持するラッパークラスを返すのではなく、
            // groupingBy をシンプルにするために、便宜的に一時的なオブジェクトを作成します
            return new TaskWrapper(t.getSimQuestionId(), tDto);
        }).collect(Collectors.groupingBy(TaskWrapper::getQuestionId, 
                Collectors.mapping(TaskWrapper::getTaskDto, Collectors.toList())));


        // 問題エンティティをDTOに変換し、グループ化しておいたタスクをセット
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

            // グループ化しておいたタスクをセット
            dto.setTasks(taskDtosByQuestionId.getOrDefault(q.getId(), new ArrayList<>()));

            return dto;
        }).collect(Collectors.toList());
    }

    // テンポラリクラス（Java内部でのグループ化用）
    private static class TaskWrapper {
        private final Long questionId;
        private final SimQuestionDto.SimTaskDto taskDto;

        public TaskWrapper(Long questionId, SimQuestionDto.SimTaskDto taskDto) {
            this.questionId = questionId;
            this.taskDto = taskDto;
        }
        public Long getQuestionId() { return questionId; }
        public SimQuestionDto.SimTaskDto getTaskDto() { return taskDto; }
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