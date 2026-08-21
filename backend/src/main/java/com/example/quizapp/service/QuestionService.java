package com.example.quizapp.service;

import com.example.quizapp.dto.QuestionSaveRequest;
import com.example.quizapp.entity.MultipleChoiceOption;
import com.example.quizapp.entity.MultipleChoiceQuestion;
import com.example.quizapp.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Iterator;

import com.example.quizapp.dto.PlayerQuestionDto;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;

    @Transactional
    public void saveQuestions(List<QuestionSaveRequest> requests) {
        
        List<MultipleChoiceQuestion> entitiesToSave = new ArrayList<>();

        for (QuestionSaveRequest req : requests) {
            MultipleChoiceQuestion questionEntity;

            if (req.getId() != null) {
                // 【更新】
                Optional<MultipleChoiceQuestion> existingOpt = questionRepository.findById(req.getId());
                if (existingOpt.isPresent()) {
                    questionEntity = existingOpt.get();
                    
                    // ※ 古い選択肢を一旦クリアするのではなく、削除フラグ(orphanRemoval)を利用しつつ
                    // 送られてきたリストにないものは消す、あるものは更新するという処理を行います。
                    
                    if (req.getOptions() != null) {
                        List<MultipleChoiceOption> currentOptions = questionEntity.getOptions();
                        
                        // ① 今回送られてきた選択肢の中に、既存の選択肢(同じテキスト)があるか探す
                        for (QuestionSaveRequest.OptionDto optDto : req.getOptions()) {
                            boolean found = false;
                            for (MultipleChoiceOption currentOpt : currentOptions) {
                                // テキストが同じなら、上書き更新する
                                if (currentOpt.getText().equals(optDto.getText())) {
                                    currentOpt.setImageUrl(optDto.getImageUrl());
                                    currentOpt.setCorrect(optDto.isCorrect());
                                    found = true;
                                    break;
                                }
                            }
                            // ② 見つからなかった場合（新しい選択肢が追加された場合）は新規作成
                            if (!found) {
                                MultipleChoiceOption newOpt = new MultipleChoiceOption();
                                newOpt.setText(optDto.getText());
                                newOpt.setImageUrl(optDto.getImageUrl());
                                newOpt.setCorrect(optDto.isCorrect());
                                newOpt.setQuestionEntity(questionEntity);
                                currentOptions.add(newOpt);
                            }
                        }

                        // ③ 今回送られてこなかった選択肢（画面で削除されたもの）を消す
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
                                iterator.remove(); // リストから削除（JPAが自動でDBからも削除します）
                            }
                        }
                    } else {
                        // 選択肢が空で送られてきた場合は全削除
                        questionEntity.getOptions().clear();
                    }

                } else {
                    throw new RuntimeException("Question not found with ID: " + req.getId());
                }
            } else {
                // 【新規作成】（元のコードと同じ）
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

            // 問題本体のデータを更新
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

        questionRepository.saveAll(entitiesToSave);
    }

    public List<PlayerQuestionDto> getQuestionsForPlayer(Long workbookId) {
        // DBから削除されていない問題を全件取得[cite: 12]
        List<MultipleChoiceQuestion> entities = questionRepository.findByWorkbookIdAndDeletedFalse(workbookId);

        // フロントエンドが扱いやすいDTOの形に変換する
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

            // 選択肢 (MultipleChoiceOption) もDTOに変換[cite: 5, 6]
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