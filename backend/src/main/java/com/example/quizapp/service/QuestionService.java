package com.example.quizapp.service;

import com.example.quizapp.dto.QuestionSaveRequest;
import com.example.quizapp.entity.MultipleChoiceOption;
import com.example.quizapp.entity.MultipleChoiceQuestion;
import com.example.quizapp.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Iterator;
import java.util.stream.Collectors;
import com.example.quizapp.dto.PlayerQuestionDto;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;

    @Transactional
    public void saveQuestions(List<QuestionSaveRequest> requests) {
        
        List<MultipleChoiceQuestion> entitiesToSave = new ArrayList<>();

        // ★修正1: 更新対象のIDリストを抽出し、データベースから「1回の通信で一括取得」する
        List<Long> updateIds = requests.stream()
                .filter(req -> req.getId() != null)
                .map(QuestionSaveRequest::getId)
                .collect(Collectors.toList());

        Map<Long, MultipleChoiceQuestion> existingQuestionsMap = new HashMap<>();
        if (!updateIds.isEmpty()) {
            List<MultipleChoiceQuestion> existingQuestions = questionRepository.findAllById(updateIds);
            for (MultipleChoiceQuestion q : existingQuestions) {
                existingQuestionsMap.put(q.getId(), q);
            }
        }

        for (QuestionSaveRequest req : requests) {
            MultipleChoiceQuestion questionEntity;

            if (req.getId() != null) {
                // ★修正2: データベースへ都度アクセスするのをやめ、一括取得したMapから取り出す
                if (existingQuestionsMap.containsKey(req.getId())) {
                    questionEntity = existingQuestionsMap.get(req.getId());
                    
                    if (req.getOptions() != null) {
                        List<MultipleChoiceOption> currentOptions = questionEntity.getOptions();
                        
                        for (QuestionSaveRequest.OptionDto optDto : req.getOptions()) {
                            boolean found = false;
                            for (MultipleChoiceOption currentOpt : currentOptions) {
                                if (currentOpt.getText().equals(optDto.getText())) {
                                    currentOpt.setImageUrl(optDto.getImageUrl());
                                    currentOpt.setCorrect(optDto.isCorrect());
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                MultipleChoiceOption newOpt = new MultipleChoiceOption();
                                newOpt.setText(optDto.getText());
                                newOpt.setImageUrl(optDto.getImageUrl());
                                newOpt.setCorrect(optDto.isCorrect());
                                newOpt.setQuestionEntity(questionEntity);
                                currentOptions.add(newOpt);
                            }
                        }

                        Iterator<MultipleChoiceOption> iterator = currentOptions.iterator();
                        while (iterator.hasNext()) {
                            MultipleChoiceOption currentOpt = iterator.next();
                            boolean stillExists = false;
                            for (QuestionSaveRequest.OptionDto optDto : req.getOptions()) {
                                if (currentOpt.getText().equals(optDto.getText())) {
                                    stillExists = true;
                                    break;
                                }
                            }
                            if (!stillExists) {
                                iterator.remove(); 
                            }
                        }
                    } else {
                        questionEntity.getOptions().clear();
                    }

                } else {
                    throw new RuntimeException("Question not found with ID: " + req.getId());
                }
            } else {
                // 【新規作成】
                questionEntity = new MultipleChoiceQuestion();
                questionEntity.setOptions(new ArrayList<>());
                
                if (req.getOptions() != null) {
                    for (QuestionSaveRequest.OptionDto optDto : req.getOptions()) {
                        MultipleChoiceOption optEntity = new MultipleChoiceOption();
                        optEntity.setText(optDto.getText());
                        optEntity.setImageUrl(optDto.getImageUrl());
                        optEntity.setCorrect(optDto.isCorrect());
                        optEntity.setQuestionEntity(questionEntity);
                        questionEntity.getOptions().add(optEntity);
                    }
                }
            }

            questionEntity.setWorkbookId(req.getWorkbookId());
            questionEntity.setQuestion(req.getQuestion());
            questionEntity.setQuestionImageUrl(req.getQuestionImageUrl());
            questionEntity.setExplanation(req.getExplanation());
            questionEntity.setExplanationImageUrl(req.getExplanationImageUrl());
            
            questionEntity.setCategoryMajorId(req.getCategoryMajorId());
            questionEntity.setCategoryMediumId(req.getCategoryMediumId());
            questionEntity.setCategoryMinorId(req.getCategoryMinorId());

            entitiesToSave.add(questionEntity);
        }

        // 一括で保存・更新をリクエストする
        questionRepository.saveAll(entitiesToSave);
    }

    public List<PlayerQuestionDto> getQuestionsForPlayer(Long workbookId) {
        List<MultipleChoiceQuestion> entities = questionRepository.findByWorkbookIdAndDeletedFalse(workbookId);

        return entities.stream().map(entity -> {
            PlayerQuestionDto dto = new PlayerQuestionDto();
            dto.setId(entity.getId());
            dto.setWorkbookId(entity.getWorkbookId());
            dto.setQuestion(entity.getQuestion());
            dto.setQuestionImageUrl(entity.getQuestionImageUrl());
            dto.setExplanation(entity.getExplanation());
            dto.setExplanationImageUrl(entity.getExplanationImageUrl());
            dto.setCategoryMajorId(entity.getCategoryMajorId());
            dto.setCategoryMediumId(entity.getCategoryMediumId());
            dto.setCategoryMinorId(entity.getCategoryMinorId());

            if (entity.getOptions() != null) {
                List<PlayerQuestionDto.PlayerOptionDto> optionDtos = entity.getOptions().stream().map(opt -> {
                    PlayerQuestionDto.PlayerOptionDto optDto = new PlayerQuestionDto.PlayerOptionDto();
                    optDto.setId(opt.getId());
                    optDto.setText(opt.getText());
                    optDto.setImageUrl(opt.getImageUrl());
                    optDto.setCorrect(opt.isCorrect());
                    return optDto;
                }).collect(Collectors.toList());
                dto.setOptions(optionDtos);
            }
            return dto;
        }).collect(Collectors.toList());
    }
}